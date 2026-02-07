import { join, dirname } from 'path'
import { writeFile, mkdir, readFile, stat } from 'fs/promises'
import { createRequire } from 'module'
import { Spine, SpineRuntime, CapsulePropertyTypes, makeImportStack, merge } from "../encapsulate"
import { StaticAnalyzer } from "../../src/static-analyzer.v0"
import { CapsuleModuleProjector } from "../../src/capsule-projectors/CapsuleModuleProjector.v0"


export { merge }

// Custom resolve function that uses createRequire for proper package resolution
async function resolve(uri: string, fromPath: string, spineRoot?: string): Promise<string> {
    try {
        // Create a require function from the parent file's directory
        const require = createRequire(fromPath)
        const result = require.resolve(uri)
        return result
    } catch (error: any) {
        // If standard resolution fails and uri is a scoped package, try resolving
        // the package root first, then append the subpath relative to it.
        if (uri.startsWith('@')) {
            const match = uri.match(/^(@[^/]+\/[^/]+)\/(.+)$/)
            if (match) {
                const [, packageName, subpath] = match
                try {
                    const require = createRequire(fromPath)
                    const packageJsonPath = require.resolve(join(packageName, 'package.json'))
                    const packageRoot = dirname(packageJsonPath)
                    const fsPath = join(packageRoot, subpath + '.ts')
                    await stat(fsPath)
                    return fsPath
                } catch {
                    // Fall through
                }
            }

            // Fallback: transform @scope/package/path to scope/packages/package/path relative to spineRoot
            if (spineRoot) {
                const transformed = uri.replace(/^@([^/]+)\/([^/]+)\/(.+)$/, '$1/packages/$2/$3')
                const fsPath = join(spineRoot, transformed + '.ts')
                try {
                    await stat(fsPath)
                    return fsPath
                } catch {
                    // File doesn't exist, fall through to Bun.resolve
                }
            }
        }

        // Final fallback to Bun.resolve
        return await Bun.resolve(uri, fromPath)
    }
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
        importCapsule: async (filepath: string) => {
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
        },
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
                    filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                    await mkdir(dirname(filepath), { recursive: true })
                    await writeFile(filepath, content, 'utf-8')
                },
                readFile: async (filepath: string) => {
                    filepath = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis', filepath)
                    return readFile(filepath, 'utf-8')
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

    const loadCapsule = async ({ capsuleSnapshot }: { capsuleSourceLineRef: string, capsuleSnapshot: any }) => {

        if (!capsuleModuleProjectionRoot) {
            throw new Error('capsuleModuleProjectionRoot must be provided to enable dynamic loading of capsules')
        }

        let filepath = capsuleSnapshot.spineContracts?.['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']?.['#@stream44.studio/encapsulate/structs/Capsule.v0']?.projectedCapsuleFilepath

        if (!filepath) throw new Error(`Cannot load capsule. No 'filepath' found at 'spineContracts["#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0"]["#@stream44.studio/encapsulate/structs/Capsule.v0"].projectedCapsuleFilepath'!`)

        const { capsule } = await import(join(capsuleModuleProjectionRoot, filepath))

        return capsule
    }

    return {
        commonSpineContractOpts,
        CapsulePropertyTypes,
        makeImportStack,
        encapsulate,
        run,
        freeze,
        loadCapsule,
        spineContractInstances, // Expose for testing
        hoistSnapshot: async ({ snapshot }: { snapshot: any }) => {

            timing?.recordMajor('HOIST SNAPSHOT: START')

            const result = await SpineRuntime({
                snapshot,
                spineContracts: spineContractInstances.runtime,
                loadCapsule
            })

            timing?.recordMajor('HOIST SNAPSHOT: COMPLETE')

            return result
        }
    }
}
