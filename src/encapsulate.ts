
// CACHE_BUST_VERSION: Increment this whenever CST cache must be invalidated due to structural changes
// This ensures projected capsules are regenerated when the CST format changes
const CACHE_BUST_VERSION = 11

type TSpineOptions = {
    spineFilesystemRoot?: string,
    spineContracts: Record<string, any>,
    staticAnalyzer?: any,
    timing?: { record: (step: string) => void, chalk?: any }
}

type TSpineRunOptions = {
    overrides?: Record<string, any>,
    options?: Record<string, any>
}

type TSpineRootsInvocationHandler = (context: { apis: Record<string, any>, capsules?: Record<string, any> }) => Promise<any>

type TSpine = {
    freeze: () => Promise<TSpineSnapshot>,
    encapsulate: (definition: TCapsuleDefinition, options: TCapsuleOptions) => Promise<TCapsule>,
    capsules: Record<string, any>
}

type TSpineSnapshot = {
    capsules: Record<string, Record<string, any>>
}

type TSpineRuntime = {
    run: (options: TSpineRunOptions, handler: TSpineRootsInvocationHandler) => Promise<any>
}

type TSpineRuntimeOptions = {
    spineFilesystemRoot?: string,
    spineContracts?: Record<string, any>,
    snapshot?: TSpineSnapshot,
    capsules?: Record<string, any>,
    loadCapsule?: (options: { capsuleSourceLineRef: string, capsuleSnapshot: any, capsuleName?: string, cacheBustVersion?: number }) => Promise<any>
}

type TCapsuleSnapshot = {
    cst: any,
    spineContracts: Record<string, any>
}

type TCapsuleMakeInstanceOptions = {
    overrides?: Record<string, any>,
    options?: Record<string, any>,
    runtimeSpineContracts?: Record<string, any>,
    sharedSelf?: Record<string, any>,
    rootCapsule?: {
        capsuleName: string,
        capsuleSourceLineRef: string,
        moduleFilepath: string
    }
}

type TCapsule = {
    capsuleSourceLineRef: string,
    definition: TCapsuleDefinition,
    encapsulateOptions: TEncapsulateOptions,
    cst?: any,
    crt?: any,
    makeInstance: (options?: TCapsuleMakeInstanceOptions) => any,
    toCapsuleReference: () => { capsuleSourceLineRef: string, capsuleSourceNameRefHash: any }
}

// Spine contract URI -> Property contract name -> Property definitions
// Property contracts can be empty {} (for struct markers) or contain property definitions
type TCapsuleDefinition = Record<string, Record<string, {} | Record<string, { type: keyof typeof CapsulePropertyTypes, [key: string]: any }>>>

type TCapsuleOptions = {
    importMeta?: {
        url: string
    },
    importStack?: string,
    importStackLine?: number,
    moduleFilepath?: string,
    capsuleName?: string,
    ambientReferences?: Record<string, any>,
    extendsCapsule?: TCapsule | string,
    cst?: any,
    crt?: any
}

type TEncapsulateOptions = {
    moduleFilepath: string,
    importStackLine: number,
    capsuleName?: string,
    ambientReferences?: Record<string, any>,
    extendsCapsule?: TCapsule | string,
    capsuleSourceLineRef: string
}

type TSpineContext = {
    spineOptions: TSpineOptions,
    spineContracts: Record<string, any>,
    capsules: Record<string, any>
}


export const CapsulePropertyTypes = {
    Function: 'Function' as const,
    GetterFunction: 'GetterFunction' as const,
    SetterFunction: 'SetterFunction' as const,
    String: 'String' as const,
    Mapping: 'Mapping' as const,
    Literal: 'Literal' as const,
    Constant: 'Constant' as const,
    StructInit: 'StructInit' as const,
    StructDispose: 'StructDispose' as const,
    Init: 'Init' as const,
    Dispose: 'Dispose' as const,
}

// ##################################################
// # Spine
// ##################################################

export async function SpineRuntime(options: TSpineRuntimeOptions): Promise<TSpineRuntime> {

    const spineContracts = options.spineContracts || {}
    const capsules: Record<string, any> = {}

    const loadedCapsules: Record<string, any> = options.capsules || {}

    const spine = {
        run: async function (
            runOptions: TSpineRunOptions,
            handler: TSpineRootsInvocationHandler
        ): Promise<any> {

            const capsules: Record<string, any> = {}

            const hydratedSnapshots: Record<string, any> = {}

            // Ensure all capsules are hydrated.
            await Promise.all(Object.entries(loadedCapsules).map(async ([capsuleSourceLineRef, capsule]) => {

                const hydratedSnapshot = options.snapshot?.capsules?.[capsuleSourceLineRef]
                if (!hydratedSnapshot) return

                await Promise.all(Object.entries(hydratedSnapshot.spineContracts).map(async ([spineContractUri, capsuleContractSnapshot]) => {
                    hydratedSnapshot.spineContracts[spineContractUri] = spineContracts[spineContractUri].hydrate({
                        capsuleSnapshot: capsuleContractSnapshot
                    })
                }))

                hydratedSnapshots[capsuleSourceLineRef] = hydratedSnapshot
                if (capsule.encapsulateOptions.capsuleName) {
                    hydratedSnapshots[capsule.encapsulateOptions.capsuleName] = hydratedSnapshot
                }
            }))

            // Extract only the spine contract properties from hydrated snapshots
            const hydratedOverrides: Record<string, any> = {}
            for (const [capsuleRef, snapshot] of Object.entries(hydratedSnapshots)) {
                if (snapshot.spineContracts) {
                    // Merge all spine contract properties into a single object for this capsule
                    const capsuleOverrides: Record<string, any> = {}
                    for (const [spineContractUri, spineContractData] of Object.entries(snapshot.spineContracts)) {
                        Object.assign(capsuleOverrides, spineContractData)
                    }
                    hydratedOverrides[capsuleRef] = capsuleOverrides
                }
            }

            const overrides = merge(
                hydratedOverrides,
                runOptions.overrides || {}
            )

            // Helper function to create a proxy that dynamically unwraps .api layers
            function createUnwrappingProxy(obj: any): any {
                if (!obj || typeof obj !== 'object') return obj

                // If this object has an .api property, create a proxy for it
                if (obj.api && typeof obj.api === 'object') {
                    return new Proxy(obj.api, {
                        get: (target: any, prop: string | symbol) => {
                            if (typeof prop === 'symbol') return target[prop]

                            let value = target[prop]

                            // If the value is a raw capsule instance (has spineContractCapsuleInstances
                            // but is NOT a Proxy that handles API access), unwrap it
                            // Static.v0 sets apiTarget[property.name] = mappedInstance (raw)
                            // Membrane.v0 sets apiTarget[property.name] = new Proxy(...) which handles API access
                            if (value && typeof value === 'object' && value.spineContractCapsuleInstances) {
                                // Check if this is a raw capsule instance by seeing if it has .api
                                // and the .api doesn't have the same spineContractCapsuleInstances
                                // (Membrane Proxy would return .api properties, not the raw structure)
                                if (value.api && typeof value.api === 'object' && !value.api.spineContractCapsuleInstances) {
                                    return createUnwrappingProxy(value)
                                }
                            }

                            return value
                        }
                    })
                }

                return obj
            }

            const apis: Record<string, any> = {}

            // Group keys by capsule object to avoid duplicate processing
            const capsuleToKeys = new Map<any, string[]>()
            for (const [key, capsule] of Object.entries(loadedCapsules)) {
                if (!capsuleToKeys.has(capsule)) {
                    capsuleToKeys.set(capsule, [])
                }
                capsuleToKeys.get(capsule)!.push(key)
            }

            // Instantiate each unique capsule once
            for (const [capsule, keys] of capsuleToKeys) {
                const instance = await capsule.makeInstance({
                    overrides,
                    options: runOptions.options?.[keys[0]],
                    runtimeSpineContracts: spineContracts
                })

                // Register instance under all keys that reference this capsule
                for (const key of keys) {
                    capsules[key] = {
                        capsule,
                        instance,
                        makeInstance: undefined
                    }

                    // Create proxy that dynamically unwraps .api layers
                    apis[key] = createUnwrappingProxy(instance)
                }
            }

            // Run StructInit functions for struct capsules and Init functions for non-struct capsules
            // StructInit: fires for struct-mapped capsules and any capsules they extend (top-down)
            // Init: fires for non-struct capsules (those without StructInit)
            const structInitVisited = new Set<any>()
            const structInstances: any[] = []  // Track struct instances for StructDispose
            const nonStructInstances: any[] = []  // Track non-struct instances for Dispose

            async function runStructInits(instance: any, isStructContext: boolean = false) {
                if (!instance || structInitVisited.has(instance)) return
                structInitVisited.add(instance)

                // Determine if this instance is a struct capsule (has StructInit functions)
                const hasStructInit = instance.structInitFunctions?.length > 0
                const isStruct = hasStructInit || isStructContext

                if (isStruct) {
                    // This is a struct capsule - run StructInit
                    structInstances.push(instance)
                    if (instance.structInitFunctions?.length) {
                        for (const fn of instance.structInitFunctions) {
                            await fn()
                        }
                        // Sync self values back to encapsulatedApi for spine contracts that use
                        // direct assignment (e.g. Static contract) rather than getters
                        if (instance.spineContractCapsuleInstances) {
                            for (const sci of Object.values(instance.spineContractCapsuleInstances) as any[]) {
                                if (sci.self && sci.encapsulatedApi) {
                                    for (const key of Object.keys(sci.encapsulatedApi)) {
                                        if (key in sci.self && sci.encapsulatedApi[key] !== sci.self[key]) {
                                            sci.encapsulatedApi[key] = sci.self[key]
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // This is a non-struct capsule - run Init
                    nonStructInstances.push(instance)
                    if (instance.initFunctions?.length) {
                        for (const fn of instance.initFunctions) {
                            await fn()
                        }
                        // Sync self values back to encapsulatedApi
                        if (instance.spineContractCapsuleInstances) {
                            for (const sci of Object.values(instance.spineContractCapsuleInstances) as any[]) {
                                if (sci.self && sci.encapsulatedApi) {
                                    for (const key of Object.keys(sci.encapsulatedApi)) {
                                        if (key in sci.self && sci.encapsulatedApi[key] !== sci.self[key]) {
                                            sci.encapsulatedApi[key] = sci.self[key]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Recurse into extended capsule instance (inherits struct context)
                if (instance.extendedCapsuleInstance) {
                    await runStructInits(instance.extendedCapsuleInstance, isStruct)
                }

                // Recurse into mapped capsule instances (each determines its own struct status)
                if (instance.mappedCapsuleInstances?.length) {
                    for (const mappedInstance of instance.mappedCapsuleInstances) {
                        await runStructInits(mappedInstance, false)
                    }
                }
            }

            for (const [, entry] of Object.entries(capsules)) {
                await runStructInits((entry as any).instance)
            }

            const result = await handler({ apis, capsules })

            // Run StructDispose for struct capsules (reverse order - bottom-up)
            for (let i = structInstances.length - 1; i >= 0; i--) {
                const instance = structInstances[i]
                if (instance.structDisposeFunctions?.length) {
                    for (const fn of instance.structDisposeFunctions) {
                        await fn()
                    }
                }
            }

            // Run Dispose for non-struct capsules (reverse order - bottom-up)
            for (let i = nonStructInstances.length - 1; i >= 0; i--) {
                const instance = nonStructInstances[i]
                if (instance.disposeFunctions?.length) {
                    for (const fn of instance.disposeFunctions) {
                        await fn()
                    }
                }
            }

            // Clear all memoize timeouts to prevent memory leaks
            for (const [, entry] of Object.entries(capsules)) {
                const instance = (entry as any).instance
                if (instance?.spineContractCapsuleInstances) {
                    for (const sci of Object.values(instance.spineContractCapsuleInstances) as any[]) {
                        if (typeof sci.clearMemoizeTimeouts === 'function') {
                            sci.clearMemoizeTimeouts()
                        }
                    }
                }
            }

            return result
        },

        encapsulate: async function (definition: TCapsuleDefinition, encapsulateOptions: TCapsuleOptions): Promise<TCapsule> {

            return encapsulate(definition, encapsulateOptions, {
                spineOptions: {
                    spineFilesystemRoot: options.spineFilesystemRoot,
                    spineContracts,
                    staticAnalyzer: (options as any).staticAnalyzer
                },
                spineContracts,
                capsules
            })
        }
    }

    if (options.snapshot) {

        // NOTE: We can probably generate an optimized initialization tree for use at runtime
        //       that parallel loads as much as possible.
        for (const [capsuleSourceLineRef, capsuleSnapshot] of Object.entries(options.snapshot.capsules)) {

            if (typeof loadedCapsules[capsuleSourceLineRef] !== 'undefined') continue

            // Extract capsuleName from snapshot if available
            const capsuleName = (capsuleSnapshot as any)?.spineContracts?.['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']?.['#@stream44.studio/encapsulate/structs/Capsule']?.capsuleName

            const capsule = await options.loadCapsule!({
                capsuleSourceLineRef,
                capsuleSnapshot,
                capsuleName,
                cacheBustVersion: CACHE_BUST_VERSION
            })

            // If loadCapsule returns null, it means cache bust version mismatch - regenerate the capsule
            if (capsule === null) {
                throw new Error(
                    `Cache bust version mismatch for capsule '${capsuleSourceLineRef}'. ` +
                    `Expected version ${CACHE_BUST_VERSION} but found ${(capsuleSnapshot as any).cst?.cacheBustVersion}. ` +
                    `Please delete the cache directory and regenerate capsules.`
                )
            }

            loadedCapsules[capsuleSourceLineRef] = await capsule({
                encapsulate: spine.encapsulate,
                CapsulePropertyTypes,
                makeImportStack,
                loadCapsule: options.loadCapsule
            })
        }
    }

    return spine
}

export async function Spine(options: TSpineOptions): Promise<TSpine> {

    const spineOptions = options

    options.timing?.record('Spine: Initialized')

    if (typeof spineOptions.spineFilesystemRoot === 'undefined') throw new Error(`'spineFilesystemRoot' not defined!`)
    if (typeof spineOptions.spineContracts === 'undefined') throw new Error(`'spineContracts' not defined!`)

    const spineContracts = spineOptions.spineContracts
    const capsules: Record<string, any> = {}

    options.timing?.record('Spine: Ready to encapsulate')

    return {
        capsules,
        freeze: async function (): Promise<TSpineSnapshot> {

            options.timing?.record('Spine: Starting freeze')

            const snapshot: TSpineSnapshot = {
                capsules: {}
            }

            options.timing?.record(`Spine: Freezing ${Object.keys(capsules).length} capsules`)

            await Promise.all(Object.entries(capsules).map(async ([capsuleSourceLineRef, capsule]) => {

                if (!capsule.cst.source.capsuleName) throw new Error(`'capsuleName' must be set for encapsulate options to enable freezing.`)

                snapshot.capsules[capsuleSourceLineRef] = {
                    cst: capsule.cst,
                    spineContracts: {}
                }

                const { spineContractCapsuleInstances } = await capsule.makeInstance()

                await Promise.all(Object.entries(spineContractCapsuleInstances).map(async ([spineContractUri, spineContractCapsuleInstance]) => {

                    snapshot.capsules[capsuleSourceLineRef] = merge(
                        snapshot.capsules[capsuleSourceLineRef],
                        await (spineContractCapsuleInstance as any).freeze({
                            spineContractUri,
                            capsule
                        })
                    )
                }))
            }))

            options.timing?.record('Spine: Freeze complete')

            // console.log('snapshot:', JSON.stringify(snapshot, null, 4))
            return snapshot
        },

        encapsulate: async function (definition: TCapsuleDefinition, options: TCapsuleOptions): Promise<TCapsule> {

            return encapsulate(definition, options, {
                spineOptions,
                spineContracts,
                capsules
            })
        }
    }
}




// ##################################################
// # Encapsulate
// ##################################################

async function encapsulate(definition: TCapsuleDefinition, options: TCapsuleOptions, spine: TSpineContext): Promise<TCapsule> {

    if (!options.importMeta && !options.moduleFilepath) throw new Error(`'options.importMeta' nor 'options.moduleFilepath' not specified!`)
    if (!options.importStack && !options.importStackLine) throw new Error(`'options.importStack' nor 'options.importStackLine' specified!`)

    // Use relative path for internal processing, but store absolute path for metadata
    const providedPath = options.moduleFilepath || options.importMeta!.url.replace(/^file:\/\//, '')
    const spineRoot = spine.spineOptions.spineFilesystemRoot || ''

    // Determine if we need to make the path absolute
    let absoluteModuleFilepath: string
    if (providedPath.startsWith('/')) {
        // Already an absolute path (starts with /)
        absoluteModuleFilepath = providedPath
    } else if (spineRoot) {
        // Relative path - make it absolute by joining with spine root
        absoluteModuleFilepath = join(spineRoot, providedPath)
    } else {
        // No spine root and path is relative - use as-is (will remain relative)
        // Note: This happens when SpineRuntime doesn't pass spineFilesystemRoot through
        absoluteModuleFilepath = providedPath
    }

    const moduleFilepath = relative(spineRoot, absoluteModuleFilepath)
    const importStackLine = options.importStackLine || formatImportStackFrame(options.importStack!)

    if (typeof importStackLine !== 'number') throw new Error(`Could not determine importStackLine from options`)

    const capsuleSourceLineRef = `${moduleFilepath}:${importStackLine}`

    spine.spineOptions.timing?.record(`Encapsulate: Start for ${moduleFilepath}`)

    const { csts, crts } = await spine.spineOptions.staticAnalyzer?.parseModule({
        spineOptions: spine.spineOptions,
        encapsulateOptions: {
            moduleFilepath,
            importStackLine,
            capsuleSourceLineRef,
            capsuleName: options.capsuleName,
            ambientReferences: options.ambientReferences,
            cacheBustVersion: CACHE_BUST_VERSION
        }
    }) || {
        csts: options.cst ? { [capsuleSourceLineRef]: options.cst } : undefined,
        crts: options.crt ? { [capsuleSourceLineRef]: options.crt } : undefined
    }

    // Get capsuleName from options first, then fall back to CST if available
    const cst = csts?.[capsuleSourceLineRef]
    const capsuleName = options.capsuleName || cst?.source?.capsuleName

    const encapsulateOptions: TEncapsulateOptions = {
        moduleFilepath,
        importStackLine,
        capsuleName,
        ambientReferences: options.ambientReferences,
        extendsCapsule: options.extendsCapsule,
        capsuleSourceLineRef
    }

    const defaultInstance: Record<string, any> = {}

    // Cache for instances to prevent duplicate makeInstance calls
    const instanceCache = new Map<string, Promise<any>>()

    const capsule: TCapsule = {
        toCapsuleReference: () => {
            return {
                capsuleSourceLineRef: encapsulateOptions.capsuleSourceLineRef,
                capsuleSourceNameRefHash: capsule.cst.capsuleSourceNameRefHash,
            }
        },
        capsuleSourceLineRef: encapsulateOptions.capsuleSourceLineRef,
        definition,
        encapsulateOptions,
        cst,
        crt: crts?.[capsuleSourceLineRef],
        makeInstance: async ({ overrides = {}, options = {}, runtimeSpineContracts, sharedSelf, rootCapsule }: TCapsuleMakeInstanceOptions = {}) => {

            // Create cache key based on parameters
            // When sharedSelf is provided, we must NOT cache because each extending capsule
            // needs its own instance with its own 'this' context (sharedSelf).
            // This is critical for the pattern where multiple structs extend the same parent.
            const cacheKey = sharedSelf ? null : JSON.stringify({
                overrides,
                options,
                hasRuntimeContracts: !!runtimeSpineContracts
            })

            // Check if we already have a pending or completed instance creation
            // Skip cache when sharedSelf is provided (cacheKey is null)
            if (cacheKey && instanceCache.has(cacheKey)) {
                return instanceCache.get(cacheKey)!
            }

            // Create the instance promise and cache it immediately (only if cacheKey is set)
            const instancePromise = (async () => {
                const encapsulatedApi: Record<string, any> = {}
                const spineContractCapsuleInstances: Record<string, any> = {}

                // Property contracts are keys starting with '#' that contain nested properties
                // Structure: spineContractUri -> propertyContractUri -> propertyName -> propertyDef
                const propertyContractDefinitions: Record<string, Record<string, Record<string, any>>> = {}
                // Track which property contracts are defined for validation
                const definedPropertyContracts = new Set<string>()

                for (const [spineContractUri, propertyDefinitions] of Object.entries(definition)) {
                    // Validate that at least one property contract key exists
                    const hasPropertyContract = Object.keys(propertyDefinitions).some(key => key.startsWith('#'))
                    if (!hasPropertyContract) {
                        throw new Error(`Spine contract '${spineContractUri}' for capsule '${capsule.capsuleSourceLineRef}' must specify at least one property contract layer using a key starting with '#'. For example: '#': { ...properties }`)
                    }

                    propertyContractDefinitions[spineContractUri] = {}

                    for (const [propContractUri, propDef] of Object.entries(propertyDefinitions)) {
                        if (propContractUri.startsWith('#')) {

                            // This is a property contract - store its properties (merge if it already exists)
                            if (!propertyContractDefinitions[spineContractUri][propContractUri]) {
                                propertyContractDefinitions[spineContractUri][propContractUri] = {}
                            }
                            Object.assign(propertyContractDefinitions[spineContractUri][propContractUri], propDef as Record<string, any>)
                            definedPropertyContracts.add(propContractUri)

                            // If this is a non-default property contract, add a dynamic mapping to the '#' contract
                            if (propContractUri !== '#') {
                                // We have a property contract URI we need to resolve and load
                                // Add a dynamic property mapping for this contract to the '#' group
                                // Check if 'as' is defined to use as the property name alias
                                const propDefTyped = propDef as Record<string, any>
                                const aliasName = propDefTyped.as
                                const delegateOptions = propDefTyped.options
                                const contractKey = aliasName || ('#' + propContractUri.substring(1))

                                if (!propertyContractDefinitions[spineContractUri]['#']) {
                                    propertyContractDefinitions[spineContractUri]['#'] = {}
                                }

                                propertyContractDefinitions[spineContractUri]['#'][contractKey] = {
                                    type: CapsulePropertyTypes.Mapping,
                                    value: propContractUri.substring(1),
                                    propertyContractDelegate: propContractUri,
                                    as: aliasName,
                                    // Pass options from the property contract delegate to the mapped capsule
                                    delegateOptions
                                }
                            }

                        } else {
                            throw new Error(`Property '${propContractUri}' in spine contract '${spineContractUri}' for capsule '${capsule.capsuleSourceLineRef}' must be nested under a property contract uri starting with '#'. For example: '#': { ${propContractUri}: {...} }`)
                        }
                    }
                }

                // Merge overrides and options by property contract
                // Structure: propertyContractUri -> propertyName -> value
                const mergedValuesByContract: Record<string, Record<string, any>> = {}

                // Helper to validate and merge values from a source (overrides or options)
                const mergeByContract = (source: any, sourceName: string) => {
                    if (!source) return

                    for (const [propertyContractUri, properties] of Object.entries(source)) {
                        if (!propertyContractUri.startsWith('#')) {
                            throw new Error(`${sourceName} for capsule '${capsule.capsuleSourceLineRef}' must use property contract keys starting with '#'. Found key: '${propertyContractUri}'`)
                        }

                        if (!definedPropertyContracts.has(propertyContractUri)) {
                            throw new Error(`${sourceName} for capsule '${capsule.capsuleSourceLineRef}' references property contract '${propertyContractUri}' which is not defined on the capsule`)
                        }

                        if (!mergedValuesByContract[propertyContractUri]) {
                            mergedValuesByContract[propertyContractUri] = {}
                        }

                        Object.assign(mergedValuesByContract[propertyContractUri], properties)
                    }
                }

                // Merge in order: overrides by lineRef, overrides by name, options
                mergeByContract(overrides?.[encapsulateOptions.capsuleSourceLineRef], 'Overrides')
                if (encapsulateOptions.capsuleName) {
                    mergeByContract(overrides?.[encapsulateOptions.capsuleName], 'Overrides')
                }
                mergeByContract(options, 'Options')

                // Extract default values from property definitions (Literal/String types)
                // This ensures child capsule's default values are available before parent is instantiated
                const defaultPropertyValues: Record<string, any> = {}
                for (const [spineContractUri, propertyContracts] of Object.entries(propertyContractDefinitions)) {
                    for (const [propertyContractUri, properties] of Object.entries(propertyContracts)) {
                        if (propertyContractUri !== '#') continue
                        for (const [propertyName, propertyDef] of Object.entries(properties as Record<string, any>)) {
                            if (propertyDef.type === CapsulePropertyTypes.Literal ||
                                propertyDef.type === CapsulePropertyTypes.String) {
                                if (propertyDef.value !== undefined) {
                                    defaultPropertyValues[propertyName] = propertyDef.value
                                }
                            }
                        }
                    }
                }

                // Create a single shared self for all spine contracts by flattening merged values
                // ownValues contains this capsule's defaults and overrides
                const ownValues = merge({}, defaultInstance, defaultPropertyValues, ...Object.values(mergedValuesByContract))

                // If sharedSelf is provided (from extending capsule), we need to:
                // 1. Add parent's properties that child doesn't have
                // 2. Keep child's values for properties that exist in both
                // We do this by assigning parent's values first, then child's values on top
                let self: any
                if (sharedSelf) {
                    // Save child's current values (only non-undefined values)
                    const childValues: Record<string, any> = {}
                    for (const [key, value] of Object.entries(sharedSelf)) {
                        if (value !== undefined) {
                            childValues[key] = value
                        }
                    }
                    // Assign parent's defaults to sharedSelf (for properties child doesn't have)
                    for (const [key, value] of Object.entries(ownValues)) {
                        if (!(key in childValues)) {
                            sharedSelf[key] = value
                        }
                    }
                    self = sharedSelf
                } else {
                    self = ownValues
                }

                // Create ownSelf containing only this capsule's own properties (not from extends chain)
                // This allows functions to access this.self for their own capsule's properties
                // The selfProxy in spine contracts will expose this as 'self' property
                const ownSelf = merge({}, defaultInstance, defaultPropertyValues, ...Object.values(mergedValuesByContract))

                // Capsule metadata struct will be set on self/ownSelf AFTER spine contract processing
                // to avoid being overwritten by the empty struct marker in the definition
                // Convert relative paths to absolute for metadata exposure
                const absoluteCapsuleSourceLineRef = `${absoluteModuleFilepath}:${importStackLine}`
                const capsuleMetadataStruct = {
                    capsuleName: encapsulateOptions.capsuleName,
                    capsuleSourceLineRef: absoluteCapsuleSourceLineRef,
                    moduleFilepath: absoluteModuleFilepath,
                    // Root capsule metadata will be populated after extends chain is resolved
                    rootCapsule: {
                        capsuleName: undefined as string | undefined,
                        capsuleSourceLineRef: undefined as string | undefined,
                        moduleFilepath: undefined as string | undefined
                    }
                }

                // Initialize extended capsule instance if this capsule extends another
                // Pass our self so extended capsule's functions bind to the same context
                let extendedCapsuleInstance: any = undefined

                // Check CST first, then fall back to encapsulateOptions for direct capsule references
                let extendsCapsuleValue = capsule.cst?.source?.extendsCapsule || encapsulateOptions.extendsCapsule

                // If extendsCapsule is a string identifier, check if it's in ambientReferences first
                if (typeof extendsCapsuleValue === 'string') {
                    const cstAmbientRefs = capsule.cst?.source?.ambientReferences || {}
                    const runtimeAmbientRefs = encapsulateOptions.ambientReferences || {}
                    for (const [refName, ref] of Object.entries(cstAmbientRefs)) {
                        const refTyped = ref as any
                        if (refName === extendsCapsuleValue) {
                            if (refTyped.type === 'capsule' && refTyped.value) {
                                extendsCapsuleValue = refTyped.value
                            } else if (refTyped.type === 'instance' && runtimeAmbientRefs[refName]) {
                                // CST stores '[instance]' placeholder; resolve from runtime ambient refs
                                const runtimeRef = runtimeAmbientRefs[refName]
                                if (runtimeRef && typeof runtimeRef === 'object' && typeof runtimeRef.makeInstance === 'function') {
                                    extendsCapsuleValue = runtimeRef
                                }
                            }
                            break
                        }
                    }
                }

                if (extendsCapsuleValue) {
                    let extendsCapsule = extendsCapsuleValue

                    // If it's a string, resolve it using the same mechanism as mappings
                    if (typeof extendsCapsule === 'string') {
                        // Use the first available spine contract to resolve the URI
                        const activeSpineContracts = runtimeSpineContracts || spine.spineContracts
                        const firstSpineContractKey = Object.keys(activeSpineContracts)[0]
                        const firstSpineContract = activeSpineContracts[firstSpineContractKey] as any

                        if (!firstSpineContract) throw new Error(`No spine contracts available to resolve extendsCapsule URI!`)

                        // Create a contract instance to use resolveMappedCapsule
                        const contractInstance = firstSpineContract.makeContractCapsuleInstance({
                            spineContractUri: firstSpineContractKey,
                            encapsulateOptions,
                            capsuleInstance: { api: {}, spineContractCapsuleInstances: {} },
                            self: {},
                            capsule,
                            encapsulatedApi: {},
                            runtimeSpineContracts
                        })

                        // Resolve using the same mechanism as mappings
                        extendsCapsule = await contractInstance.resolveMappedCapsule({
                            property: {
                                name: '__extends__',
                                definition: { value: extendsCapsule }
                            }
                        })
                    }

                    extendedCapsuleInstance = await extendsCapsule.makeInstance({
                        overrides,
                        options,
                        runtimeSpineContracts,
                        sharedSelf: self,
                        rootCapsule: rootCapsule || {
                            capsuleName: encapsulateOptions.capsuleName!,
                            capsuleSourceLineRef: absoluteCapsuleSourceLineRef,
                            moduleFilepath: absoluteModuleFilepath
                        }
                    })
                }

                // Resolve the root capsule for this instance:
                // If rootCapsule was passed down from a parent, use it (preserves the first capsule in the chain).
                // Otherwise this capsule IS the root.
                const resolvedRootCapsule = rootCapsule || {
                    capsuleName: encapsulateOptions.capsuleName!,
                    capsuleSourceLineRef: absoluteCapsuleSourceLineRef,
                    moduleFilepath: absoluteModuleFilepath
                }
                capsuleMetadataStruct.rootCapsule.capsuleName = resolvedRootCapsule.capsuleName
                capsuleMetadataStruct.rootCapsule.capsuleSourceLineRef = resolvedRootCapsule.capsuleSourceLineRef
                capsuleMetadataStruct.rootCapsule.moduleFilepath = resolvedRootCapsule.moduleFilepath

                const capsuleInstance: any = {
                    api: encapsulatedApi,
                    spineContractCapsuleInstances,
                    extendedCapsuleInstance,
                    structInitFunctions: [] as Array<() => any>,
                    structDisposeFunctions: [] as Array<() => any>,
                    initFunctions: [] as Array<() => any>,
                    disposeFunctions: [] as Array<() => any>,
                    mappedCapsuleInstances: [] as Array<any>,
                    rootCapsule: resolvedRootCapsule
                }

                // Use runtime spine contracts if provided, otherwise fall back to encapsulation spine contracts
                const activeSpineContracts = runtimeSpineContracts || spine.spineContracts

                for (const [spineContractUri, propertyContracts] of Object.entries(propertyContractDefinitions)) {

                    const spineContract = activeSpineContracts[spineContractUri] as any

                    if (!spineContract) throw new Error(`Contract uri '${spineContractUri}' used by capsule not available in Spine!`)

                    const spineContractCapsuleInstance = spineContract.makeContractCapsuleInstance({
                        spineContractUri,
                        encapsulateOptions,
                        capsuleInstance,
                        self,
                        ownSelf,
                        capsule,
                        encapsulatedApi,
                        runtimeSpineContracts,
                        extendedCapsuleInstance
                    })

                    spineContractCapsuleInstances[spineContractUri] = spineContractCapsuleInstance

                    // Iterate through each property contract within this spine contract
                    for (const [propertyContractUri, properties] of Object.entries(propertyContracts)) {
                        // Skip non-'#' property contracts as they're already accessible via dynamic mappings in '#'
                        if (propertyContractUri !== '#') {
                            continue
                        }
                        for (const [propertyName, propertyDefinition] of Object.entries(properties)) {

                            if (!propertyDefinition.type || !(propertyDefinition.type in CapsulePropertyTypes)) throw new Error(`Type '${propertyDefinition.type}' for property '${propertyName}' on spineContract '${spineContractUri}' not set or supported!`)

                            await spineContractCapsuleInstance.mapProperty({
                                overrides,
                                options,
                                property: {
                                    name: propertyName,
                                    definition: propertyDefinition,
                                    propertyContractUri
                                }
                            })
                        }
                    }
                }

                // Set capsule metadata struct on self/ownSelf AFTER spine contract processing
                // to avoid being overwritten by the empty struct marker in the definition
                if (!self['#@stream44.studio/encapsulate/structs/Capsule'] ||
                    typeof self['#@stream44.studio/encapsulate/structs/Capsule'] !== 'object' ||
                    !self['#@stream44.studio/encapsulate/structs/Capsule'].capsuleName) {
                    self['#@stream44.studio/encapsulate/structs/Capsule'] = capsuleMetadataStruct
                }
                ownSelf['#@stream44.studio/encapsulate/structs/Capsule'] = capsuleMetadataStruct

                // Collect lifecycle functions and mapped capsule instances from all spine contract capsule instances
                for (const spineContractCapsuleInstance of Object.values(spineContractCapsuleInstances)) {
                    const sci = spineContractCapsuleInstance as any
                    if (sci.structInitFunctions?.length) {
                        capsuleInstance.structInitFunctions.push(...sci.structInitFunctions)
                    }
                    if (sci.structDisposeFunctions?.length) {
                        capsuleInstance.structDisposeFunctions.push(...sci.structDisposeFunctions)
                    }
                    if (sci.initFunctions?.length) {
                        capsuleInstance.initFunctions.push(...sci.initFunctions)
                    }
                    if (sci.disposeFunctions?.length) {
                        capsuleInstance.disposeFunctions.push(...sci.disposeFunctions)
                    }
                    if (sci.mappedCapsuleInstances?.length) {
                        capsuleInstance.mappedCapsuleInstances.push(...sci.mappedCapsuleInstances)
                    }
                }

                // Wrap encapsulatedApi in a proxy that delegates to extended capsule's API for missing properties
                if (extendedCapsuleInstance) {
                    capsuleInstance.api = new Proxy(encapsulatedApi, {
                        get: (target: any, prop: string | symbol) => {
                            if (typeof prop === 'symbol') return target[prop]

                            // First check if the property exists in local API
                            if (prop in target) {
                                return target[prop]
                            }

                            // Fall back to extended capsule's API
                            if (prop in extendedCapsuleInstance.api) {
                                return extendedCapsuleInstance.api[prop]
                            }

                            return undefined
                        },
                        has: (target: any, prop: string | symbol) => {
                            return prop in target || prop in extendedCapsuleInstance.api
                        }
                    })
                }

                return capsuleInstance
            })()

            // Cache the promise only if cacheKey is set (not when sharedSelf is provided)
            if (cacheKey) {
                instanceCache.set(cacheKey, instancePromise)
            }

            return instancePromise
        }
    }

    spine.capsules[encapsulateOptions.capsuleSourceLineRef] = capsule
    if (encapsulateOptions.capsuleName) {
        spine.capsules[encapsulateOptions.capsuleName] = capsule
    }

    spine.spineOptions.timing?.record(`Encapsulate: Complete for ${moduleFilepath}`)

    return capsule
}



function formatImportStackFrame(importStack: string): number | undefined {
    const stackLines = importStack.split('\n')

    const hasMakeImportStackMarker = importStack.includes('encapsulate:makeImportStack')
    const targetMatchCount = hasMakeImportStackMarker ? 2 : 1

    let matchCount = 0
    for (let i = 0; i < stackLines.length; i++) {
        const line = stackLines[i]

        if (line.includes('encapsulate:makeImportStack')) {
            continue
        }

        const match = line.match(/\(([^)]+):([0-9]+):[0-9]+\)|at ([^(]+):([0-9]+):[0-9]+/)
        if (match) {
            matchCount++
            if (matchCount === targetMatchCount) {
                const lineNumber = parseInt(match[2] || match[4])
                return lineNumber
            }
        }
    }

    return undefined
}

// ##################################################
// # Utilities
// ##################################################

export function makeImportStack() {
    return new Error('encapsulate:makeImportStack').stack
}

export function join(...paths: string[]): string {
    if (paths.length === 0) return '.'

    let joined = paths.join('/')

    const isAbsolute = joined.startsWith('/')
    const parts: string[] = []

    for (const part of joined.split('/')) {
        if (part === '' || part === '.') continue
        if (part === '..') {
            if (parts.length > 0 && parts[parts.length - 1] !== '..') {
                parts.pop()
            } else if (!isAbsolute) {
                parts.push('..')
            }
        } else {
            parts.push(part)
        }
    }

    let result = parts.join('/')
    if (isAbsolute) result = '/' + result

    return result || (isAbsolute ? '/' : '.')
}

function relative(from: string, to: string): string {
    const fromParts = from.split('/').filter(p => p && p !== '.')
    const toParts = to.split('/').filter(p => p && p !== '.')

    let commonLength = 0
    const minLength = Math.min(fromParts.length, toParts.length)

    for (let i = 0; i < minLength; i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength++
        } else {
            break
        }
    }

    const upCount = fromParts.length - commonLength
    const remainingTo = toParts.slice(commonLength)

    const result = [...Array(upCount).fill('..'), ...remainingTo].join('/')
    return result || '.'
}

function isObject(item: any): boolean {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    // Only deep-merge plain objects — preserve instances like Map, Set, Date, etc.
    const proto = Object.getPrototypeOf(item)
    return proto === Object.prototype || proto === null
}

export function merge<T = any>(target: T, ...sources: any[]): T {
    if (!sources.length) return target
    const source = sources.shift()

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key as keyof T]) Object.assign(target, { [key]: {} })
                merge(target[key as keyof T], source[key])
            } else {
                Object.assign(target, { [key]: source[key] })
            }
        }
    }

    return merge(target, ...sources)
}
