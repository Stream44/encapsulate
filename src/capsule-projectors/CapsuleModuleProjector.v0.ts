import * as ts from 'typescript'
import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join, dirname, relative, normalize, basename } from 'path'
import { merge } from '../encapsulate'


// Write mode determines CSS path resolution
type WriteMode = 'temp' | 'projection'

// Projection context holds all information needed for projecting a capsule
interface ProjectionContext {
    capsule: any
    customProjectionPath: string | null
    mappedCapsules: Array<{ capsuleHash: string, projectionPath: string, capsule: any }>
    cssFiles: Array<{ sourcePath: string, tempPath: string, projectionPath: string | null }>
}

function safeCapsuleName(name: string) {
    // Strip leading @ and replace / with - for flat filenames
    return name.replace(/^@/, '').replace(/[\/]/g, '-')
}

/**
 * Constructs a cache file path for a capsule, using npm URI for external modules
 * @param moduleFilepath - The module filepath (may start with ../)
 * @param importStackLine - The import stack line number
 * @param spineFilesystemRoot - The spine filesystem root
 * @returns The cache file path to use
 */
async function constructCacheFilePath(moduleFilepath: string, importStackLine: number, spineFilesystemRoot: string): Promise<string> {
    const isExternal = moduleFilepath.startsWith('../')
    const hasNodeModules = moduleFilepath.includes('node_modules/')

    if (isExternal || hasNodeModules) {
        // External module or node_modules path - construct npm URI
        const absoluteFilepath = join(spineFilesystemRoot, moduleFilepath)
        const npmUri = await constructNpmUriForCache(absoluteFilepath, spineFilesystemRoot)
        if (npmUri) {
            // Prefix with o/npmjs.com/node_modules/ for external modules
            return `o/npmjs.com/node_modules/${npmUri}:${importStackLine}`
        }
        // Fallback to normalized path
        return `${normalize(moduleFilepath).replace(/^\.\.\//, '').replace(/\.\.\//g, '')}:${importStackLine}`
    }
    // Internal module - use as-is
    return `${moduleFilepath}:${importStackLine}`
}

/**
 * Finds the nearest package.json and constructs an npm URI for cache files.
 * First checks if the path contains /node_modules/ and if so, extracts the portion
 * after the last /node_modules/ occurrence for consistent paths in dev and installed mode.
 * This matches the logic from static-analyzer.v0.ts
 */
async function constructNpmUriForCache(absoluteFilepath: string, spineRoot: string): Promise<string | null> {
    // Check for /node_modules/ in the path — use the last occurrence to handle nested node_modules
    const nodeModulesMarker = '/node_modules/'
    const lastIdx = absoluteFilepath.lastIndexOf(nodeModulesMarker)
    if (lastIdx !== -1) {
        // Extract everything after the last /node_modules/
        return absoluteFilepath.substring(lastIdx + nodeModulesMarker.length)
    }

    let currentDir = dirname(absoluteFilepath)
    const maxDepth = 20 // Prevent infinite loops

    for (let i = 0; i < maxDepth; i++) {
        const packageJsonPath = join(currentDir, 'package.json')

        try {
            await stat(packageJsonPath)
            // Found package.json, read it
            const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
            const packageName = packageJson.name

            if (!packageName) {
                // No name in package.json, continue searching
                currentDir = dirname(currentDir)
                continue
            }

            // Get the relative path from the package root to the file
            const relativeFromPackage = relative(currentDir, absoluteFilepath)

            // Construct npm URI: packageName/relativePath
            return `${packageName}/${relativeFromPackage}`
        } catch (error) {
            // package.json not found or not readable, go up one directory
            const parentDir = dirname(currentDir)
            if (parentDir === currentDir) {
                // Reached filesystem root
                break
            }
            currentDir = parentDir
        }
    }

    return null
}

export function CapsuleModuleProjector({
    spineStore,
    projectionStore,
    projectionCacheStore,
    spineFilesystemRoot,
    capsuleModuleProjectionRoot,
    capsuleModuleProjectionPackage,
    timing
}: {
    spineStore: {
        writeFile: (filepath: string, content: string) => Promise<void>,
        getStats?: (filepath: string) => Promise<{ mtime: Date } | null>
    },
    projectionStore: {
        writeFile: (filepath: string, content: string) => Promise<void>,
        getStats?: (filepath: string) => Promise<{ mtime: Date } | null>
    } | null,
    projectionCacheStore?: {
        writeFile?: (filepath: string, content: string) => Promise<void>,
        readFile?: (filepath: string) => Promise<string | undefined>,
        getStats?: (filepath: string) => Promise<{ mtime: Date } | null>
    },
    spineFilesystemRoot: string,
    capsuleModuleProjectionRoot?: string,
    capsuleModuleProjectionPackage?: string,
    timing?: { record: (step: string) => void, chalk?: any }
}) {

    timing?.record('CapsuleModuleProjector: Initialized')


    // Helper: Find custom projection path from property names starting with '/'
    function findCustomProjectionPath(capsule: any, spineContractUri: string): string | null {
        const spineContract = capsule.cst.spineContracts[spineContractUri]
        if (spineContract?.propertyContracts) {
            for (const propName in spineContract.propertyContracts) {
                if (propName.startsWith('/')) {
                    return propName.substring(1) // Remove leading '/'
                }
            }
        }
        return null
    }

    // Helper: Find mapped capsules that need custom projection
    function findMappedCapsules(capsule: any, spineContractUri: string, capsules?: Record<string, any>): Array<{ capsuleHash: string, projectionPath: string, capsule: any }> {
        const mapped: Array<{ capsuleHash: string, projectionPath: string, capsule: any }> = []
        const spineContract = capsule.cst.spineContracts[spineContractUri]

        if (spineContract?.propertyContracts) {
            for (const propName in spineContract.propertyContracts) {
                if (propName.startsWith('/')) {
                    const prop = spineContract.propertyContracts[propName]
                    // Check if this is a Mapping type property
                    if (prop.type === 'CapsulePropertyTypes.Mapping') {
                        // First try to find the mapped capsule in ambient references
                        const ambientRefs = capsule.cst.source.ambientReferences || {}
                        for (const [refName, ref] of Object.entries(ambientRefs)) {
                            const refTyped = ref as any
                            if (refTyped.type === 'capsule') {
                                mapped.push({
                                    capsuleHash: refTyped.value.capsuleSourceNameRefHash,
                                    projectionPath: propName.substring(1), // Remove leading '/'
                                    capsule: refTyped.value // Store the full capsule CST
                                })
                            }
                        }

                        // If not found in ambient refs, try string-based mapping
                        if (mapped.length === 0 && prop.valueExpression && capsules) {
                            const mappingValue = prop.valueExpression.replace(/['"]/g, '')

                            // Look through all capsules to find one that matches
                            for (const [key, potentialCapsule] of Object.entries(capsules)) {
                                if (potentialCapsule === capsule) continue

                                const mappedModulePath = potentialCapsule.cst?.source?.moduleUri

                                if (mappedModulePath && (
                                    mappedModulePath === mappingValue ||
                                    mappedModulePath.endsWith(mappingValue) ||
                                    mappedModulePath.includes(mappingValue.replace('./', ''))
                                )) {
                                    mapped.push({
                                        capsuleHash: potentialCapsule.cst.capsuleSourceNameRefHash,
                                        projectionPath: propName.substring(1),
                                        capsule: potentialCapsule.cst
                                    })
                                    break
                                }
                            }
                        }
                    }
                }
                // Also check nested property contracts that start with '#'
                if (propName.startsWith('#')) {
                    const propContract = spineContract.propertyContracts[propName] as any
                    if (propContract?.properties) {
                        for (const nestedPropName in propContract.properties) {
                            if (nestedPropName.startsWith('/')) {
                                const nestedProp = propContract.properties[nestedPropName]
                                // Skip if this mapping has a propertyContractDelegate — the delegate
                                // handles its own projection via OnFreeze
                                if (nestedProp.propertyContractDelegate) continue
                                // Check if this is a Mapping type property
                                if (nestedProp.type === 'CapsulePropertyTypes.Mapping') {
                                    // First try to find the mapped capsule in ambient references
                                    const ambientRefs = capsule.cst.source.ambientReferences || {}
                                    let foundInAmbient = false
                                    for (const [refName, ref] of Object.entries(ambientRefs)) {
                                        const refTyped = ref as any
                                        if (refTyped.type === 'capsule') {
                                            mapped.push({
                                                capsuleHash: refTyped.value.capsuleSourceNameRefHash,
                                                projectionPath: nestedPropName.substring(1), // Remove leading '/'
                                                capsule: refTyped.value // Store the full capsule CST
                                            })
                                            foundInAmbient = true
                                        }
                                    }

                                    // If not found in ambient refs, try string-based mapping
                                    if (!foundInAmbient && nestedProp.valueExpression && capsules) {
                                        const mappingValue = nestedProp.valueExpression.replace(/['"]/g, '')

                                        // Look through all capsules to find one that matches
                                        for (const [key, potentialCapsule] of Object.entries(capsules)) {
                                            if (potentialCapsule === capsule) continue

                                            const mappedModulePath = potentialCapsule.cst?.source?.moduleUri

                                            if (mappedModulePath && (
                                                mappedModulePath === mappingValue ||
                                                mappedModulePath.endsWith(mappingValue) ||
                                                mappedModulePath.includes(mappingValue.replace('./', ''))
                                            )) {
                                                mapped.push({
                                                    capsuleHash: potentialCapsule.cst.capsuleSourceNameRefHash,
                                                    projectionPath: nestedPropName.substring(1),
                                                    capsule: potentialCapsule.cst
                                                })
                                                break
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return mapped
    }

    // Helper: Traverse CST to collect all capsule URIs from mappings and property contracts
    function collectAllCapsuleUris(capsule: any, spineContractUri: string): Set<string> {
        const uris = new Set<string>()

        function traverseProperties(properties: any) {
            if (!properties) return

            for (const [key, prop] of Object.entries(properties)) {
                const propTyped = prop as any

                // Check for Mapping type
                if (propTyped.type === 'CapsulePropertyTypes.Mapping') {
                    if (propTyped.valueExpression) {
                        // Extract URI from value expression (e.g., "@stream44.studio/encapsulate/structs/Capsule")
                        const match = propTyped.valueExpression.match(/["']([^"']+)["']/)
                        if (match && match[1].startsWith('@')) {
                            uris.add(match[1])
                        }
                    }
                }

                // Recursively traverse nested properties
                if (propTyped.properties) {
                    traverseProperties(propTyped.properties)
                }
            }
        }

        const spineContract = capsule.cst.spineContracts[spineContractUri]
        if (spineContract?.propertyContracts) {
            traverseProperties(spineContract.propertyContracts)
        }

        return uris
    }

    // Helper: Check if capsule has encapsulate.dev/standalone property (with optional suffix)
    function hasStandaloneProperty(capsule: any, spineContractUri: string): boolean {
        const spineContract = capsule.cst.spineContracts[spineContractUri]
        // Check both top-level and nested under '#' property contract
        const topLevelProps = spineContract?.propertyContracts || {}
        const nestedProps = spineContract?.propertyContracts?.['#']?.properties || {}

        // Check for exact match or with suffix
        for (const key of Object.keys(topLevelProps)) {
            if (key === 'encapsulate.dev/standalone' || key.startsWith('encapsulate.dev/standalone/')) return true
        }
        for (const key of Object.keys(nestedProps)) {
            if (key === 'encapsulate.dev/standalone' || key.startsWith('encapsulate.dev/standalone/')) return true
        }
        return false
    }

    // Helper: Extract standalone function from capsule definition
    function extractStandaloneFunction(capsule: any, spineContractUri: string): string | null {
        const spineContract = capsule.cst.spineContracts[spineContractUri]

        // Check nested under '#' property contract first, looking for encapsulate.dev/standalone or encapsulate.dev/standalone/*
        const nestedProps = spineContract?.propertyContracts?.['#']?.properties || {}
        const topLevelProps = spineContract?.propertyContracts || {}

        let standaloneProp = null
        for (const key of Object.keys(nestedProps)) {
            if (key === 'encapsulate.dev/standalone' || key.startsWith('encapsulate.dev/standalone/')) {
                standaloneProp = nestedProps[key]
                break
            }
        }
        if (!standaloneProp) {
            for (const key of Object.keys(topLevelProps)) {
                if (key === 'encapsulate.dev/standalone' || key.startsWith('encapsulate.dev/standalone/')) {
                    standaloneProp = topLevelProps[key]
                    break
                }
            }
        }

        if (!standaloneProp || standaloneProp.type !== 'CapsulePropertyTypes.Function') {
            return null
        }

        // Extract the value expression which contains the standalone function
        const valueExpression = standaloneProp.valueExpression
        if (!valueExpression) return null

        // The value expression is: "function (this: any): Function {\n    return function testFunction() { ... }\n}"
        // We need to extract the inner function after "return "
        const match = valueExpression.match(/return\s+(function\s+\w*\s*\([^)]*\)\s*\{[\s\S]*)\s*\}\s*$/m)
        if (match) {
            // Clean up the extracted function - remove extra indentation
            let extracted = match[1].trim()
            // Add back the closing brace if it was removed
            if (!extracted.endsWith('}')) {
                extracted += '\n}'
            }
            // Remove leading indentation from each line
            const lines = extracted.split('\n')
            const minIndent = lines
                .filter(line => line.trim().length > 0)
                .map(line => line.match(/^(\s*)/)?.[1].length || 0)
                .reduce((min, indent) => Math.min(min, indent), Infinity)

            if (minIndent > 0 && minIndent !== Infinity) {
                extracted = lines.map(line => line.substring(minIndent)).join('\n')
            }

            return extracted
        }

        return null
    }

    // Helper: Build projection context
    function buildProjectionContext(capsule: any, spineContractUri: string, capsules?: Record<string, any>): ProjectionContext {
        return {
            capsule,
            customProjectionPath: findCustomProjectionPath(capsule, spineContractUri),
            mappedCapsules: findMappedCapsules(capsule, spineContractUri, capsules),
            cssFiles: []
        }
    }

    // Helper: Build capsule snapshot for a referenced capsule
    async function buildCapsuleSnapshotForReference(ref: any, capsules: Record<string, any> | undefined, spineContractUri: string): Promise<any> {
        // Look up the full capsule from the registry to get capsule name
        let capsule = null
        if (capsules) {
            for (const [key, cap] of Object.entries(capsules)) {
                if (cap.cst?.capsuleSourceNameRefHash === ref.value.capsuleSourceNameRefHash) {
                    capsule = cap
                    break
                }
            }
        }

        if (!capsule) throw new Error(`Could not locate capsule definition!`)

        const sourceExtension = capsule.cst.source.moduleFilepath?.endsWith('.tsx') ? '.tsx' : '.ts'

        let projectedPath: string

        // Use capsuleName if it exists (WITHOUT line number), otherwise use capsuleSourceUriLineRef (WITH line number)
        if (capsule.cst.source.capsuleName) {
            // Use capsuleName as the path - NO line number
            let capsuleNamePath = capsule.cst.source.capsuleName
            if (capsuleNamePath.startsWith('@')) {
                capsuleNamePath = capsuleNamePath.substring(1)
            }
            // Just capsuleName + extension, NO line number
            projectedPath = `.~o/encapsulate.dev/caps/${capsuleNamePath}${sourceExtension}`
        } else if (capsule.cst.capsuleSourceUriLineRef) {
            // Use capsuleSourceUriLineRef which already has format: uri:line
            let uriPath = capsule.cst.capsuleSourceUriLineRef
            if (uriPath.startsWith('@')) {
                uriPath = uriPath.substring(1)
            }
            // Add extension after the line number: uri:line.ext
            projectedPath = `.~o/encapsulate.dev/caps/${uriPath}${sourceExtension}`
        } else {
            // Fallback to hash if neither exists
            projectedPath = `.~o/encapsulate.dev/caps/${capsule.cst.capsuleSourceNameRefHash.substring(0, 8)}${sourceExtension}`
        }

        return {
            spineContracts: {
                [spineContractUri]: {
                    '#@stream44.studio/encapsulate/structs/Capsule': {
                        capsuleSourceNameRefHash: capsule.cst.capsuleSourceNameRefHash,
                        projectedCapsuleFilepath: projectedPath,
                        capsuleName: capsule.cst.source.capsuleName || ''
                    }
                }
            }
        }
    }

    const projectCapsule = async ({ capsule, capsules, snapshotValues, spineContractUri, projectingCapsules }: { capsule: any, capsules?: Record<string, any>, snapshotValues?: any, spineContractUri: string, projectingCapsules?: Set<string> }): Promise<boolean> => {

        // Check for circular dependency - if already projecting this capsule, skip
        if (projectingCapsules) {
            const capsuleId = capsule.cst?.capsuleSourceNameRefHash || capsule.capsuleSourceLineRef
            if (projectingCapsules.has(capsuleId)) {
                return true
            }
            projectingCapsules.add(capsuleId)
        }

        timing?.record(`Projector: Start projection for ${capsule.cst.source.moduleUri || capsule.cst.source.moduleFilepath}`)

        // Only project capsules that have the Capsule struct property
        const spineContract = capsule.cst.spineContracts[spineContractUri]
        if (!spineContract?.propertyContracts?.['#@stream44.studio/encapsulate/structs/Capsule']) {
            return false
        }

        if (projectionCacheStore?.getStats && spineStore?.getStats) {
            try {
                const cacheFilePath = await constructCacheFilePath(
                    capsule.cst.source.moduleFilepath,
                    capsule.cst.source.importStackLine,
                    spineFilesystemRoot
                )
                const cacheFilename = `${cacheFilePath}.projection.json`
                const [sourceStats, cacheStats] = await Promise.all([
                    spineStore.getStats(capsule.cst.source.moduleFilepath),
                    projectionCacheStore.getStats(cacheFilename)
                ])

                // If cache exists and is newer than source, verify projected files exist before using cache
                if (sourceStats && cacheStats && cacheStats.mtime >= sourceStats.mtime && projectionCacheStore.readFile) {
                    const cacheContent = await projectionCacheStore.readFile(cacheFilename)
                    if (cacheContent) {
                        const cachedData = JSON.parse(cacheContent)

                        // Check if ALL projection files exist (main + mapped)
                        const context = buildProjectionContext(capsule, spineContractUri, capsules)
                        let allProjectedFilesExist = true

                        // First, check if the MAIN projection file exists
                        const mainProjectionPath = cachedData.snapshotData?.spineContracts?.[spineContractUri]?.['#@stream44.studio/encapsulate/structs/Capsule']?.projectedCapsuleFilepath
                        if (mainProjectionPath && projectionStore?.getStats) {
                            const mainStats = await projectionStore.getStats(mainProjectionPath)
                            if (!mainStats) {
                                allProjectedFilesExist = false
                            }
                        }

                        // Then check if mapped capsule projection paths exist
                        if (allProjectedFilesExist) {
                            for (const mapped of context.mappedCapsules) {
                                if (projectionStore?.getStats) {
                                    const stats = await projectionStore.getStats(mapped.projectionPath)
                                    if (!stats) {
                                        allProjectedFilesExist = false
                                        break
                                    }
                                }
                            }
                        }

                        if (allProjectedFilesExist) {
                            // Restore snapshotValues from cache
                            Object.assign(snapshotValues, merge(snapshotValues, cachedData.snapshotData))
                            timing?.record(`Projector: Cache HIT for ${capsule.cst.source.moduleUri || capsule.cst.source.moduleFilepath}`)
                            return true
                        } else {
                            timing?.record(timing?.chalk?.yellow?.(`Projector: Cache INVALID (projected files missing) for ${capsule.cst.source.moduleUri || capsule.cst.source.moduleFilepath}`))
                        }
                    }
                }

                // Recursively project all mapped capsules first
                if (capsules) {
                    // Look through all capsules to find ones that are mapped by this capsule
                    for (const [key, potentialMappedCapsule] of Object.entries(capsules)) {
                        // Skip the current capsule
                        if (potentialMappedCapsule === capsule) continue

                        // Check if this capsule has the Capsule struct (meaning it should be projected)
                        if (potentialMappedCapsule.cst?.spineContracts?.[spineContractUri]?.propertyContracts?.['#@stream44.studio/encapsulate/structs/Capsule']) {
                            // Check if this capsule's moduleUri is referenced in any mapping property
                            const mappedModulePath = potentialMappedCapsule.cst.source.moduleFilepath

                            for (const [propContractKey, propContract] of Object.entries(spineContract.propertyContracts)) {
                                if (propContractKey.startsWith('#') && (propContract as any).properties) {
                                    for (const [propName, propDef] of Object.entries((propContract as any).properties)) {
                                        const prop = propDef as any
                                        if (prop.type === 'CapsulePropertyTypes.Mapping') {
                                            const mappingValue = prop.valueExpression?.replace(/['"]/g, '')
                                            // Check if this mapping points to the potential mapped capsule
                                            if (mappingValue && mappedModulePath && (
                                                mappedModulePath.endsWith(mappingValue + '.ts') ||
                                                mappedModulePath.endsWith(mappingValue + '.tsx') ||
                                                mappedModulePath.includes(mappingValue.replace('./', ''))
                                            )) {
                                                await projectCapsule({ capsule: potentialMappedCapsule, capsules, snapshotValues, spineContractUri, projectingCapsules })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                timing?.record(timing?.chalk?.red?.(`Projector: Cache MISS for ${capsule.cst.source.moduleUri || capsule.cst.source.moduleFilepath}`))
            } catch (error) {
                // Cache miss or error, proceed with projection
            }
        }

        const context = buildProjectionContext(capsule, spineContractUri, capsules)

        // Set projectedCapsuleFilepath in snapshotValues using buildCapsuleSnapshotForReference
        const snapshotData = await buildCapsuleSnapshotForReference({ value: capsule.cst }, capsules, spineContractUri)
        Object.assign(snapshotValues, merge(snapshotValues, snapshotData))

        // Retrieve the filepath from snapshotValues
        const filepath = snapshotValues.spineContracts[spineContractUri]['#@stream44.studio/encapsulate/structs/Capsule'].projectedCapsuleFilepath

        // Helper: Rewrite capsule expression to inline CST using regex
        function rewriteCapsuleExpressionWithCST(targetCapsule: any): string {
            let expression = targetCapsule.cst.source.capsuleExpression || ''

            const cstJson = JSON.stringify(targetCapsule.cst, null, 4)
            const crtJson = JSON.stringify(targetCapsule.crt || {}, null, 4)
            const moduleUri = targetCapsule.cst.source.moduleUri
            const importStackLine = targetCapsule.cst.source.importStackLine

            // Replace importMeta: import.meta with moduleFilepath: '...' (using npm URI)
            expression = expression.replace(
                /importMeta:\s*import\.meta/g,
                `moduleFilepath: '${moduleUri}'`
            )

            // Replace importStack: makeImportStack() with importStackLine: ..., crt: {...}, cst: {...}
            expression = expression.replace(
                /importStack:\s*makeImportStack\(\)/g,
                `importStackLine: ${importStackLine}, crt: ${crtJson}, cst: ${cstJson}`
            )

            // Remove ambientReferences from the expression since they're handled separately
            // Match: ambientReferences: { ... } including multi-line with proper brace matching
            expression = expression.replace(
                /,?\s*ambientReferences:\s*\{[\s\S]*?\}/gm,
                ''
            )

            return expression
        }

        let capsuleExpression = rewriteCapsuleExpressionWithCST(capsule)

        let ambientReferences = capsule.cst.source.ambientReferences || {}

        // Helper: Process CSS files for a capsule with mode-aware path resolution
        async function processCssFiles(
            targetCapsule: any,
            mode: WriteMode,
            targetPath: string | null,
            sourceModuleFilepath: string
        ): Promise<Record<string, string>> {
            const cssImportMapping: Record<string, string> = {}
            const capsuleAmbientRefs = targetCapsule.source?.ambientReferences || {}

            for (const [name, ref] of Object.entries(capsuleAmbientRefs)) {
                const refTyped = ref as any
                if (refTyped.type === 'import' && refTyped.moduleUri.endsWith('.css')) {
                    const originalCssPath = refTyped.moduleUri
                    const cssBasename = basename(originalCssPath, '.css')

                    // Generate CSS paths based on mode
                    let cssFilePath: string
                    let cssImportPath: string

                    if (mode === 'temp') {
                        // Temp mode: use hash-based naming
                        cssFilePath = `./.~capsule-${targetCapsule.capsuleSourceNameRefHash.substring(0, 8)}-${cssBasename}.css`
                        cssImportPath = cssFilePath
                    } else {
                        // Projection mode: use target path-based naming
                        if (targetPath) {
                            const targetDir = dirname(targetPath)
                            const targetBase = basename(targetPath, '.tsx').replace(/\.ts$/, '')
                            cssFilePath = `${targetDir}/${targetBase}-${cssBasename}.css`
                            // Import path should be relative with ./ prefix
                            cssImportPath = `./${targetBase}-${cssBasename}.css`
                        } else {
                            // Fallback to temp naming
                            cssFilePath = `./.~capsule-${targetCapsule.capsuleSourceNameRefHash.substring(0, 8)}-${cssBasename}.css`
                            cssImportPath = cssFilePath
                        }
                    }

                    // Read source CSS file
                    try {
                        const sourceModuleDir = dirname(join(spineFilesystemRoot, sourceModuleFilepath))
                        const sourceCssPath = join(sourceModuleDir, originalCssPath)
                        const cssContent = await readFile(sourceCssPath, 'utf-8')

                        // Write CSS file based on mode
                        if (mode === 'temp') {
                            // Write relative to source module directory
                            const sourceDir = dirname(sourceModuleFilepath)
                            const relativeCssPath = join(sourceDir, cssFilePath)
                            await spineStore.writeFile(relativeCssPath, cssContent)
                        } else if (projectionStore) {
                            await projectionStore.writeFile(cssFilePath, cssContent)
                        }

                        cssImportMapping[originalCssPath] = cssImportPath
                    } catch (error) {
                        console.warn(`Warning: Could not copy CSS file ${originalCssPath}:`, error)
                    }
                }
            }

            return cssImportMapping
        }

        // Process CSS files for temp mode
        const cssImportMapping = await processCssFiles(
            capsule.cst,
            'temp',
            null,
            capsule.cst.source.moduleFilepath
        )

        // Exclude makeImportStack from ambient references since it's being replaced with importStackLine
        if (ambientReferences['makeImportStack']) {
            ambientReferences = { ...ambientReferences }
            delete ambientReferences['makeImportStack']
        }

        // Compute the relative path from the projected caps file directory
        // back to the original source file directory so that relative imports
        // in the caps file resolve to the original source location.
        const absSourceDir = dirname(join(spineFilesystemRoot, capsule.cst.source.moduleFilepath))
        const projectionRoot = capsuleModuleProjectionRoot || spineFilesystemRoot
        const absCapsDir = dirname(join(projectionRoot, filepath))
        const capsToSourcePrefix = relative(absCapsDir, absSourceDir)
        function rewriteRelativeModuleUri(moduleUri: string): string {
            if (!moduleUri.startsWith('./') && !moduleUri.startsWith('../')) return moduleUri
            return capsToSourcePrefix + '/' + moduleUri.replace(/^\.\//, '')
        }

        const importStatements = Object.entries(ambientReferences)
            .map(([name, ref]: [string, any]) => {
                if (ref.type === 'import') {
                    // Check if this is a CSS import (moduleUri ends with .css)
                    if (ref.moduleUri.endsWith('.css')) {
                        // Use the mapped CSS path if available
                        const cssPath = cssImportMapping[ref.moduleUri] || ref.moduleUri
                        return `import '${cssPath}'`
                    }
                    return `import ${ref.importSpecifier} from '${rewriteRelativeModuleUri(ref.moduleUri)}'`
                }
                if (ref.type === 'assigned') {
                    // If the assignment comes from a spine-factory module, import from encapsulate.ts instead
                    if (ref.moduleUri.includes('/spine-factories/')) {
                        return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                    }
                }
                if (ref.type === 'invocation-argument') {
                    // Only import if it's an available encapsulate export
                    if (ref.isEncapsulateExport) {
                        return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                    }
                }
                return ''
            })
            .filter(Boolean)
            .join('\n')

        const literalReferences = Object.entries(ambientReferences)
            .map(([name, ref]: [string, any]) => {
                if (ref.type === 'literal') {
                    return `const ${name} = ${JSON.stringify(ref.value)}`
                }
                return ''
            })
            .filter(Boolean)
            .join('\n')

        const instanceInitializationsPromises = Object.entries(ambientReferences)
            .map(async ([name, ref]: [string, any]) => {
                if (ref.type === 'capsule') {
                    const capsuleSnapshot = await buildCapsuleSnapshotForReference(ref, capsules, spineContractUri)
                    return `const ${name}_fn = await loadCapsule({ capsuleSnapshot: ${JSON.stringify(capsuleSnapshot, null, 4)} })\n    const ${name} = await ${name}_fn({ encapsulate, loadCapsule })`
                }
                return ''
            })
        const instanceInitializations = (await Promise.all(instanceInitializationsPromises))
            .filter(Boolean)
            .join('\n    ')

        // Extract module-local code for functions marked as 'module-local'
        const moduleLocalCode = capsule.cst.source.moduleLocalCode || {}
        const moduleLocalFunctions = Object.entries(moduleLocalCode)
            .map(([name, code]: [string, any]) => code)
            .filter(Boolean)
            .join('\n\n')

        const allStatements = [importStatements, literalReferences, moduleLocalFunctions].filter(Boolean).join('\n')

        // Check if this capsule has an encapsulate.dev/standalone property
        const hasStandalone = hasStandaloneProperty(capsule, spineContractUri)

        // Add runtime imports for standalone functions
        const runtimeImport = hasStandalone ? `"use client"\nimport { Spine, SpineRuntime } from '@stream44.studio/encapsulate/encapsulate'\nimport { CapsuleSpineContract } from '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0/Membrane.v0'\n` : ''

        // Generate default export based on capsule type
        let defaultExport = ''
        if (hasStandalone) {
            // Generate a wrapper function that directly invokes the standalone function
            const capsuleSourceLineRef = capsule.cst.capsuleSourceLineRef

            // Collect all capsule URIs from CST (mappings and property contracts)
            const allCapsuleUris = collectAllCapsuleUris(capsule, spineContractUri)

            // Also collect from ambient references
            for (const [name, ref] of Object.entries(ambientReferences)) {
                const refTyped = ref as any
                if (refTyped.type === 'capsule') {
                    const snapshot = await buildCapsuleSnapshotForReference(refTyped, capsules, spineContractUri)
                    const contractData = snapshot.spineContracts?.[spineContractUri]
                    const structKey = Object.keys(contractData || {}).find(k => k.includes('/structs/Capsule'))
                    const capsuleName = structKey ? contractData[structKey]?.capsuleName : undefined
                    if (capsuleName) {
                        allCapsuleUris.add(capsuleName)
                    }
                }
            }

            // Build import paths from snapshots for ALL collected URIs
            const capsuleDeps: Array<{ uri: string, importName: string, importPath: string }> = []
            for (const uri of allCapsuleUris) {
                // Find the capsule in the registry and build its snapshot
                let capsuleRef = null
                if (capsules) {
                    for (const [key, cap] of Object.entries(capsules)) {
                        const capCapsuleName = cap.cst?.source?.capsuleName
                        if (capCapsuleName === uri) {
                            capsuleRef = { type: 'capsule', value: cap.cst }
                            break
                        }
                    }
                }

                if (capsuleRef) {
                    const snapshot = await buildCapsuleSnapshotForReference(capsuleRef, capsules, spineContractUri)
                    const contractData = snapshot.spineContracts?.[spineContractUri]
                    const structKey = Object.keys(contractData || {}).find(k => k.includes('/structs/Capsule'))
                    const projectedFilepath = structKey ? contractData[structKey]?.projectedCapsuleFilepath : undefined

                    if (projectedFilepath) {
                        // Build import path from projected filepath
                        const importName = `_capsule_${uri.replace(/[^a-zA-Z0-9]/g, '_')}`
                        // Remove .~o/encapsulate.dev/caps/ prefix and strip extension
                        const importPath = projectedFilepath.replace(/^\.~o\/encapsulate\.dev\/caps\//, '').replace(/\.(ts|tsx)$/, '')

                        capsuleDeps.push({ uri, importName, importPath })
                    }
                }
            }

            // Generate static imports for all capsule dependencies
            // Compute relative path from projected file to caps directory
            let importPrefix: string
            if (capsuleModuleProjectionPackage) {
                importPrefix = capsuleModuleProjectionPackage
            } else {
                const projectedFileDir = dirname(filepath)
                const capsDir = '.~o/encapsulate.dev/caps'
                const relativePathToCaps = relative(projectedFileDir, capsDir)
                importPrefix = relativePathToCaps.startsWith('.') ? relativePathToCaps : './' + relativePathToCaps
            }
            const capsuleImports = capsuleDeps.map(dep =>
                `import * as ${dep.importName} from '${importPrefix}/${dep.importPath}'`
            ).join('\n')

            // Generate capsules map
            const capsulesMapEntries = capsuleDeps.map(dep =>
                `    '${dep.uri}': ${dep.importName}`
            ).join(',\n')

            defaultExport = `
${capsuleImports}

// Export standalone function - directly invoke the capsule API
export default async function({ onMembraneEvent }: { onMembraneEvent?: (event: any) => void } = {}) {
    // Use sourceSpine pattern like the factory to provide real encapsulate
    const sourceSpine: { encapsulate?: any } = {}
    
    // Map of statically imported capsules
    const capsulesMap: Record<string, any> = {
${capsulesMapEntries}
    }
    
    // Helper to import and instantiate a capsule from the capsules map
    const importCapsule = async (uri: string) => {
        const capsuleModule = capsulesMap[uri]
        if (!capsuleModule) {
            throw new Error(\`Capsule not found in static imports: \${uri}\`)
        }
        const capsule = await capsuleModule.capsule({
            encapsulate: sourceSpine.encapsulate,
            CapsulePropertyTypes,
            loadCapsule
        })
        return capsule
    }
    
    const loadCapsule = async ({ capsuleSourceLineRef, capsuleName }: any) => {
        // Return the capsule function from this projected file
        if (capsuleSourceLineRef === '${capsuleSourceLineRef}') {
            return capsule
        }
        
        // Use capsuleName directly if provided
        if (capsuleName) {
            return await importCapsule(capsuleName)
        }
        
        throw new Error(\`Cannot load capsule: \${capsuleSourceLineRef}\`)
    }
    
    const spineContractOpts = {
        spineFilesystemRoot: '.',
        resolve: async (uri: string) => uri,
        importCapsule,
        ...(onMembraneEvent ? { onMembraneEvent } : {})
    }
    
    const runtimeSpineContracts = {
        ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract(spineContractOpts)
    }
    
    const snapshot = {
        capsules: {
            ['${capsuleSourceLineRef}']: {
                spineContracts: {}
            }
        }
    }
    
    const { run, encapsulate } = await SpineRuntime({ 
        spineFilesystemRoot: '.', 
        spineContracts: runtimeSpineContracts,
        snapshot,
        loadCapsule
    })
    
    // Populate sourceSpine.encapsulate so imported capsules can use it
    sourceSpine.encapsulate = encapsulate
    
    const result = await run({}, async ({ apis }) => {
        const capsuleApi = apis['${capsuleSourceLineRef}']
        const standaloneKey = Object.keys(capsuleApi).find(k => k === 'encapsulate.dev/standalone' || k.startsWith('encapsulate.dev/standalone/'))
        if (!standaloneKey) throw new Error('encapsulate.dev/standalone property not found')
        const standaloneFunc = capsuleApi[standaloneKey]()
        return standaloneFunc()
    })
    
    return result
}
`
        }

        // Prepare literal references with proper indentation
        const indentedLiteralRefs = literalReferences ? literalReferences.split('\n').map(line => line ? `    ${line}` : '').join('\n') + '\n' : ''
        const indentedInstanceInits = instanceInitializations ? '    ' + instanceInitializations.split('\n').join('\n    ') + '\n' : ''

        const fileContent = `${runtimeImport}${importStatements}
${moduleLocalFunctions}

export async function capsule({ encapsulate, loadCapsule }: { encapsulate: any, loadCapsule: any }) {
${indentedLiteralRefs}${indentedInstanceInits}    return ${capsuleExpression}
}
capsule['#'] = ${JSON.stringify(capsule.cst.source.capsuleName || '')}
${defaultExport}
`
        // Write to projection store
        if (projectionStore) {
            await projectionStore.writeFile(filepath, fileContent)
        }

        // If this capsule has a custom projection path, also write there
        if (context.customProjectionPath) {
            // Process CSS files for projection mode
            const projectionCssMapping = await processCssFiles(
                capsule.cst,
                'projection',
                context.customProjectionPath,
                capsule.cst.source.moduleFilepath
            )

            // Update import statements to use projection CSS paths
            const projectionImportStatements = Object.entries(ambientReferences)
                .map(([name, ref]: [string, any]) => {
                    if (ref.type === 'import') {
                        if (ref.moduleUri.endsWith('.css')) {
                            const cssPath = projectionCssMapping[ref.moduleUri] || ref.moduleUri
                            return `import '${cssPath}'`
                        }
                        return `import ${ref.importSpecifier} from '${ref.moduleUri}'`
                    }
                    if (ref.type === 'assigned') {
                        if (ref.moduleUri.includes('/spine-factories/')) {
                            return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                        }
                    }
                    if (ref.type === 'invocation-argument') {
                        // Only import if it's an available encapsulate export
                        if (ref.isEncapsulateExport) {
                            return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                        }
                    }
                    return ''
                })
                .filter(Boolean)
                .join('\n')

            const projectionAllStatements = [projectionImportStatements, literalReferences].filter(Boolean).join('\n')
            const projectionFileContent = `${runtimeImport}${projectionAllStatements}

export async function capsule({ encapsulate, loadCapsule }: { encapsulate: any, loadCapsule: any }) {
${instanceInitializations}
return ${capsuleExpression}
}
capsule['#'] = ${JSON.stringify(capsule.cst.source.capsuleName || '')}
${defaultExport}
`
            if (projectionStore) {
                await projectionStore.writeFile(context.customProjectionPath, projectionFileContent)
            }
        }

        // Write mapped capsules to their projection paths
        for (const mapped of context.mappedCapsules) {
            // Get the full mapped capsule from the registry using its hash
            if (!capsules) {
                console.warn(`Warning: Cannot write mapped capsule - no capsules registry provided`)
                continue
            }

            // Find the capsule in the registry by matching the hash
            let mappedCapsule = null
            for (const [key, cap] of Object.entries(capsules)) {
                if (cap.cst?.capsuleSourceNameRefHash === mapped.capsuleHash) {
                    mappedCapsule = cap
                    break
                }
            }

            if (!mappedCapsule) {
                console.warn(`Warning: Mapped capsule with hash ${mapped.capsuleHash} not found in registry`)
                continue
            }

            // Process CSS files for the mapped capsule in projection mode
            const mappedCssMapping = await processCssFiles(
                mappedCapsule.cst,
                'projection',
                mapped.projectionPath,
                mappedCapsule.cst.source.moduleFilepath
            )

            // Get ambient references for the mapped capsule, excluding makeImportStack
            let mappedAmbientRefs = mappedCapsule.cst.source?.ambientReferences || {}
            if (mappedAmbientRefs['makeImportStack']) {
                mappedAmbientRefs = { ...mappedAmbientRefs }
                delete mappedAmbientRefs['makeImportStack']
            }

            // Generate import statements with projection CSS paths
            const mappedImportStatements = Object.entries(mappedAmbientRefs)
                .map(([name, ref]: [string, any]) => {
                    if (ref.type === 'import') {
                        if (ref.moduleUri.endsWith('.css')) {
                            const cssPath = mappedCssMapping[ref.moduleUri] || ref.moduleUri
                            return `import '${cssPath}'`
                        }
                        return `import ${ref.importSpecifier} from '${ref.moduleUri}'`
                    }
                    if (ref.type === 'assigned') {
                        if (ref.moduleUri.includes('/spine-factories/')) {
                            return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                        }
                    }
                    if (ref.type === 'invocation-argument') {
                        // Only import if it's an available encapsulate export
                        if (ref.isEncapsulateExport) {
                            return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                        }
                    }
                    return ''
                })
                .filter(Boolean)
                .join('\n')

            const mappedLiteralReferences = Object.entries(mappedAmbientRefs)
                .map(([name, ref]: [string, any]) => {
                    if (ref.type === 'literal') {
                        return `const ${name} = ${JSON.stringify(ref.value)}`
                    }
                    return ''
                })
                .filter(Boolean)
                .join('\n')

            const mappedInstanceInitializationsPromises = Object.entries(mappedAmbientRefs)
                .map(async ([name, ref]: [string, any]) => {
                    if (ref.type === 'capsule') {
                        const capsuleSnapshot = await buildCapsuleSnapshotForReference(ref, capsules, spineContractUri)
                        return `const ${name}_fn = await loadCapsule({ capsuleSnapshot: ${JSON.stringify(capsuleSnapshot, null, 4)} })\n    const ${name} = await ${name}_fn({ encapsulate, loadCapsule })`
                    }
                    return ''
                })
            const mappedInstanceInitializations = (await Promise.all(mappedInstanceInitializationsPromises))
                .filter(Boolean)
                .join('\n    ')

            // Extract module-local code for mapped capsule
            const mappedModuleLocalCode = mappedCapsule.cst.source?.moduleLocalCode || {}
            const mappedModuleLocalFunctions = Object.entries(mappedModuleLocalCode)
                .map(([name, code]: [string, any]) => code)
                .filter(Boolean)
                .join('\n\n')

            const mappedAllStatements = [mappedImportStatements, mappedLiteralReferences, mappedModuleLocalFunctions].filter(Boolean).join('\n')

            // Check if mapped capsule has encapsulate.dev/standalone property
            const mappedHasStandalone = hasStandaloneProperty(mappedCapsule, spineContractUri)

            // Rewrite the mapped capsule expression to include CST (reuse the same function)
            const mappedCapsuleExpression = rewriteCapsuleExpressionWithCST(mappedCapsule)

            // Add runtime imports for standalone functions
            const mappedRuntimeImport = mappedHasStandalone ? `"use client"\nimport { Spine, SpineRuntime } from '@stream44.studio/encapsulate/encapsulate'\nimport { CapsuleSpineContract } from '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0/Membrane.v0'\n` : ''

            let mappedDefaultExport = ''
            if (mappedHasStandalone) {
                // Generate a wrapper function that directly invokes the standalone function
                const mappedCapsuleSourceLineRef = mappedCapsule.cst.capsuleSourceLineRef

                // Collect all capsule URIs from CST (mappings and property contracts)
                const allMappedCapsuleUris = collectAllCapsuleUris(mappedCapsule, spineContractUri)

                // Also collect from ambient references
                for (const [name, ref] of Object.entries(mappedAmbientRefs)) {
                    const refTyped = ref as any
                    if (refTyped.type === 'capsule') {
                        const snapshot = await buildCapsuleSnapshotForReference(refTyped, capsules, spineContractUri)
                        const contractData = snapshot.spineContracts?.[spineContractUri]
                        const structKey = Object.keys(contractData || {}).find(k => k.includes('/structs/Capsule'))
                        const capsuleName = structKey ? contractData[structKey]?.capsuleName : undefined
                        if (capsuleName) {
                            allMappedCapsuleUris.add(capsuleName)
                        }
                    }
                }

                // Build capsule dependencies array
                const mappedCapsuleDeps: Array<{ uri: string, importName: string, importPath: string }> = []
                for (const uri of allMappedCapsuleUris) {
                    const importName = `_capsule_${uri.replace(/[^a-zA-Z0-9]/g, '_')}`
                    // Strip leading @ to match caps filesystem paths
                    const importPath = uri.startsWith('@') ? uri.substring(1) : uri
                    mappedCapsuleDeps.push({ uri, importName, importPath })
                }

                // Generate static imports for all capsule dependencies
                // Compute relative path from projected file to caps directory
                let importPrefix: string
                if (capsuleModuleProjectionPackage) {
                    importPrefix = capsuleModuleProjectionPackage
                } else {
                    const projectedFileDir = dirname(mapped.projectionPath)
                    const capsDir = '.~o/encapsulate.dev/caps'
                    const relativePathToCaps = relative(projectedFileDir, capsDir)
                    importPrefix = relativePathToCaps.startsWith('.') ? relativePathToCaps : './' + relativePathToCaps
                }
                const mappedCapsuleImports = mappedCapsuleDeps.map(dep =>
                    `import * as ${dep.importName} from '${importPrefix}/${dep.importPath}'`
                ).join('\n')

                // Generate capsules map
                const mappedCapsulesMapEntries = mappedCapsuleDeps.map(dep =>
                    `    '${dep.uri}': ${dep.importName}`
                ).join(',\n')

                mappedDefaultExport = `
${mappedCapsuleImports}

// Export standalone function - directly invoke the capsule API
export default async function({ onMembraneEvent }: { onMembraneEvent?: (event: any) => void } = {}) {
    // Use sourceSpine pattern like the factory to provide real encapsulate
    const sourceSpine: { encapsulate?: any } = {}

    // Map of statically imported capsules
    const capsulesMap: Record<string, any> = {
${mappedCapsulesMapEntries}
    }

    // Helper to import and instantiate a capsule from the capsules map
    const importCapsule = async (uri: string) => {
        const capsuleModule = capsulesMap[uri]
        if (!capsuleModule) {
            throw new Error(\`Capsule not found in static imports: \${uri}\`)
        }
        const capsule = await capsuleModule.capsule({
            encapsulate: sourceSpine.encapsulate,
            CapsulePropertyTypes,
            loadCapsule
        })
        return capsule
    }

    const loadCapsule = async ({ capsuleSourceLineRef, capsuleName }: any) => {
        // Return the capsule function from this projected file
        if (capsuleSourceLineRef === '${mappedCapsuleSourceLineRef}') {
            return capsule
        }

        // Use capsuleName directly if provided
        if (capsuleName) {
            return await importCapsule(capsuleName)
        }

        throw new Error(\`Cannot load capsule: \${capsuleSourceLineRef}\`)
    }

    const spineContractOpts = {
        spineFilesystemRoot: '.',
        resolve: async (uri: string) => uri,
        importCapsule,
        ...(onMembraneEvent ? { onMembraneEvent } : {})
    }

    const runtimeSpineContracts = {
        ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract(spineContractOpts)
    }

    const snapshot = {
        capsules: {
            ['${mappedCapsuleSourceLineRef}']: {
                spineContracts: {}
            }
        }
    }
    
    const { run, encapsulate } = await SpineRuntime({ 
        spineFilesystemRoot: '.', 
        spineContracts: runtimeSpineContracts,
        snapshot,
        loadCapsule
    })
    
    // Populate sourceSpine.encapsulate so imported capsules can use it
    sourceSpine.encapsulate = encapsulate
    
    const result = await run({}, async ({ apis }) => {
        const capsuleApi = apis['${mappedCapsuleSourceLineRef}']
        const standaloneKey = Object.keys(capsuleApi).find(k => k === 'encapsulate.dev/standalone' || k.startsWith('encapsulate.dev/standalone/'))
        if (!standaloneKey) throw new Error('encapsulate.dev/standalone property not found')
        const standaloneFunc = capsuleApi[standaloneKey]()
        return standaloneFunc()
    })
    
    return result
}
`
            }

            const mappedFileContent = `${mappedRuntimeImport}${mappedAllStatements}

export async function capsule({ encapsulate, loadCapsule }: { encapsulate: any, loadCapsule: any }) {
${mappedInstanceInitializations}
return ${mappedCapsuleExpression}
}
capsule['#'] = ${JSON.stringify(mappedCapsule.cst.source.capsuleName || '')}
${mappedDefaultExport}
`

            // Write mapped capsule to projection path
            if (projectionStore) {
                await projectionStore.writeFile(mapped.projectionPath, mappedFileContent)
            }
        }

        // Write projection cache metadata for main capsule
        if (projectionCacheStore?.writeFile) {
            try {
                const cacheFilePath = await constructCacheFilePath(
                    capsule.cst.source.moduleFilepath,
                    capsule.cst.source.importStackLine,
                    spineFilesystemRoot
                )
                const cacheFilename = `${cacheFilePath}.projection.json`
                const cacheData = {
                    snapshotData: await buildCapsuleSnapshotForReference({ value: capsule.cst }, capsules, spineContractUri)
                }
                await projectionCacheStore.writeFile(cacheFilename, JSON.stringify(cacheData, null, 2))
            } catch (error) {
                // Cache write error, continue without failing
                console.warn(`Warning: Failed to write projection cache for ${capsule.cst.source.moduleUri || capsule.cst.source.moduleFilepath}:`, error)
            }
        }

        // Write projection cache AND project ALL capsules in the registry to .~o/encapsulate.dev/caps
        // This includes struct definitions, property contract capsules, and any other capsules
        if (projectionCacheStore?.writeFile && capsules) {
            for (const [capsuleKey, registryCapsule] of Object.entries(capsules)) {
                // Skip if this is the main capsule we already processed
                if (registryCapsule === capsule) {
                    continue
                }

                // Skip if this capsule doesn't have the required CST structure
                if (!registryCapsule.cst?.source?.moduleFilepath || !registryCapsule.cst?.source?.importStackLine) {
                    continue
                }

                try {
                    // Write projection cache
                    const capsuleCacheFilePath = await constructCacheFilePath(
                        registryCapsule.cst.source.moduleFilepath,
                        registryCapsule.cst.source.importStackLine,
                        spineFilesystemRoot
                    )
                    const capsuleCacheFilename = `${capsuleCacheFilePath}.projection.json`
                    const capsuleCacheData = {
                        snapshotData: await buildCapsuleSnapshotForReference({ value: registryCapsule.cst }, capsules, spineContractUri)
                    }
                    await projectionCacheStore.writeFile(capsuleCacheFilename, JSON.stringify(capsuleCacheData, null, 2))

                    // Also project the capsule to .~o/encapsulate.dev/caps
                    const projectedPath = capsuleCacheData.snapshotData.spineContracts[spineContractUri]['#@stream44.studio/encapsulate/structs/Capsule'].projectedCapsuleFilepath

                    // Generate the capsule file content with proper imports and ambient reference loading
                    const capsuleExpression = rewriteCapsuleExpressionWithCST(registryCapsule)

                    // Get ambient references for this capsule
                    const capsuleAmbientRefs = registryCapsule.cst.source?.ambientReferences || {}

                    // Generate literal references
                    const capsuleLiteralRefs = Object.entries(capsuleAmbientRefs)
                        .map(([name, ref]: [string, any]) => {
                            if (ref.type === 'literal') {
                                return `const ${name} = ${JSON.stringify(ref.value)}`
                            }
                            return ''
                        })
                        .filter(Boolean)
                        .join('\n')

                    // Generate instance initializations for ambient references
                    const capsuleInstanceInitPromises = Object.entries(capsuleAmbientRefs)
                        .map(async ([name, ref]: [string, any]) => {
                            if (ref.type === 'capsule') {
                                const capsuleSnapshot = await buildCapsuleSnapshotForReference(ref, capsules, spineContractUri)
                                return `const ${name}_fn = await loadCapsule({ capsuleSnapshot: ${JSON.stringify(capsuleSnapshot, null, 4)} })\n    const ${name} = await ${name}_fn({ encapsulate, loadCapsule })`
                            }
                            return ''
                        })
                    const capsuleInstanceInits = (await Promise.all(capsuleInstanceInitPromises))
                        .filter(Boolean)
                        .join('\n    ')

                    // Filter out makeImportStack from ambient references (same as main capsule path)
                    let filteredCapsuleAmbientRefs = capsuleAmbientRefs
                    if (filteredCapsuleAmbientRefs['makeImportStack']) {
                        filteredCapsuleAmbientRefs = { ...filteredCapsuleAmbientRefs }
                        delete filteredCapsuleAmbientRefs['makeImportStack']
                    }

                    // Generate imports from filtered ambient references
                    const capsuleImportStatements = Object.entries(filteredCapsuleAmbientRefs)
                        .map(([name, ref]: [string, any]) => {
                            if (ref.type === 'import') {
                                if (ref.moduleUri.endsWith('.css')) {
                                    return `import '${ref.moduleUri}'`
                                }
                                return `import ${ref.importSpecifier} from '${ref.moduleUri}'`
                            }
                            if (ref.type === 'assigned') {
                                if (ref.moduleUri.includes('/spine-factories/')) {
                                    return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                                }
                            }
                            if (ref.type === 'invocation-argument') {
                                if (ref.isEncapsulateExport) {
                                    return `import { ${name} } from '@stream44.studio/encapsulate/encapsulate'`
                                }
                            }
                            return ''
                        })
                        .filter(Boolean)
                        .join('\n')

                    const imports = capsuleImportStatements ? capsuleImportStatements + '\n' : ''

                    // Get the capsule name for the assignment
                    const capsuleName = registryCapsule.cst.source.capsuleName || ''

                    // Combine literal refs and instance inits with proper indentation
                    const indentedLiterals = capsuleLiteralRefs ? capsuleLiteralRefs.split('\n').map(line => `    ${line}`).join('\n') + '\n' : ''
                    const indentedInits = capsuleInstanceInits ? '    ' + capsuleInstanceInits + '\n' : ''

                    const capsuleFileContent = `${imports}
export async function capsule({ encapsulate, loadCapsule }: { encapsulate: any, loadCapsule: any }) {
${indentedLiterals}${indentedInits}    return ${capsuleExpression}
}
capsule['#'] = ${JSON.stringify(capsuleName)}
`

                    if (projectionStore) {
                        await projectionStore.writeFile(projectedPath, capsuleFileContent)
                    }
                } catch (error) {
                    console.warn(`Warning: Failed to write projection cache for capsule ${registryCapsule.cst.source.moduleUri || registryCapsule.cst.source.moduleFilepath}:`, error)
                }
            }
        }

        return true
    }

    return {
        projectCapsule
    }
}
