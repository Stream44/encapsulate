import { join, dirname, resolve as pathResolve } from 'path'
import { writeFile, mkdir, readFile, stat } from 'fs/promises'
import { Spine, SpineRuntime, CapsulePropertyTypes, makeImportStack, merge } from "../encapsulate"
import { StaticAnalyzer } from "../../src/static-analyzer.v0"
import { CapsuleModuleProjector } from "../../src/capsule-projectors/CapsuleModuleProjector.v0"


export { merge }

// Pure filesystem resolve — never calls Bun.resolve or createRequire to avoid
// Bun's internal module resolver which can OOM on large capsule trees.
//
// Resolution strategy:
// 1. Scoped packages: @scope/package/path → spineRoot/scope/packages/package/path.ts
//    (matches tsconfig.paths.json pattern used across the workspace)
// 2. Scoped package root: @scope/package → resolve via package.json exports
// 3. Relative paths are resolved by the caller before reaching this function.
async function resolve(uri: string, fromPath: string, spineRoot?: string): Promise<string> {

    // Scoped package: @scope/package/subpath
    if (uri.startsWith('@') && spineRoot) {
        const match = uri.match(/^@([^/]+)\/([^/]+)(?:\/(.+))?$/)
        if (match) {
            const [, scope, pkg, subpath] = match

            if (subpath) {
                // @scope/package/path → spineRoot/scope/packages/package/path.ts
                const fsPath = join(spineRoot, scope, 'packages', pkg, subpath + '.ts')
                try {
                    await stat(fsPath)
                    return fsPath
                } catch {
                    // Try without .ts extension (already has extension)
                    try {
                        await stat(join(spineRoot, scope, 'packages', pkg, subpath))
                        return join(spineRoot, scope, 'packages', pkg, subpath)
                    } catch {
                        // Fall through to package.json exports resolution
                    }
                }
            }

            // Try resolving via package.json exports
            const packageDir = join(spineRoot, scope, 'packages', pkg)
            try {
                const packageJsonPath = join(packageDir, 'package.json')
                const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

                if (subpath && packageJson.exports) {
                    // Look for matching export: "./" + subpath or "./" + subpath + ".ts"
                    const exportKey = './' + subpath
                    const exportValue = packageJson.exports[exportKey]
                    if (typeof exportValue === 'string') {
                        return pathResolve(packageDir, exportValue)
                    }
                } else if (!subpath && packageJson.exports?.['.']) {
                    const mainExport = packageJson.exports['.']
                    if (typeof mainExport === 'string') {
                        return pathResolve(packageDir, mainExport)
                    }
                } else if (!subpath && packageJson.main) {
                    return pathResolve(packageDir, packageJson.main)
                }
            } catch {
                // package.json doesn't exist or is invalid
            }

            // Traverse up from spineRoot looking for the package:
            // 1. Check if current dir IS the package (self-package)
            // 2. Check node_modules/@scope/pkg at each level
            let dir = spineRoot
            while (true) {
                // Check if this directory's package.json matches the requested package
                try {
                    const pjPath = join(dir, 'package.json')
                    const pj = JSON.parse(await readFile(pjPath, 'utf-8'))
                    if (pj.name === `@${scope}/${pkg}`) {
                        if (subpath) {
                            if (pj.exports) {
                                const exportKey = './' + subpath
                                const exportValue = pj.exports[exportKey]
                                if (typeof exportValue === 'string') {
                                    return pathResolve(dir, exportValue)
                                }
                            }
                            const fsPath = join(dir, subpath + '.ts')
                            try { await stat(fsPath); return fsPath } catch { }
                            try { await stat(join(dir, subpath)); return join(dir, subpath) } catch { }
                        } else if (pj.exports?.['.']) {
                            const mainExport = pj.exports['.']
                            if (typeof mainExport === 'string') {
                                return pathResolve(dir, mainExport)
                            }
                        } else if (pj.main) {
                            return pathResolve(dir, pj.main)
                        }
                    }
                } catch { }

                // Check node_modules/@scope/pkg
                const nmCandidate = join(dir, 'node_modules', `@${scope}`, pkg)
                try {
                    const nmPjPath = join(nmCandidate, 'package.json')
                    const nmPj = JSON.parse(await readFile(nmPjPath, 'utf-8'))
                    if (subpath) {
                        if (nmPj.exports) {
                            const exportKey = './' + subpath
                            const exportValue = nmPj.exports[exportKey]
                            if (typeof exportValue === 'string') {
                                return pathResolve(nmCandidate, exportValue)
                            }
                        }
                        const fsPath = join(nmCandidate, subpath + '.ts')
                        try { await stat(fsPath); return fsPath } catch { }
                        try { await stat(join(nmCandidate, subpath)); return join(nmCandidate, subpath) } catch { }
                    } else if (nmPj.exports?.['.']) {
                        const mainExport = nmPj.exports['.']
                        if (typeof mainExport === 'string') {
                            return pathResolve(nmCandidate, mainExport)
                        }
                    } else if (nmPj.main) {
                        return pathResolve(nmCandidate, nmPj.main)
                    }
                } catch { }

                const parent = dirname(dir)
                if (parent === dir) break
                dir = parent
            }

            // Also traverse up from fromPath (the importing file) checking:
            // 1. If current dir IS the package (self-package resolution)
            // 2. node_modules/@scope/pkg at each level
            let fromDir = dirname(fromPath)
            while (true) {
                // Check if this directory's package.json matches the requested package
                try {
                    const pjPath = join(fromDir, 'package.json')
                    const pj = JSON.parse(await readFile(pjPath, 'utf-8'))
                    if (pj.name === `@${scope}/${pkg}`) {
                        if (subpath) {
                            if (pj.exports) {
                                const exportKey = './' + subpath
                                const exportValue = pj.exports[exportKey]
                                if (typeof exportValue === 'string') {
                                    return pathResolve(fromDir, exportValue)
                                }
                            }
                            const fsPath = join(fromDir, subpath + '.ts')
                            try { await stat(fsPath); return fsPath } catch { }
                            try { await stat(join(fromDir, subpath)); return join(fromDir, subpath) } catch { }
                        } else if (pj.exports?.['.']) {
                            const mainExport = pj.exports['.']
                            if (typeof mainExport === 'string') {
                                return pathResolve(fromDir, mainExport)
                            }
                        } else if (pj.main) {
                            return pathResolve(fromDir, pj.main)
                        }
                    }
                } catch { }

                const nmCandidate = join(fromDir, 'node_modules', `@${scope}`, pkg)
                try {
                    const nmPjPath = join(nmCandidate, 'package.json')
                    const nmPj = JSON.parse(await readFile(nmPjPath, 'utf-8'))
                    if (subpath) {
                        if (nmPj.exports) {
                            const exportKey = './' + subpath
                            const exportValue = nmPj.exports[exportKey]
                            if (typeof exportValue === 'string') {
                                return pathResolve(nmCandidate, exportValue)
                            }
                        }
                        const fsPath = join(nmCandidate, subpath + '.ts')
                        try { await stat(fsPath); return fsPath } catch { }
                        try { await stat(join(nmCandidate, subpath)); return join(nmCandidate, subpath) } catch { }
                    } else if (nmPj.exports?.['.']) {
                        const mainExport = nmPj.exports['.']
                        if (typeof mainExport === 'string') {
                            return pathResolve(nmCandidate, mainExport)
                        }
                    } else if (nmPj.main) {
                        return pathResolve(nmCandidate, nmPj.main)
                    }
                } catch { }

                const parent = dirname(fromDir)
                if (parent === fromDir) break
                fromDir = parent
            }
        }
    }

    // Absolute path — probe extensions
    if (uri.startsWith('/')) {
        // Try exact path first
        try {
            const s = await stat(uri)
            if (s.isFile()) return uri
            if (s.isDirectory()) {
                for (const idx of ['index.ts', 'index.js']) {
                    try { await stat(join(uri, idx)); return join(uri, idx) } catch { }
                }
            }
        } catch { }
        // Try with extensions
        for (const ext of ['.ts', '.js', '.mjs']) {
            try { await stat(uri + ext); return uri + ext } catch { }
        }
    }

    // Non-scoped bare specifier — try node_modules resolution from fromPath
    if (!uri.startsWith('.') && !uri.startsWith('/')) {
        // Parse package name and subpath (e.g., "t44/caps/WorkspaceCli" -> pkg="t44", subpath="caps/WorkspaceCli")
        const slashIdx = uri.indexOf('/')
        const pkg = slashIdx === -1 ? uri : uri.slice(0, slashIdx)
        const subpath = slashIdx === -1 ? undefined : uri.slice(slashIdx + 1)

        // Walk up from fromPath looking for self-package or node_modules
        let dir = dirname(fromPath)
        while (true) {
            // Check if this directory's package.json matches the requested package (self-package resolution)
            try {
                const pjPath = join(dir, 'package.json')
                const pj = JSON.parse(await readFile(pjPath, 'utf-8'))
                if (pj.name === pkg) {
                    if (subpath) {
                        if (pj.exports) {
                            const exportKey = './' + subpath
                            const exportValue = pj.exports[exportKey]
                            if (typeof exportValue === 'string') {
                                return pathResolve(dir, exportValue)
                            }
                        }
                        const fsPath = join(dir, subpath + '.ts')
                        try { await stat(fsPath); return fsPath } catch { }
                        try { await stat(join(dir, subpath)); return join(dir, subpath) } catch { }
                    } else if (pj.exports?.['.']) {
                        const mainExport = pj.exports['.']
                        if (typeof mainExport === 'string') {
                            return pathResolve(dir, mainExport)
                        }
                    } else if (pj.main) {
                        return pathResolve(dir, pj.main)
                    }
                }
            } catch { }

            // Check node_modules
            const candidate = join(dir, 'node_modules', uri)
            try {
                const s = await stat(candidate)
                if (s.isDirectory()) {
                    // Try package.json main/exports
                    try {
                        const pj = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf-8'))
                        if (pj.main) return pathResolve(candidate, pj.main)
                    } catch { }
                    return join(candidate, 'index.js')
                }
                return candidate
            } catch { }
            // Try with extensions
            for (const ext of ['.ts', '.js', '.mjs']) {
                try {
                    await stat(candidate + ext)
                    return candidate + ext
                } catch { }
            }
            const parent = dirname(dir)
            if (parent === dir) break
            dir = parent
        }
    }

    throw new Error(`[encapsulate resolve] Cannot resolve '${uri}' from '${fromPath}' (spineRoot: ${spineRoot})`)
}


export async function CapsuleSpineFactory({
    spineFilesystemRoot,
    capsuleModuleProjectionRoot,
    capsuleModuleProjectionPackage,
    staticAnalysisEnabled = true,
    onMembraneEvent,
    enableCallerStackInference = false,
    spineContracts,
    timing: timingParam
}: {
    spineFilesystemRoot: string,
    capsuleModuleProjectionRoot?: string,
    capsuleModuleProjectionPackage?: string,
    staticAnalysisEnabled?: boolean,
    onMembraneEvent?: (event: any) => void,
    enableCallerStackInference?: boolean,
    spineContracts: Record<string, any>,
    timing?: { record: (step: string) => void, recordMajor: (step: string) => void, chalk?: any }
}) {

    if (capsuleModuleProjectionRoot) capsuleModuleProjectionRoot = capsuleModuleProjectionRoot.replace(/^file:\/\//, '')
    if (spineFilesystemRoot) spineFilesystemRoot = spineFilesystemRoot.replace(/^file:\/\//, '')

    const timing = timingParam

    timing?.recordMajor('CAPSULE SPINE FACTORY: INITIALIZATION')

    const SingletonRegistry = () => {
        const registry = new Map<string, Promise<any>>()

        return {
            async ensure(id: string, createHandler: () => Promise<any>) {
                if (!registry.has(id)) {
                    registry.set(id, createHandler())
                }
                return registry.get(id)!
            }
        }
    }

    const registry = SingletonRegistry()

    const spineContractInstances: {
        encapsulation: Record<string, any>,
        runtime: Record<string, any>
    } = {
        encapsulation: {},
        runtime: {}
    }

    const sourceSpine: { encapsulate?: any } = {}
    const commonSpineContractOpts = {
        spineFilesystemRoot,
        resolve: async (uri: string, parentFilepath: string) => {
            // For relative paths, join with parent directory first
            if (/^\.\.?\//.test(uri)) {
                return await resolve(join(parentFilepath, '..', uri), spineFilesystemRoot, spineFilesystemRoot)
            }
            // For absolute/package paths, use custom resolve with spine root
            return await resolve(uri, parentFilepath, spineFilesystemRoot)
        },
        importCapsule: (() => {
            return async (filepath: string) => {
                const shortPath = filepath.replace(/^.*\/genesis\//, '')

                timing?.record(`importCapsule: Called for ${shortPath}`)
                const result = await registry.ensure(filepath, async () => {
                    timing?.recordMajor(`importCapsule: Starting import for ${shortPath}`)
                    const importStart = Date.now()
                    const exports = await import(filepath)
                    const importDuration = Date.now() - importStart
                    timing?.recordMajor(`importCapsule: import() took ${importDuration}ms for ${shortPath}`)

                    if (importDuration > 10) {
                        if (timing) {
                            console.log(timing.chalk.red(`\n⚠️  WARNING: Slow module load detected!`))
                            console.log(timing.chalk.red(`   Module: ${filepath}`))
                            console.log(timing.chalk.red(`   Load time: ${importDuration}ms`))
                            console.log(timing.chalk.red(`   Consider using dynamic imports to load heavy dependencies only when needed.\n`))
                        }
                    }

                    if (typeof exports.capsule !== 'function') throw new Error(`Module at '${filepath}' does not export 'capsule'!`)

                    const capsuleStart = Date.now()
                    const capsule = await exports.capsule({
                        encapsulate: sourceSpine.encapsulate,
                        CapsulePropertyTypes,
                        makeImportStack
                    })
                    const capsuleDuration = Date.now() - capsuleStart
                    timing?.recordMajor(`importCapsule: exports.capsule() took ${capsuleDuration}ms for ${shortPath}`)

                    timing?.record(`importCapsule: Returning result for ${shortPath}`)

                    return capsule
                })
                return result
            }
        })(),
        encapsulateOpts: {
            CapsulePropertyTypes
        }
    }

    timing?.recordMajor('SPINE CONTRACTS: INITIALIZATION')

    for (const spineContractUri in spineContracts) {
        spineContractInstances.encapsulation[spineContractUri] = spineContracts[spineContractUri]({
            ...commonSpineContractOpts,
            freezeCapsule: async ({ spineContractUri, capsule }: { spineContractUri: string, capsule: any }): Promise<any> => {

                if (!projector) {
                    throw new Error('capsuleModuleProjectionRoot must be provided to enable freezing')
                }

                let snapshotValues = {}

                // Create a new set per freezeCapsule call to track circular dependencies within this projection tree
                const projectingCapsules = new Set<string>()

                const projected = await projector.projectCapsule({
                    capsule,
                    capsules,
                    snapshotValues,
                    spineContractUri,
                    projectingCapsules
                })

                return snapshotValues
            }
        })
        spineContractInstances.runtime[spineContractUri] = spineContracts[spineContractUri]({
            ...commonSpineContractOpts,
            enableCallerStackInference,
            onMembraneEvent,
        })
    }

    timing?.recordMajor('CAPSULE MODULE PROJECTOR: INITIALIZATION')

    const projector = capsuleModuleProjectionRoot ? CapsuleModuleProjector({
        spineStore: {
            writeFile: async (filepath: string, content: string) => {
                filepath = join(spineFilesystemRoot, filepath)
                await mkdir(dirname(filepath), { recursive: true })
                await writeFile(filepath, content, 'utf-8')
            },
            getStats: async (filepath: string) => {
                filepath = join(spineFilesystemRoot, filepath)
                try {
                    const stats = await stat(filepath)
                    return { mtime: stats.mtime }
                } catch (error) {
                    return null
                }
            },
        },
        projectionStore: {
            writeFile: async (filepath: string, content: string) => {
                filepath = join(capsuleModuleProjectionRoot, filepath)
                await mkdir(dirname(filepath), { recursive: true })
                await writeFile(filepath, content, 'utf-8')
            },
            getStats: async (filepath: string) => {
                filepath = join(capsuleModuleProjectionRoot, filepath)
                try {
                    const stats = await stat(filepath)
                    return { mtime: stats.mtime }
                } catch (error) {
                    return null
                }
            },
        },
        projectionCacheStore: {
            writeFile: async (filepath: string, content: string) => {
                filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/projection-cache', filepath)
                await mkdir(dirname(filepath), { recursive: true })
                await writeFile(filepath, content, 'utf-8')
            },
            readFile: async (filepath: string) => {
                filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/projection-cache', filepath)
                return readFile(filepath, 'utf-8')
            },
            getStats: async (filepath: string) => {
                filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/projection-cache', filepath)
                try {
                    const stats = await stat(filepath)
                    return { mtime: stats.mtime }
                } catch (error) {
                    return null
                }
            },
        },
        spineFilesystemRoot,
        capsuleModuleProjectionPackage,
        timing
    }) : undefined

    timing?.recordMajor('SPINE: INITIALIZATION')

    let { encapsulate, freeze, capsules } = await Spine({
        spineFilesystemRoot,
        timing,
        staticAnalyzer: staticAnalysisEnabled ? StaticAnalyzer({
            timing,
            cacheStore: {
                writeFile: async (filepath: string, content: string) => {
                    // Write to central cache (spineFilesystemRoot)
                    const centralPath = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                    await mkdir(dirname(centralPath), { recursive: true })
                    await writeFile(centralPath, content, 'utf-8')
                    // Also write to local project cache if available
                    if (capsuleModuleProjectionRoot) {
                        try {
                            const localPath = join(capsuleModuleProjectionRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                            await mkdir(dirname(localPath), { recursive: true })
                            await writeFile(localPath, content, 'utf-8')
                        } catch { /* local write is best-effort */ }
                    }
                },
                readFile: async (filepath: string) => {
                    const centralPath = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                    const content = await readFile(centralPath, 'utf-8')
                    // Sync to local project cache on read (covers cache-hit paths)
                    if (content && capsuleModuleProjectionRoot) {
                        try {
                            const localPath = join(capsuleModuleProjectionRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                            await mkdir(dirname(localPath), { recursive: true })
                            await writeFile(localPath, content, 'utf-8')
                        } catch { /* local sync is best-effort */ }
                    }
                    return content
                },
                getStats: async (filepath: string) => {
                    filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                    try {
                        const stats = await stat(filepath)
                        return { mtime: stats.mtime }
                    } catch (error) {
                        // File doesn't exist
                        return null
                    }
                },
            },
            spineStore: {
                getStats: async (filepath: string) => {
                    filepath = join(spineFilesystemRoot, filepath)
                    try {
                        const stats = await stat(filepath)
                        return { mtime: stats.mtime }
                    } catch (error) {
                        // File doesn't exist
                        return null
                    }
                },
            },
        }) : undefined,
        spineContracts: spineContractInstances.encapsulation
    })
    sourceSpine.encapsulate = encapsulate

    timing?.recordMajor('SPINE RUNTIME: INITIALIZATION')

    let { run } = await SpineRuntime({
        spineFilesystemRoot,
        spineContracts: spineContractInstances.runtime,
        capsules
    })

    timing?.recordMajor('CAPSULE SPINE FACTORY: READY')

    const loadCapsule = async ({ capsuleSnapshot, cacheBustVersion }: { capsuleSourceLineRef: string, capsuleSnapshot: any, cacheBustVersion?: number }) => {

        if (!capsuleModuleProjectionRoot) {
            throw new Error('capsuleModuleProjectionRoot must be provided to enable dynamic loading of capsules')
        }

        let filepath = capsuleSnapshot.spineContracts?.['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']?.['#@stream44.studio/encapsulate/structs/Capsule']?.projectedCapsuleFilepath

        if (!filepath) throw new Error(`Cannot load capsule. No 'filepath' found at 'spineContracts["#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0"]["#@stream44.studio/encapsulate/structs/Capsule"].projectedCapsuleFilepath'!`)

        // Check cache bust version - if it doesn't match, return null to trigger regeneration
        if (cacheBustVersion !== undefined && capsuleSnapshot.cst?.cacheBustVersion !== cacheBustVersion) {
            return null
        }

        const { capsule } = await import(join(capsuleModuleProjectionRoot, filepath))

        return capsule
    }

    // Wrap freeze to also write spine instance (.sit.json) files
    const wrappedFreeze = async function () {
        const snapshot = await freeze()

        // Write spine instance files if capsuleModuleProjectionRoot is available
        if (capsuleModuleProjectionRoot) {
            try {
                // Deduplicate capsules: the capsules dict has entries keyed by both
                // capsuleSourceLineRef and capsuleName — only process capsuleSourceLineRef keys
                const uniqueCapsules: Record<string, any> = {}
                for (const [key, capsule] of Object.entries(capsules)) {
                    if (key.includes(':') && /:\d+$/.test(key)) {
                        uniqueCapsules[key] = capsule
                    }
                }

                // Find root capsules — capsules that are NOT referenced as mapped dependencies
                const mappedCapsuleNames = new Set<string>()
                for (const [, capsule] of Object.entries(uniqueCapsules)) {
                    const cst = capsule.cst
                    if (cst?.spineContracts) {
                        for (const [, spineContract] of Object.entries(cst.spineContracts) as any) {
                            if (spineContract.propertyContracts) {
                                for (const [, propContract] of Object.entries(spineContract.propertyContracts) as any) {
                                    if (propContract.properties) {
                                        for (const [, propDef] of Object.entries(propContract.properties) as any) {
                                            if (propDef.type === 'CapsulePropertyTypes.Mapping' && propDef.mappedModuleUri) {
                                                mappedCapsuleNames.add(propDef.mappedModuleUri)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (cst?.source?.extendsCapsuleUri) {
                        mappedCapsuleNames.add(cst.source.extendsCapsuleUri)
                    }
                }

                for (const [, capsule] of Object.entries(uniqueCapsules)) {
                    const cst = capsule.cst
                    const rootCapsuleName = cst?.source?.capsuleName
                    if (!rootCapsuleName) continue

                    const moduleUri = cst?.source?.moduleUri
                    if (mappedCapsuleNames.has(rootCapsuleName) || (moduleUri && mappedCapsuleNames.has(moduleUri))) {
                        continue
                    }

                    // This is a root capsule — write its .sit.json
                    const dirName = rootCapsuleName.replace(/\//g, '~')
                    const sitDir = join(capsuleModuleProjectionRoot, '.~o/encapsulate.dev/spine-instances', dirName)
                    const sitFilePath = join(sitDir, `root-capsule.sit.json`)

                    // Build the capsules map
                    const capsuleEntries: Record<string, { capsuleSourceUriLineRef: string }> = {}
                    for (const [, cap] of Object.entries(uniqueCapsules)) {
                        const capCst = cap.cst
                        if (capCst?.source?.capsuleName) {
                            capsuleEntries[capCst.source.capsuleName] = {
                                capsuleSourceUriLineRef: capCst.capsuleSourceUriLineRef
                            }
                        }
                    }

                    // Collect capsuleInstances from the cached root instance using an
                    // iterative stack — each instance stores its ID and parent ID from init
                    const rootInstance = await capsule.makeInstance()
                    const capsuleInstances: Record<string, { capsuleName: string, capsuleSourceUriLineRef: string, parentCapsuleSourceUriLineRefInstanceId: string }> = {}

                    // If the root instance has a sit with pre-populated capsuleInstances, use it directly
                    if (rootInstance.sit?.capsuleInstances && Object.keys(rootInstance.sit.capsuleInstances).length > 0) {
                        Object.assign(capsuleInstances, rootInstance.sit.capsuleInstances)
                    } else {
                        // Iterative stack-based collection from instance tree
                        const stack: Array<{ instance: any, parentId: string }> = [{ instance: rootInstance, parentId: '' }]
                        const visited = new Set<string>()
                        while (stack.length > 0) {
                            const { instance, parentId } = stack.pop()!
                            if (!instance?.capsuleSourceUriLineRefInstanceId) continue
                            const id = instance.capsuleSourceUriLineRefInstanceId
                            if (visited.has(id)) continue
                            visited.add(id)

                            capsuleInstances[id] = {
                                capsuleName: instance.capsuleName || '',
                                capsuleSourceUriLineRef: instance.capsuleSourceUriLineRef || '',
                                parentCapsuleSourceUriLineRefInstanceId: parentId
                            }

                            if (instance.extendedCapsuleInstance) {
                                stack.push({ instance: instance.extendedCapsuleInstance, parentId: id })
                            }
                            if (instance.mappedCapsuleInstances) {
                                for (const mapped of instance.mappedCapsuleInstances) {
                                    stack.push({ instance: mapped, parentId: id })
                                }
                            }
                        }
                    }

                    const rootInstanceId = rootInstance.capsuleSourceUriLineRefInstanceId || ''

                    const sitData = {
                        rootCapsule: {
                            capsuleSourceUriLineRef: cst.capsuleSourceUriLineRef,
                            capsuleSourceUriLineRefInstanceId: rootInstanceId
                        },
                        capsules: capsuleEntries,
                        capsuleInstances
                    }

                    await mkdir(sitDir, { recursive: true })
                    await writeFile(sitFilePath, JSON.stringify(sitData, null, 2), 'utf-8')
                }
            } catch (error) {
                // Spine instance file writing is best-effort
                console.warn('Warning: Failed to write spine instance files:', error)
            }
        }

        return snapshot
    }

    return {
        commonSpineContractOpts,
        CapsulePropertyTypes,
        makeImportStack,
        encapsulate,
        run,
        freeze: wrappedFreeze,
        loadCapsule,
        spineContractInstances, // Expose for testing
        hoistSnapshot: async ({ snapshot }: { snapshot: any }) => {

            timing?.recordMajor('HOIST SNAPSHOT: START')

            const result = await SpineRuntime({
                snapshot,
                spineFilesystemRoot,
                spineContracts: spineContractInstances.runtime,
                loadCapsule
            })

            timing?.recordMajor('HOIST SNAPSHOT: COMPLETE')

            return result
        }
    }
}
