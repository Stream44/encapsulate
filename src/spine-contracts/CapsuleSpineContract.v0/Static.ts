import { CapsulePropertyTypes, join } from "../../encapsulate"
import type { TimingObserverInterface } from "../../spine-factories/TimingObserver"

// Type for capsule instance registry - scoped per spine contract instance
export type CapsuleInstanceRegistry = Map<string, any>

export class ContractCapsuleInstanceFactory {

    protected spineContractUri: string
    protected capsule: any
    protected self: any
    protected encapsulatedApi: Record<string, any>
    protected resolve?: (uri: string, parentFilepath: string) => Promise<string>
    protected importCapsule?: (filepath: string) => Promise<any>
    protected spineFilesystemRoot?: string
    protected freezeCapsule?: (capsule: any) => Promise<any>
    protected instanceRegistry?: CapsuleInstanceRegistry
    protected extendedCapsuleInstance?: any
    protected ownSelf?: any
    public childEncapsulatedApis?: Record<string, any>[]
    protected runtimeSpineContracts?: Record<string, any>
    protected capsuleInstance?: any
    protected timing?: TimingObserverInterface
    public structInitFunctions: Array<() => any> = []
    public structDisposeFunctions: Array<() => any> = []
    public initFunctions: Array<() => any> = []
    public disposeFunctions: Array<() => any> = []
    public onFreezeFunctions: Array<() => any> = []
    public mappedCapsuleInstances: Array<any> = []
    protected memoizeCache: Map<string, any> = new Map()
    protected memoizeTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()

    constructor({ spineContractUri, capsule, self, ownSelf, encapsulatedApi, resolve, importCapsule, spineFilesystemRoot, freezeCapsule, instanceRegistry, extendedCapsuleInstance, runtimeSpineContracts, capsuleInstance, timing }: { spineContractUri: string, capsule: any, self: any, ownSelf?: any, encapsulatedApi: Record<string, any>, resolve?: (uri: string, parentFilepath: string) => Promise<string>, importCapsule?: (filepath: string) => Promise<any>, spineFilesystemRoot?: string, freezeCapsule?: (capsule: any) => Promise<any>, instanceRegistry?: CapsuleInstanceRegistry, extendedCapsuleInstance?: any, runtimeSpineContracts?: Record<string, any>, capsuleInstance?: any, timing?: TimingObserverInterface }) {
        this.spineContractUri = spineContractUri
        this.capsule = capsule
        this.self = self
        this.ownSelf = ownSelf
        this.encapsulatedApi = encapsulatedApi
        this.resolve = resolve
        this.importCapsule = importCapsule
        this.spineFilesystemRoot = spineFilesystemRoot
        this.freezeCapsule = freezeCapsule
        this.instanceRegistry = instanceRegistry
        this.extendedCapsuleInstance = extendedCapsuleInstance
        this.runtimeSpineContracts = runtimeSpineContracts
        this.capsuleInstance = capsuleInstance
        this.timing = timing

        // Inject importCapsule onto ownSelf so capsule functions can call this.self.importCapsule()
        if (ownSelf && !ownSelf.importCapsule) {
            ownSelf.importCapsule = this.handleImportCapsule.bind(this)
        }
    }

    async handleImportCapsule({ uri, options, overrides }: { uri: string, options?: Record<string, any>, overrides?: Record<string, any> }): Promise<{ capsule: any, api: any }> {
        // Resolve the URI to a capsule object using the same mechanism as mappings
        const resolvedCapsule = await this.resolveMappedCapsule({
            property: {
                name: '__importCapsule__',
                definition: { value: uri }
            }
        })

        // Instantiate the capsule with the caller's runtime spine contracts and optional overrides/options
        const instance = await resolvedCapsule.makeInstance({
            overrides: overrides || {},
            options: options,
            runtimeSpineContracts: this.runtimeSpineContracts,
            rootCapsule: this.capsuleInstance?.rootCapsule,
            parentCapsuleSourceUriLineRefInstanceId: this.capsuleInstance?.capsuleSourceUriLineRefInstanceId,
            sit: this.capsuleInstance?.sit
        })

        // Run init functions on the imported capsule instance
        if (instance.initFunctions?.length) {
            for (const fn of instance.initFunctions) {
                await fn()
            }
        }

        // Return capsule and unwrapped api without mapping onto the parent
        return {
            capsule: resolvedCapsule,
            api: instance.api || instance
        }
    }

    async mapProperty({ overrides, options, transitiveOverrides, property }: { overrides: any, options: any, transitiveOverrides?: any, property: any }) {
        if (property.definition.type === CapsulePropertyTypes.Mapping) {
            await this.mapMappingProperty({ overrides, options, transitiveOverrides, property })
        } else if (
            property.definition.type === CapsulePropertyTypes.String ||
            property.definition.type === CapsulePropertyTypes.Literal ||
            property.definition.type === CapsulePropertyTypes.Constant
        ) {
            this.mapLiteralProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.Function) {
            this.mapFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.ConstantGetterFunction) {
            this.mapConstantGetterFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.GetterFunction) {
            this.mapGetterFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.SetterFunction) {
            this.mapSetterFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.StructInit) {
            this.mapStructInitProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.StructDispose) {
            this.mapStructDisposeProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.Init) {
            this.mapInitProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.Dispose) {
            this.mapDisposeProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.OnFreeze) {
            this.mapOnFreezeProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.ProxyFunction) {
            this.mapProxyFunctionProperty({ property })
        }
    }

    protected getApiTarget({ property }: { property: any }) {
        // Properties under '#' go directly on the API
        // Properties under '#<uri>' go under api['#<uri>']
        if (!property.propertyContractUri || property.propertyContractUri === '#') {
            return this.encapsulatedApi
        } else {
            // Namespace under the property contract key
            if (!this.encapsulatedApi[property.propertyContractUri]) {
                this.encapsulatedApi[property.propertyContractUri] = {}
            }
            return this.encapsulatedApi[property.propertyContractUri]
        }
    }

    protected async resolveMappedCapsule({ property }: { property: any }) {
        let mappedCapsule

        if (typeof property.definition.value === 'string') {
            if (!this.resolve) throw new Error(`'resolve' not set!`)
            if (!this.spineFilesystemRoot) throw new Error(`'spineFilesystemRoot' not set!`)
            if (!this.importCapsule) throw new Error(`'importCapsule' not set!`)

            // Use cst.source.moduleFilepath (always filesystem-relative) for path resolution.
            // encapsulateOptions.moduleFilepath may be an npm URI when loaded from projected files.
            // However, cst.source.moduleFilepath may be relative to a different package root than
            // the current spineFilesystemRoot (e.g. cross-package capsule references). In that case,
            // fall back to encapsulateOptions.moduleFilepath which is always relative to current spine root.
            let moduleFilepath = this.capsule.cst?.source?.moduleFilepath || this.capsule.encapsulateOptions?.moduleFilepath
            if (!moduleFilepath) throw new Error(`'moduleFilepath' not available on capsule!`)

            // moduleFilepath may be a relative filesystem path (e.g. "../../../caps/Foo.ts")
            // or an npm-style URI (e.g. "@stream44.studio/t44-docker.com/caps/Project")
            // after freeze/hoist cycles. join(spineRoot, npmUri) produces a bogus path when
            // the URI is npm-style and spineRoot is narrow. Detect this by checking if the
            // moduleFilepath looks like an npm URI (starts with @, or doesn't start with / or .),
            // and resolve it to get the actual filesystem path.
            let parentPath = join(this.spineFilesystemRoot, moduleFilepath)
            if (!moduleFilepath.startsWith('/') && !moduleFilepath.startsWith('.')) {
                // Looks like an npm-style URI or filesystem-convention path — resolve it
                try {
                    // Try with @ prefix first (npm URI convention)
                    if (moduleFilepath.startsWith('@')) {
                        parentPath = await this.resolve(moduleFilepath, this.spineFilesystemRoot)
                    } else {
                        // May be a filesystem-convention path like "scope/packages/pkg/path"
                        // Try resolving as @scope/pkg/path by extracting scope and package name
                        const parts = moduleFilepath.split('/')
                        if (parts.length >= 3 && parts[1] === 'packages') {
                            const scope = parts[0]
                            const pkg = parts[2]
                            const subpath = parts.slice(3).join('/')
                            const npmUri = subpath ? `@${scope}/${pkg}/${subpath}` : `@${scope}/${pkg}`
                            parentPath = await this.resolve(npmUri, this.spineFilesystemRoot)
                        }
                    }
                } catch {
                    // Fall back to the joined path if resolution fails
                }
            }
            let filepath: string
            try {
                filepath = await this.resolve(property.definition.value, parentPath)
            } catch (resolveError) {
                // cst.source.moduleFilepath may be relative to a different package root than spineFilesystemRoot
                // (e.g. cross-package capsule references). Fall back to encapsulateOptions.moduleFilepath
                // which is always relative to the current spine root.
                const fallbackModuleFilepath = this.capsule.encapsulateOptions?.moduleFilepath
                if (fallbackModuleFilepath && fallbackModuleFilepath !== moduleFilepath) {
                    // The fallback moduleFilepath may be a relative path or an npm URI.
                    // Apply the same resolution logic as the primary path.
                    let fallbackParentPath = join(this.spineFilesystemRoot, fallbackModuleFilepath)
                    if (!fallbackModuleFilepath.startsWith('/') && !fallbackModuleFilepath.startsWith('.')) {
                        try {
                            if (fallbackModuleFilepath.startsWith('@')) {
                                fallbackParentPath = await this.resolve!(fallbackModuleFilepath, this.spineFilesystemRoot)
                            } else {
                                const parts = fallbackModuleFilepath.split('/')
                                if (parts.length >= 3 && parts[1] === 'packages') {
                                    const scope = parts[0]
                                    const pkg = parts[2]
                                    const subpath = parts.slice(3).join('/')
                                    const npmUri = subpath ? `@${scope}/${pkg}/${subpath}` : `@${scope}/${pkg}`
                                    fallbackParentPath = await this.resolve!(npmUri, this.spineFilesystemRoot)
                                }
                            }
                        } catch {
                            // Fall back to the joined path
                        }
                    }
                    filepath = await this.resolve(property.definition.value, fallbackParentPath)
                } else {
                    throw resolveError
                }
            }
            this.timing?.record(`resolveMappedCapsule: importCapsule(${filepath.replace(/^.*\/genesis\//, '')})`)
            mappedCapsule = await this.importCapsule(filepath)
        } else if (
            typeof property.definition.value === 'object' &&
            typeof property.definition.value.capsuleSourceLineRef === 'string'
        ) {
            mappedCapsule = property.definition.value
        } else {
            throw new Error(`Unknown mapping value for property '${property.name}'!`)
        }

        return mappedCapsule
    }

    protected async extractConstants({ mappedCapsule, _visited }: { mappedCapsule: any, _visited?: Set<string> }) {
        const constants: Record<string, any> = {}
        const constantGetterFunctions: Array<{ key: string; fn: Function }> = []
        const mappingProperties: Array<{ key: string; def: any }> = []

        const spineContractDef = mappedCapsule.definition[this.spineContractUri]

        if (!spineContractDef) {
            throw new Error(`Spine contract definition not found for URI: ${this.spineContractUri}. Available keys: ${Object.keys(mappedCapsule.definition).join(', ')}`)
        }

        // Iterate through all keys in the spine contract definition
        for (const [key, value] of Object.entries(spineContractDef)) {
            if (key.startsWith('#')) {
                // This is a property contract - iterate through its properties
                for (const [prop, propDef] of Object.entries(value as Record<string, any>)) {
                    const { type, value: propValue } = propDef as any

                    if (typeof propValue === 'undefined') continue

                    if (
                        type === CapsulePropertyTypes.String ||
                        type === CapsulePropertyTypes.Literal ||
                        type === CapsulePropertyTypes.Constant
                    ) {
                        constants[prop] = propValue
                    } else if (type === CapsulePropertyTypes.ConstantGetterFunction) {
                        constantGetterFunctions.push({ key: prop, fn: propValue })
                    } else if (type === CapsulePropertyTypes.Mapping) {
                        mappingProperties.push({ key: prop, def: propDef })
                    }
                }
            } else {
                // Regular property (backwards compatibility)
                const { type, value: propValue } = value as any

                if (typeof propValue === 'undefined') continue

                if (
                    type === CapsulePropertyTypes.String ||
                    type === CapsulePropertyTypes.Literal ||
                    type === CapsulePropertyTypes.Constant
                ) {
                    constants[key] = propValue
                } else if (type === CapsulePropertyTypes.ConstantGetterFunction) {
                    constantGetterFunctions.push({ key, fn: propValue })
                } else if (type === CapsulePropertyTypes.Mapping) {
                    mappingProperties.push({ key, def: value })
                }
            }
        }

        // Resolve Mapping properties and extract their constants recursively.
        // Track visited capsules to prevent infinite recursion on circular refs.
        const visited = _visited || new Set<string>()
        const thisCapsuleName = mappedCapsule.encapsulateOptions?.capsuleName
        if (thisCapsuleName) visited.add(thisCapsuleName)
        for (const { key, def } of mappingProperties) {
            try {
                const nestedCapsule = await this.resolveMappedCapsule({
                    property: { definition: def, name: key }
                })
                const nestedName = nestedCapsule.encapsulateOptions?.capsuleName
                if (nestedName && visited.has(nestedName)) continue
                constants[key] = await this.extractConstants({ mappedCapsule: nestedCapsule, _visited: visited })
            } catch {
                // Skip mappings that cannot be resolved (e.g. missing dependencies)
            }
        }

        // Build capsule metadata so ConstantGetterFunctions can access it.
        // rootCapsule is inherited from the parent (same as what makeInstance would receive).
        const capsuleStructKey = '#@stream44.studio/encapsulate/structs/Capsule'
        const relModuleFilepath = mappedCapsule.cst?.source?.moduleFilepath
            || mappedCapsule.encapsulateOptions?.moduleFilepath
        const moduleFilepath = relModuleFilepath
            ? (relModuleFilepath.startsWith('/')
                ? relModuleFilepath
                : join(this.spineFilesystemRoot || '', relModuleFilepath))
            : undefined
        constants[capsuleStructKey] = {
            capsuleName: mappedCapsule.encapsulateOptions?.capsuleName,
            moduleFilepath,
            rootCapsule: this.capsuleInstance?.rootCapsule || {
                capsuleName: this.capsule?.encapsulateOptions?.capsuleName,
                moduleFilepath: this.self?.[capsuleStructKey]?.moduleFilepath,
            },
        }

        // Evaluate ConstantGetterFunction values with the accumulated constants
        // (including resolved Mapping constants). These receive { constants }
        // (not this) — only static values and nested Mapping constants are available.
        for (const { key, fn } of constantGetterFunctions) {
            constants[key] = fn({ constants })
        }

        return constants
    }

    protected async mapMappingProperty({ overrides, options, transitiveOverrides, property }: { overrides: any, options: any, transitiveOverrides?: any, property: any }) {
        this.timing?.record(`mapMappingProperty: ${property.name} → ${typeof property.definition.value === 'string' ? property.definition.value : (property.definition.value?.encapsulateOptions?.capsuleName || 'obj')}`)
        const mappedCapsule = await this.resolveMappedCapsule({ property })
        const constants = await this.extractConstants({ mappedCapsule })

        // delegateOptions is set by encapsulate.ts for property contract delegates
        // options can be a function or an object for regular mappings
        // Always pass { self, constants } - self contains full parent self when depends is specified,
        // otherwise just the Capsule metadata struct (moduleFilepath, capsuleName, etc.)
        const optionsFn = property.definition.options
        const capsuleStructKey = '#@stream44.studio/encapsulate/structs/Capsule'
        const minimalSelf = this.self[capsuleStructKey]
            ? { [capsuleStructKey]: this.self[capsuleStructKey] }
            : {}
        // During freeze phase, skip calling function-based options callbacks — runtime
        // overrides haven't been applied so self.* references may be incomplete.
        // Use a truthy placeholder so the instance registry still creates a fresh instance
        // (preserving the instance tree for OnFreeze traversal and .sit.json generation).
        // Object-based options and delegateOptions are always applied (they are static).
        const isFreezePhase = !!this.capsuleInstance?.freezePhase
        const hasFunctionOptions = typeof optionsFn === 'function'
        const selfArg = { self: property.definition.depends ? this.self : minimalSelf, constants }
        const delegateOpts = property.definition.delegateOptions
        const resolvedDelegateOptions = delegateOpts
            ? (typeof delegateOpts === 'function'
                ? (isFreezePhase ? {} : await delegateOpts(selfArg))
                : delegateOpts)
            : undefined
        const mappingOptions = resolvedDelegateOptions
            || (hasFunctionOptions
                ? (isFreezePhase
                    ? {}  // truthy placeholder — signals "has options" without calling the function
                    : await optionsFn(selfArg))
                : optionsFn)

        // Check for existing instance in registry - reuse if available when no options
        // Pre-registration with null allows parent capsules to "claim" a slot before child capsules process
        // Property contract delegates (structs) always get a fresh instance per parent capsule.
        // CapsuleProjectionContext also needs fresh instances so context injection can find it
        // in mappedCapsuleInstances during freeze traversal.
        const capsuleName = mappedCapsule.encapsulateOptions?.capsuleName
        const isCapsuleStruct = property.definition.propertyContractDelegate === '#@stream44.studio/encapsulate/structs/Capsule'
            || property.definition.propertyContractDelegate === '#@stream44.studio/encapsulate/structs/CapsuleProjectionContext'

        if (capsuleName && this.instanceRegistry && !isCapsuleStruct) {
            if (this.instanceRegistry.has(capsuleName)) {
                const existingEntry = this.instanceRegistry.get(capsuleName)

                // Only reuse if current mapping has no options
                if (!mappingOptions) {
                    this.timing?.record(`mapMappingProperty: REGISTRY REUSE ${capsuleName} (deferred proxy)`)
                    // Use deferred proxy that resolves from registry when accessed
                    // Works for both null (pre-registered) and actual instances
                    const apiTarget = this.getApiTarget({ property })
                    const registry = this.instanceRegistry
                    apiTarget[property.name] = new Proxy({} as any, {
                        get: (_target: any, apiProp: string | symbol) => {
                            if (typeof apiProp === 'symbol') return undefined
                            const resolvedInstance = registry.get(capsuleName)
                            if (!resolvedInstance) {
                                throw new Error(`Capsule instance not yet resolved: ${capsuleName}`)
                            }
                            // Access through .api if it exists (for capsule instances with getters)
                            if (resolvedInstance.api && apiProp in resolvedInstance.api) {
                                return resolvedInstance.api[apiProp]
                            }
                            return resolvedInstance[apiProp]
                        }
                    })
                    this.self[property.name] = new Proxy({} as any, {
                        get: (_target, prop) => {
                            if (typeof prop === 'symbol') return undefined
                            const resolvedInstance = registry.get(capsuleName)
                            if (!resolvedInstance) {
                                throw new Error(`Capsule instance not yet resolved: ${capsuleName}`)
                            }
                            const value = resolvedInstance.api?.[prop] ?? resolvedInstance[prop]
                            if (value && typeof value === 'object' && value.api) {
                                return value.api
                            }
                            return value
                        }
                    })
                    return
                }
                // If current mapping has options, fall through to create new instance
            } else {
                // Pre-register as null to claim the slot for this capsule
                this.instanceRegistry.set(capsuleName, null)
            }
        }

        // Separate nested capsule-name-targeted options from own options
        // Keys starting with '#' are own options for the mapped capsule
        // Non-'#' keys are matched against capsule names in the mapping tree
        let ownMappingOptions: Record<string, any> | undefined = undefined
        let nestedCapsuleOptions: Record<string, any> | undefined = undefined
        if (mappingOptions) {
            for (const [key, value] of Object.entries(mappingOptions)) {
                if (key.startsWith('#')) {
                    if (!ownMappingOptions) ownMappingOptions = {}
                    ownMappingOptions[key] = value
                } else {
                    if (!nestedCapsuleOptions) nestedCapsuleOptions = {}
                    nestedCapsuleOptions[key] = value
                }
            }
        }

        // Transform overrides if this mapping has a propertyContractDelegate
        let mappedOverrides = overrides
        if (property.definition.propertyContractDelegate) {
            // Extract overrides for the delegate property contract and map them to '#'
            // Try both capsuleSourceLineRef and capsuleName
            const delegateOverrides =
                overrides?.[this.capsule.encapsulateOptions.capsuleSourceLineRef]?.[property.definition.propertyContractDelegate] ||
                (this.capsule.encapsulateOptions.capsuleName && overrides?.[this.capsule.encapsulateOptions.capsuleName]?.[property.definition.propertyContractDelegate])

            if (delegateOverrides) {
                mappedOverrides = {
                    ...overrides,
                    [mappedCapsule.capsuleSourceLineRef]: {
                        '#': delegateOverrides
                    }
                }
                if (mappedCapsule.encapsulateOptions.capsuleName) {
                    mappedOverrides[mappedCapsule.encapsulateOptions.capsuleName] = {
                        '#': delegateOverrides
                    }
                }
            }
        }

        // Build transitive overrides for the child: merge any inherited transitive
        // overrides with this mapping's nested capsule-name-targeted options.
        // These flow as transitiveOverrides (not overrides) so they take precedence
        // over the child's own Mapping options but runtime overrides remain less specific.
        let mappedTransitiveOverrides: Record<string, any> | undefined = transitiveOverrides
        if (nestedCapsuleOptions) {
            mappedTransitiveOverrides = { ...(mappedTransitiveOverrides || {}) }
            for (const [capsuleNameKey, capsuleOptions] of Object.entries(nestedCapsuleOptions)) {
                mappedTransitiveOverrides[capsuleNameKey] = {
                    ...(mappedTransitiveOverrides[capsuleNameKey] || {}),
                    ...capsuleOptions
                }
            }
        }

        const apiTarget = this.getApiTarget({ property })
        const mappedInstance = await mappedCapsule.makeInstance({
            overrides: mappedOverrides,
            options: ownMappingOptions,
            transitiveOverrides: mappedTransitiveOverrides,
            runtimeSpineContracts: this.runtimeSpineContracts,
            rootCapsule: this.capsuleInstance?.rootCapsule,
            parentCapsuleSourceUriLineRefInstanceId: this.capsuleInstance?.capsuleSourceUriLineRefInstanceId,
            sit: this.capsuleInstance?.sit,
            skipCache: isCapsuleStruct,
            freezePhase: this.capsuleInstance?.freezePhase || undefined
        })

        // Register the instance (replaces null pre-registration marker)
        // Always register to make instance available for child capsules with deferred proxies
        // Property contract delegates skip registry (each parent gets its own instance)
        if (capsuleName && this.instanceRegistry && !isCapsuleStruct) {
            this.instanceRegistry.set(capsuleName, mappedInstance)
        }

        apiTarget[property.name] = mappedInstance
        mappedInstance.mappedPropertyName = property.name
        if (property.definition.propertyContractDelegate) {
            mappedInstance.isPropertyContractDelegate = true
        }
        this.mappedCapsuleInstances.push(mappedInstance)
        // Use proxy to unwrap .api for this.self so internal references work
        this.self[property.name] = mappedInstance.api ? new Proxy(mappedInstance.api, {
            get: (target, prop) => {
                const value = target[prop]
                // Recursively unwrap nested .api objects
                if (value && typeof value === 'object' && value.api) {
                    return value.api
                }
                return value
            }
        }) : mappedInstance

        // If this mapping has a propertyContractDelegate, also mount the mapped capsule's API
        // to the property contract namespace for direct access.
        // Use a proxy so that later mutations to the delegate's API (e.g. CapsuleProjectionContext
        // injection during freeze) are visible through the parent's encapsulatedApi.
        if (property.definition.propertyContractDelegate) {
            this.encapsulatedApi[property.definition.propertyContractDelegate] = new Proxy(mappedInstance.api, {
                get: (target: any, prop: string | symbol) => target[prop],
                set: (target: any, prop: string | symbol, value: any) => { target[prop] = value; return true },
                ownKeys: (target: any) => Reflect.ownKeys(target),
                getOwnPropertyDescriptor: (target: any, prop: string | symbol) => Object.getOwnPropertyDescriptor(target, prop) || { configurable: true, enumerable: true, writable: true, value: target[prop] },
                has: (target: any, prop: string | symbol) => prop in target,
            })
        }
    }

    protected mapLiteralProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        // Use existing value from self if defined, otherwise use property definition
        // This preserves values set by child capsules in the extends chain
        const existingValue = this.self[property.name]
        const value = existingValue !== undefined
            ? existingValue
            : property.definition.value

        // Assign to both apiTarget and self so getter functions can access via this
        apiTarget[property.name] = value
        // Only update self if it wasn't already set (preserve child values)
        if (existingValue === undefined) {
            this.self[property.name] = value
        }
    }

    protected mapConstantGetterFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        // Pass self as constants — at instance creation time self contains capsule
        // metadata, resolved Mappings, and all previously-processed properties.
        const value = property.definition.value({ constants: this.self })

        // Store eagerly like a Constant — available on self for subsequent properties
        apiTarget[property.name] = value
        this.self[property.name] = value
        if (this.ownSelf) {
            this.ownSelf[property.name] = value
        }
    }

    protected createSelfProxy() {
        const extendedApi = this.extendedCapsuleInstance?.api
        const ownSelf = this.ownSelf
        const factory = this
        return new Proxy(this.self, {
            get: (target: any, prop: string | symbol) => {
                if (typeof prop === 'symbol') return target[prop]

                // 'self' property returns ownSelf (only this capsule's own properties)
                if (prop === 'self' && ownSelf) {
                    return ownSelf
                }

                // First check if the property exists in target (this.self)
                if (prop in target) {
                    // Virtual dispatch: if child has an override for this property,
                    // prefer the child's version over self (which may hold the parent's bound fn)
                    if (factory.childEncapsulatedApis) {
                        for (const childApi of factory.childEncapsulatedApis) {
                            if (prop in childApi) return childApi[prop]
                        }
                    }
                    return target[prop]
                }

                // Check child capsule APIs (virtual dispatch —
                // child overrides take precedence over parent's own API)
                if (factory.childEncapsulatedApis) {
                    for (const childApi of factory.childEncapsulatedApis) {
                        if (prop in childApi) return childApi[prop]
                    }
                }

                // Fall back to own encapsulatedApi
                if (prop in factory.encapsulatedApi) {
                    return factory.encapsulatedApi[prop]
                }

                // Fall back to extended capsule's API
                if (extendedApi && prop in extendedApi) {
                    return extendedApi[prop]
                }

                return undefined
            },
            ownKeys: (target: any) => {
                const keys = new Set<string>(Object.keys(target))
                for (const k of Object.keys(factory.encapsulatedApi)) keys.add(k)
                if (factory.childEncapsulatedApis) {
                    for (const childApi of factory.childEncapsulatedApis) {
                        for (const k of Object.keys(childApi)) keys.add(k)
                    }
                }
                if (extendedApi) {
                    for (const k of Object.keys(extendedApi)) keys.add(k)
                }
                return [...keys]
            },
            set: (target: any, prop: string | symbol, value: any) => {
                target[prop] = value
                return true
            },
            getOwnPropertyDescriptor: (target: any, prop: string | symbol) => {
                if (typeof prop === 'symbol') return Object.getOwnPropertyDescriptor(target, prop)
                if (prop in target) return Object.getOwnPropertyDescriptor(target, prop)
                if (factory.childEncapsulatedApis) {
                    for (const childApi of factory.childEncapsulatedApis) {
                        if (prop in childApi) return { configurable: true, enumerable: true, writable: true, value: childApi[prop as string] }
                    }
                }
                if (prop in factory.encapsulatedApi) return { configurable: true, enumerable: true, writable: true, value: factory.encapsulatedApi[prop as string] }
                if (extendedApi && prop in extendedApi) return { configurable: true, enumerable: true, writable: true, value: extendedApi[prop as string] }
                return undefined
            }
        })
    }

    protected mapFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        const memoizeOption = property.definition.memoize
        const shouldMemoize = memoizeOption === true || typeof memoizeOption === 'number'
        const memoizeTtl = typeof memoizeOption === 'number' ? memoizeOption : null
        const cacheKey = `function:${property.name}`

        if (shouldMemoize) {
            // Wrap the function to support memoization
            apiTarget[property.name] = (...args: any[]) => {
                if (this.memoizeCache.has(cacheKey)) {
                    return this.memoizeCache.get(cacheKey)
                }
                const result = boundFunction(...args)
                this.memoizeCache.set(cacheKey, result)

                // Set up TTL expiration if specified
                if (memoizeTtl !== null) {
                    // Clear any existing timeout for this key
                    if (this.memoizeTimeouts.has(cacheKey)) {
                        clearTimeout(this.memoizeTimeouts.get(cacheKey))
                    }
                    const timeout = setTimeout(() => {
                        this.memoizeCache.delete(cacheKey)
                        this.memoizeTimeouts.delete(cacheKey)
                    }, memoizeTtl)
                    this.memoizeTimeouts.set(cacheKey, timeout)
                }

                return result
            }
        } else {
            apiTarget[property.name] = boundFunction
        }
    }

    protected mapGetterFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const getterFn = property.definition.value
        const selfProxy = this.createSelfProxy()
        const memoizeOption = property.definition.memoize
        const shouldMemoize = memoizeOption === true || typeof memoizeOption === 'number'
        const memoizeTtl = typeof memoizeOption === 'number' ? memoizeOption : null
        const cacheKey = `getter:${property.name}`

        // Helper to set up TTL expiration
        const setupTtlExpiration = () => {
            if (memoizeTtl !== null) {
                // Clear any existing timeout for this key
                if (this.memoizeTimeouts.has(cacheKey)) {
                    clearTimeout(this.memoizeTimeouts.get(cacheKey))
                }
                const timeout = setTimeout(() => {
                    this.memoizeCache.delete(cacheKey)
                    this.memoizeTimeouts.delete(cacheKey)
                }, memoizeTtl)
                this.memoizeTimeouts.set(cacheKey, timeout)
            }
        }

        // Define a lazy getter that calls the function only when accessed with proper this context
        Object.defineProperty(apiTarget, property.name, {
            get: () => {
                // Check memoize cache first
                if (shouldMemoize && this.memoizeCache.has(cacheKey)) {
                    return this.memoizeCache.get(cacheKey)
                }

                const result = getterFn.call(selfProxy)

                // Store in memoize cache if memoize is enabled
                if (shouldMemoize) {
                    this.memoizeCache.set(cacheKey, result)
                    setupTtlExpiration()
                }

                return result
            },
            enumerable: true,
            configurable: true
        })

        // Also define the getter on ownSelf so this.self.propertyName works for getter functions
        // This ensures this.self accesses the getter, not a raw value
        if (this.ownSelf) {
            Object.defineProperty(this.ownSelf, property.name, {
                get: () => {
                    // For ownSelf, also respect memoization
                    if (shouldMemoize && this.memoizeCache.has(cacheKey)) {
                        return this.memoizeCache.get(cacheKey)
                    }
                    const result = getterFn.call(selfProxy)
                    if (shouldMemoize) {
                        this.memoizeCache.set(cacheKey, result)
                        setupTtlExpiration()
                    }
                    return result
                },
                enumerable: true,
                configurable: true
            })
        }
    }

    protected mapProxyFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const selfProxy = this.createSelfProxy()

        const childTargetFn = property.definition.value.target
        const childInvokeFn = property.definition.value.invoke

        // Inherit missing parts from parent's ProxyFunction (if extending)
        const parentParts = this.self[`__proxyFn_${property.name}`]
        const targetFn = childTargetFn ?? parentParts?.target
        const invokeFn = childInvokeFn ?? parentParts?.invoke

        if (!targetFn) throw new Error(`ProxyFunction '${property.name}': target() is required`)
        if (!invokeFn) throw new Error(`ProxyFunction '${property.name}': invoke() is required`)

        // Store parts for potential child override
        this.self[`__proxyFn_${property.name}`] = { target: targetFn, invoke: invokeFn }

        apiTarget[property.name] = (...args: any[]) => {
            // 1. Call invoke() bound to selfProxy to transform args
            const transformedArgs = invokeFn.call(selfProxy, ...args)
            // 2. Call target() bound to selfProxy to get the function to call
            const target = targetFn.call(selfProxy)
            // 3. If invoke returned a promise, await it then call target
            if (transformedArgs && typeof transformedArgs.then === 'function') {
                return transformedArgs.then((resolved: any) => target(resolved))
            }
            // 4. Call target with the transformed args
            return target(transformedArgs)
        }
    }

    protected mapSetterFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const setterFn = property.definition.value
        const selfProxy = this.createSelfProxy()

        // Define a setter that calls the function when the property is assigned
        Object.defineProperty(apiTarget, property.name, {
            set: (value: any) => {
                setterFn.call(selfProxy, value)
            },
            enumerable: true,
            configurable: true
        })

        // Also define the setter on ownSelf so this.self.propertyName = value works
        if (this.ownSelf) {
            Object.defineProperty(this.ownSelf, property.name, {
                set: (value: any) => {
                    setterFn.call(selfProxy, value)
                },
                enumerable: true,
                configurable: true
            })
        }
    }

    protected mapStructInitProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        this.structInitFunctions.push(boundFunction)
    }

    protected mapStructDisposeProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        this.structDisposeFunctions.push(boundFunction)
    }

    protected mapInitProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        this.initFunctions.push(boundFunction)
    }

    protected mapDisposeProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        this.disposeFunctions.push(boundFunction)
    }

    protected mapOnFreezeProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        this.onFreezeFunctions.push(boundFunction)
    }

    async freeze(options: any): Promise<any> {
        return this.freezeCapsule?.(options) || {}
    }

    public clearMemoizeTimeouts() {
        for (const timeout of this.memoizeTimeouts.values()) {
            clearTimeout(timeout)
        }
        this.memoizeTimeouts.clear()
    }

}




export function CapsuleSpineContract({ freezeCapsule, resolve, importCapsule, spineFilesystemRoot, timing }: { freezeCapsule?: (capsule: any) => Promise<any>, resolve?: (uri: string, parentFilepath: string) => Promise<string>, importCapsule?: (filepath: string) => Promise<any>, spineFilesystemRoot?: string, timing?: TimingObserverInterface } = {}) {

    const instanceRegistry: CapsuleInstanceRegistry = new Map()

    return {
        '#': CapsuleSpineContract['#'],
        instanceRegistry,
        makeContractCapsuleInstance: ({ spineContractUri, capsule, self, ownSelf, encapsulatedApi, extendedCapsuleInstance, runtimeSpineContracts, capsuleInstance }: { spineContractUri: string, capsule: any, self: any, ownSelf?: any, encapsulatedApi: Record<string, any>, extendedCapsuleInstance?: any, runtimeSpineContracts?: Record<string, any>, capsuleInstance?: any }) => {
            return new ContractCapsuleInstanceFactory({
                spineContractUri,
                capsule,
                self,
                ownSelf,
                encapsulatedApi,
                resolve,
                importCapsule,
                spineFilesystemRoot,
                freezeCapsule,
                instanceRegistry,
                extendedCapsuleInstance,
                runtimeSpineContracts,
                capsuleInstance,
                timing
            })
        },
        hydrate: ({ capsuleSnapshot }: { capsuleSnapshot: any }): any => {

            return capsuleSnapshot
        }
    }
}

CapsuleSpineContract['#'] = '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'
