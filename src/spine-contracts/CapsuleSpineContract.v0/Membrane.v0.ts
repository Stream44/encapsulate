import { CapsulePropertyTypes } from "../../encapsulate"
import { ContractCapsuleInstanceFactory, CapsuleInstanceRegistry } from "./Static.v0"

type CallerContext = {
    capsuleSourceLineRef: string
    capsuleSourceNameRef?: string
    spineContractCapsuleInstanceId: string
    capsuleSourceNameRefHash?: string
    capsuleSourceUriLineRefInstanceId?: string
    prop?: string
    filepath?: string
    line?: number
    stack?: Array<{ function?: string, filepath?: string, line?: number, column?: number }>
}

function CapsuleMembrane(target: Record<string, any>, hooks?: {
    onGet?: (data: { prop: string, value: any }) => void
    onSet?: (data: { prop: string, value: any }) => void
    onBeforeCall?: (data: { prop: string, args: any[] }) => void
    onAfterCall?: (data: { prop: string, result: any, args: any[] }) => void
}, callerContext?: CallerContext) {
    return new Proxy(target, {
        get(obj: any, prop: string | symbol) {
            if (typeof prop === 'symbol') return obj[prop]

            const value = obj[prop]
            hooks?.onGet?.({ prop: prop as string, value })

            if (typeof value === 'function') {
                return function (this: any, ...args: any[]) {
                    hooks?.onBeforeCall?.({ prop: prop as string, args })
                    const result = value.apply(this, args)
                    hooks?.onAfterCall?.({ prop: prop as string, args, result })
                    return result
                }
            }

            return value
        },
        set(obj: any, prop: string | symbol, value: any) {
            if (typeof prop === 'symbol') {
                obj[prop] = value
                return true
            }

            hooks?.onSet?.({ prop: prop as string, value })
            obj[prop] = value
            return true
        }
    })
}


class MembraneContractCapsuleInstanceFactory extends ContractCapsuleInstanceFactory {
    private getEventIndex: () => number
    private incrementEventIndex: () => number
    private getCurrentCallerContext: () => CallerContext | undefined
    private setCurrentCallerContext: (ctx: CallerContext | undefined) => void
    private onMembraneEvent?: (event: any) => void
    private enableCallerStackInference: boolean
    private encapsulateOptions: any
    private capsuleSourceNameRef?: string
    private capsuleSourceNameRefHash?: string
    protected override runtimeSpineContracts?: Record<string, any>
    public id: string

    constructor({
        spineContractUri,
        capsule,
        self,
        ownSelf,
        encapsulatedApi,
        resolve,
        importCapsule,
        spineFilesystemRoot,
        freezeCapsule,
        onMembraneEvent,
        enableCallerStackInference,
        encapsulateOptions,
        getEventIndex,
        incrementEventIndex,
        getCurrentCallerContext,
        setCurrentCallerContext,
        runtimeSpineContracts,
        instanceRegistry,
        extendedCapsuleInstance,
        capsuleInstance
    }: {
        spineContractUri: string
        capsule: any
        self: any
        ownSelf?: any
        encapsulatedApi: Record<string, any>
        resolve?: (uri: string, parentFilepath: string) => Promise<string>
        importCapsule?: (filepath: string) => Promise<any>
        spineFilesystemRoot?: string
        freezeCapsule?: (capsule: any) => Promise<any>
        onMembraneEvent?: (event: any) => void
        enableCallerStackInference: boolean
        encapsulateOptions: any
        getEventIndex: () => number
        incrementEventIndex: () => number
        getCurrentCallerContext: () => CallerContext | undefined
        setCurrentCallerContext: (ctx: CallerContext | undefined) => void
        runtimeSpineContracts?: Record<string, any>
        instanceRegistry?: CapsuleInstanceRegistry
        extendedCapsuleInstance?: any
        capsuleInstance?: any
    }) {
        super({ spineContractUri, capsule, self, ownSelf, encapsulatedApi, resolve, importCapsule, spineFilesystemRoot, freezeCapsule, instanceRegistry, extendedCapsuleInstance, capsuleInstance })
        this.getEventIndex = getEventIndex
        this.incrementEventIndex = incrementEventIndex
        this.getCurrentCallerContext = getCurrentCallerContext
        this.setCurrentCallerContext = setCurrentCallerContext
        this.onMembraneEvent = onMembraneEvent
        this.enableCallerStackInference = enableCallerStackInference
        this.encapsulateOptions = encapsulateOptions
        this.capsuleSourceNameRef = capsule?.cst?.capsuleSourceNameRef
        this.capsuleSourceNameRefHash = capsule?.cst?.capsuleSourceNameRefHash
        this.runtimeSpineContracts = runtimeSpineContracts
        this.id = `$${encapsulateOptions.capsuleSourceLineRef}`
    }

    private buildCallerContext(prop?: string): CallerContext {
        const ctx: CallerContext = {
            capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
            spineContractCapsuleInstanceId: this.id,
        }
        if (prop) ctx.prop = prop
        if (this.capsuleSourceNameRef) ctx.capsuleSourceNameRef = this.capsuleSourceNameRef
        if (this.capsuleSourceNameRefHash) ctx.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
        if (this.capsuleInstance?.capsuleSourceUriLineRefInstanceId) ctx.capsuleSourceUriLineRefInstanceId = this.capsuleInstance.capsuleSourceUriLineRefInstanceId
        return ctx
    }

    protected async mapMappingProperty({ overrides, options, property }: { overrides: any, options: any, property: any }) {

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
        const mappingOptions = property.definition.delegateOptions
            || (typeof optionsFn === 'function'
                ? await optionsFn({ self: property.definition.depends ? this.self : minimalSelf, constants })
                : optionsFn)

        // Check for existing instance in registry - reuse if available (regardless of options)
        // Pre-registration with null allows parent capsules to "claim" a slot before child capsules process
        // Property contract delegates (structs) always get a fresh instance per parent capsule
        const capsuleName = mappedCapsule.encapsulateOptions?.capsuleName
        const isCapsuleStruct = property.definition.propertyContractDelegate === '#@stream44.studio/encapsulate/structs/Capsule'

        if (capsuleName && this.instanceRegistry && !isCapsuleStruct) {
            if (this.instanceRegistry.has(capsuleName)) {
                const existingEntry = this.instanceRegistry.get(capsuleName)

                // If entry is null (pre-registered) or actual instance, and current mapping has no options, use deferred proxy
                if (!mappingOptions) {
                    // Use deferred proxy that resolves from registry when accessed
                    const apiTarget = this.getApiTarget({ property })
                    const registry = this.instanceRegistry
                    apiTarget[property.name] = new Proxy({} as any, {
                        get: (_target: any, apiProp: string | symbol) => {
                            if (typeof apiProp === 'symbol') return undefined
                            const resolvedInstance = registry.get(capsuleName)
                            if (!resolvedInstance) {
                                throw new Error(`Capsule instance not yet resolved: ${capsuleName}`)
                            }

                            // Only update caller context if not already set by a function/getter execution
                            if (!this.getCurrentCallerContext()) {
                                const callerCtx = this.buildCallerContext(undefined)

                                if (this.enableCallerStackInference) {
                                    const stackStr = new Error('[MAPPED_CAPSULE]').stack
                                    if (stackStr) {
                                        const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                                        if (stackFrames.length > 0) {
                                            const callerInfo = extractCallerInfo(stackFrames, 3)
                                            callerCtx.filepath = callerInfo.filepath
                                            callerCtx.line = callerInfo.line
                                            callerCtx.stack = stackFrames
                                        }
                                    }
                                }
                                this.setCurrentCallerContext(callerCtx)
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
                            const value = resolvedInstance.api?.[prop]
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

        // Merge nested capsule-name-targeted options into overrides
        // These will be picked up when child capsules with matching names are instantiated
        if (nestedCapsuleOptions) {
            mappedOverrides = { ...mappedOverrides }
            for (const [capsuleNameKey, capsuleOptions] of Object.entries(nestedCapsuleOptions)) {
                mappedOverrides[capsuleNameKey] = {
                    ...(mappedOverrides[capsuleNameKey] || {}),
                    ...capsuleOptions
                }
            }
        }

        const mappedCapsuleInstance = await mappedCapsule.makeInstance({
            overrides: mappedOverrides,
            options: ownMappingOptions,
            runtimeSpineContracts: this.runtimeSpineContracts,
            rootCapsule: this.capsuleInstance?.rootCapsule,
            parentCapsuleSourceUriLineRefInstanceId: this.capsuleInstance?.capsuleSourceUriLineRefInstanceId,
            sit: this.capsuleInstance?.sit,
            skipCache: isCapsuleStruct
        })

        // Register the instance (replaces null pre-registration marker)
        // Always register to make instance available for child capsules with deferred proxies
        // Property contract delegates skip registry (each parent gets its own instance)
        if (capsuleName && this.instanceRegistry && !isCapsuleStruct) {
            this.instanceRegistry.set(capsuleName, mappedCapsuleInstance)
        }

        this.mappedCapsuleInstances.push(mappedCapsuleInstance)

        const apiTarget = this.getApiTarget({ property })
        apiTarget[property.name] = new Proxy(mappedCapsuleInstance, {
            get: (apiTarget: any, apiProp: string | symbol) => {
                if (typeof apiProp === 'symbol') return apiTarget[apiProp]

                // Only update caller context if not already set by a function/getter execution
                if (!this.getCurrentCallerContext()) {
                    const callerCtx = this.buildCallerContext(undefined)

                    if (this.enableCallerStackInference) {
                        const stackStr = new Error('[MAPPED_CAPSULE]').stack
                        if (stackStr) {
                            const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                            if (stackFrames.length > 0) {
                                const callerInfo = extractCallerInfo(stackFrames, 3)
                                callerCtx.filepath = callerInfo.filepath
                                callerCtx.line = callerInfo.line
                                callerCtx.stack = stackFrames
                            }
                        }
                    }
                    this.setCurrentCallerContext(callerCtx)
                }

                // Access through .api if it exists (for capsule instances with getters)
                if (apiTarget.api && apiProp in apiTarget.api) {
                    return apiTarget.api[apiProp]
                }
                return apiTarget[apiProp]
            }
        })

        // Wrap unwrapped API in membrane proxy for this.self
        this.self[property.name] = mappedCapsuleInstance.api ? new Proxy(mappedCapsuleInstance.api, {
            get: (target, prop) => {
                if (typeof prop === 'symbol') return target[prop]

                const value = target[prop]
                // Recursively unwrap nested .api objects
                if (value && typeof value === 'object' && value.api) {
                    return value.api
                }
                return value
            }
        }) : mappedCapsuleInstance

        // If this mapping has a propertyContractDelegate, also mount the mapped capsule's properties
        // to the property contract namespace for direct access
        if (property.definition.propertyContractDelegate) {
            // Create the property contract namespace if it doesn't exist
            if (!this.encapsulatedApi[property.definition.propertyContractDelegate]) {
                this.encapsulatedApi[property.definition.propertyContractDelegate] = {}
            }

            // Get property definitions from the mapped capsule's CST instead of accessing .api
            // This avoids triggering the proxy and firing unwanted membrane events
            const delegateTarget = this.encapsulatedApi[property.definition.propertyContractDelegate]
            const mappedCapsuleCst = mappedCapsule.cst
            const spineContractProperties = mappedCapsuleCst?.spineContracts?.[this.spineContractUri]?.propertyContracts

            if (spineContractProperties) {
                for (const [key, propDef] of Object.entries(spineContractProperties)) {
                    // Skip internal properties that start with '#'
                    if (key.startsWith('#')) continue

                    // Wrap the property access in a proxy to track membrane events
                    Object.defineProperty(delegateTarget, key, {
                        get: () => {
                            // Only update caller context if not already set by a function/getter execution
                            if (!this.getCurrentCallerContext()) {
                                const callerCtx = this.buildCallerContext(undefined)

                                if (this.enableCallerStackInference) {
                                    const stackStr = new Error('[PROPERTY_CONTRACT_DELEGATE]').stack
                                    if (stackStr) {
                                        const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                                        if (stackFrames.length > 0) {
                                            const callerInfo = extractCallerInfo(stackFrames, 3)
                                            callerCtx.filepath = callerInfo.filepath
                                            callerCtx.line = callerInfo.line
                                            callerCtx.stack = stackFrames
                                        }
                                    }
                                }
                                this.setCurrentCallerContext(callerCtx)
                            }

                            // Access the actual value from the instance's api
                            return mappedCapsuleInstance.api[key]
                        },
                        enumerable: true,
                        configurable: true
                    })
                }
            }
        }
    }

    protected mapLiteralProperty({ property }: { property: any }) {
        // Constant properties are read-only and throw on set
        const isConstant = property.definition.type === CapsulePropertyTypes.Constant

        const value = typeof this.self[property.name] !== 'undefined'
            ? this.self[property.name]
            : property.definition.value

        const valueKey = `__value_${property.name}`
        Object.defineProperty(this.encapsulatedApi, valueKey, {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })

        Object.defineProperty(this.encapsulatedApi, property.name, {
            get: () => {
                // Read from self as authoritative source (functions and StructInit write to self)
                // Fall back to backing store for values set via the API setter
                const currentValue = property.name in this.self
                    ? this.self[property.name]
                    : this.encapsulatedApi[valueKey]

                const event: any = {
                    event: 'get',
                    eventIndex: this.incrementEventIndex(),
                    membrane: 'external',
                    target: {
                        capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                        spineContractCapsuleInstanceId: this.id,
                        prop: property.name,
                    },
                    value: currentValue
                }

                if (this.capsuleSourceNameRef) {
                    event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                }
                if (this.capsuleSourceNameRefHash) {
                    event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                }

                this.addCallerContextToEvent(event)
                this.onMembraneEvent?.(event)
                return currentValue
            },
            set: (newValue) => {
                // Constant properties cannot be set
                if (isConstant) {
                    throw new Error(`Cannot set constant property '${property.name}'`)
                }

                const event: any = {
                    event: 'set',
                    eventIndex: this.incrementEventIndex(),
                    membrane: 'external',
                    target: {
                        capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                        spineContractCapsuleInstanceId: this.id,
                        prop: property.name,
                    },
                    value: newValue
                }

                if (this.capsuleSourceNameRef) {
                    event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                }
                if (this.capsuleSourceNameRefHash) {
                    event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                }

                this.addCallerContextToEvent(event)
                this.onMembraneEvent?.(event)
                this.encapsulatedApi[valueKey] = newValue
                this.self[property.name] = newValue
            },
            enumerable: true,
            configurable: true
        })
    }

    protected mapFunctionProperty({ property }: { property: any }) {
        const selfProxy = this.createSelfProxy()
        const boundFunction = property.definition.value.bind(selfProxy)
        const memoizeOption = property.definition.memoize
        const shouldMemoize = memoizeOption === true || typeof memoizeOption === 'number'
        const memoizeTtl = typeof memoizeOption === 'number' ? memoizeOption : null
        const cacheKey = `function:${property.name}`

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

        const valueKey = `__value_${property.name}`
        Object.defineProperty(this.encapsulatedApi, valueKey, {
            value: boundFunction,
            writable: true,
            enumerable: false,
            configurable: true
        })

        Object.defineProperty(this.encapsulatedApi, property.name, {
            get: () => {
                return (...args: any[]) => {
                    // Check memoize cache first (only for no-arg calls or first call)
                    if (shouldMemoize && this.memoizeCache.has(cacheKey)) {
                        const cachedResult = this.memoizeCache.get(cacheKey)

                        const callEvent: any = {
                            event: 'call',
                            eventIndex: this.incrementEventIndex(),
                            membrane: 'external',
                            target: {
                                capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                                spineContractCapsuleInstanceId: this.id,
                                prop: property.name,
                            },
                            args,
                            memoized: true
                        }

                        if (this.capsuleSourceNameRef) {
                            callEvent.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                        }
                        if (this.capsuleSourceNameRefHash) {
                            callEvent.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                        }
                        if (this.capsuleInstance?.capsuleSourceUriLineRefInstanceId) {
                            callEvent.target.capsuleSourceUriLineRefInstanceId = this.capsuleInstance.capsuleSourceUriLineRefInstanceId
                        }

                        this.addCallerContextToEvent(callEvent)
                        this.onMembraneEvent?.(callEvent)

                        const resultEvent: any = {
                            event: 'call-result',
                            eventIndex: this.incrementEventIndex(),
                            membrane: 'external',
                            callEventIndex: callEvent.eventIndex,
                            target: {
                                spineContractCapsuleInstanceId: this.id,
                            },
                            result: cachedResult,
                            memoized: true
                        }

                        this.onMembraneEvent?.(resultEvent)

                        return cachedResult
                    }

                    const callEvent: any = {
                        event: 'call',
                        eventIndex: this.incrementEventIndex(),
                        membrane: 'external',
                        target: {
                            capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                            spineContractCapsuleInstanceId: this.id,
                            prop: property.name,
                        },
                        args
                    }

                    if (this.capsuleSourceNameRef) {
                        callEvent.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                    }
                    if (this.capsuleSourceNameRefHash) {
                        callEvent.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                    }
                    if (this.capsuleInstance?.capsuleSourceUriLineRefInstanceId) {
                        callEvent.target.capsuleSourceUriLineRefInstanceId = this.capsuleInstance.capsuleSourceUriLineRefInstanceId
                    }

                    this.addCallerContextToEvent(callEvent)
                    this.onMembraneEvent?.(callEvent)

                    // Set this capsule as caller for any inner membrane events triggered by the function body
                    const previousCallerContext = this.getCurrentCallerContext()
                    this.setCurrentCallerContext(this.buildCallerContext(property.name))
                    const result = boundFunction(...args)
                    this.setCurrentCallerContext(previousCallerContext)

                    // Store in memoize cache if memoize is enabled
                    if (shouldMemoize) {
                        this.memoizeCache.set(cacheKey, result)
                        setupTtlExpiration()
                    }

                    const resultEvent: any = {
                        event: 'call-result',
                        eventIndex: this.incrementEventIndex(),
                        membrane: 'external',
                        callEventIndex: callEvent.eventIndex,
                        target: {
                            spineContractCapsuleInstanceId: this.id,
                        },
                        result
                    }

                    this.onMembraneEvent?.(resultEvent)

                    return result
                }
            },
            enumerable: true,
            configurable: true
        })
    }

    protected mapGetterFunctionProperty({ property }: { property: any }) {
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

        Object.defineProperty(this.encapsulatedApi, property.name, {
            get: () => {
                // Check memoize cache first
                if (shouldMemoize && this.memoizeCache.has(cacheKey)) {
                    const cachedResult = this.memoizeCache.get(cacheKey)

                    const event: any = {
                        event: 'get',
                        eventIndex: this.incrementEventIndex(),
                        membrane: 'external',
                        target: {
                            capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                            spineContractCapsuleInstanceId: this.id,
                            prop: property.name,
                        },
                        value: cachedResult,
                        memoized: true
                    }

                    if (this.capsuleSourceNameRef) {
                        event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                    }
                    if (this.capsuleSourceNameRefHash) {
                        event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                    }

                    this.addCallerContextToEvent(event)
                    this.onMembraneEvent?.(event)
                    return cachedResult
                }

                // Set this capsule as caller for any inner membrane events triggered by the getter body
                const previousCallerContext = this.getCurrentCallerContext()
                this.setCurrentCallerContext(this.buildCallerContext(property.name))
                const result = getterFn.call(selfProxy)
                this.setCurrentCallerContext(previousCallerContext)

                // Store in memoize cache if memoize is enabled
                if (shouldMemoize) {
                    this.memoizeCache.set(cacheKey, result)
                    setupTtlExpiration()
                }

                const event: any = {
                    event: 'get',
                    eventIndex: this.incrementEventIndex(),
                    membrane: 'external',
                    target: {
                        capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                        spineContractCapsuleInstanceId: this.id,
                        prop: property.name,
                    },
                    value: result
                }

                if (this.capsuleSourceNameRef) {
                    event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                }
                if (this.capsuleSourceNameRefHash) {
                    event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                }

                this.addCallerContextToEvent(event)
                this.onMembraneEvent?.(event)
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

    protected override createSelfProxy() {
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

                // Determine the value source and get the value
                let value: any
                let source: 'self' | 'encapsulatedApi' | 'childApi' | 'extendedApi' | undefined

                if (prop in target) {
                    value = target[prop]
                    source = 'self'
                } else if (prop in factory.encapsulatedApi) {
                    value = factory.encapsulatedApi[prop]
                    source = 'encapsulatedApi'
                } else if (factory.childEncapsulatedApis) {
                    for (const childApi of factory.childEncapsulatedApis) {
                        if (prop in childApi) {
                            value = childApi[prop]
                            source = 'childApi'
                            break
                        }
                    }
                }

                if (source === undefined && extendedApi && prop in extendedApi) {
                    value = extendedApi[prop]
                    source = 'extendedApi'
                }

                // Only emit internal events if we're inside a function/getter execution (caller context is set)
                // and the property is not a function (we don't want to emit get events for function references)
                if (source && typeof value !== 'function' && this.getCurrentCallerContext()) {
                    const event: any = {
                        event: 'get',
                        eventIndex: this.incrementEventIndex(),
                        membrane: 'internal',
                        target: {
                            capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                            spineContractCapsuleInstanceId: this.id,
                            prop: prop as string,
                        },
                        value
                    }

                    if (this.capsuleSourceNameRef) {
                        event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                    }
                    if (this.capsuleSourceNameRefHash) {
                        event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                    }

                    this.addCallerContextToEvent(event)
                    this.onMembraneEvent?.(event)
                }

                return value
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
                if (typeof prop === 'symbol') {
                    target[prop] = value
                    return true
                }

                // Emit internal set event if we're inside a function/getter execution
                if (this.getCurrentCallerContext()) {
                    const event: any = {
                        event: 'set',
                        eventIndex: this.incrementEventIndex(),
                        membrane: 'internal',
                        target: {
                            capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                            spineContractCapsuleInstanceId: this.id,
                            prop: prop as string,
                        },
                        value
                    }

                    if (this.capsuleSourceNameRef) {
                        event.target.capsuleSourceNameRef = this.capsuleSourceNameRef
                    }
                    if (this.capsuleSourceNameRefHash) {
                        event.target.capsuleSourceNameRefHash = this.capsuleSourceNameRefHash
                    }

                    this.addCallerContextToEvent(event)
                    this.onMembraneEvent?.(event)
                }

                target[prop] = value
                return true
            },
            getOwnPropertyDescriptor: (target: any, prop: string | symbol) => {
                if (typeof prop === 'symbol') return Object.getOwnPropertyDescriptor(target, prop)
                if (prop in target) return Object.getOwnPropertyDescriptor(target, prop)
                if (prop in factory.encapsulatedApi) return { configurable: true, enumerable: true, writable: true, value: factory.encapsulatedApi[prop as string] }
                if (factory.childEncapsulatedApis) {
                    for (const childApi of factory.childEncapsulatedApis) {
                        if (prop in childApi) return { configurable: true, enumerable: true, writable: true, value: childApi[prop as string] }
                    }
                }
                if (extendedApi && prop in extendedApi) return { configurable: true, enumerable: true, writable: true, value: extendedApi[prop as string] }
                return undefined
            }
        })
    }

    private addCallerContextToEvent(event: any): void {
        const callerCtx = this.getCurrentCallerContext()
        if (callerCtx) {
            event.caller = {
                capsuleSourceLineRef: callerCtx.capsuleSourceLineRef,
                spineContractCapsuleInstanceId: callerCtx.spineContractCapsuleInstanceId,
            }
            if (callerCtx.capsuleSourceNameRef) {
                event.caller.capsuleSourceNameRef = callerCtx.capsuleSourceNameRef
            }
            if (callerCtx.capsuleSourceNameRefHash) {
                event.caller.capsuleSourceNameRefHash = callerCtx.capsuleSourceNameRefHash
            }
            if (callerCtx.capsuleSourceUriLineRefInstanceId) {
                event.caller.capsuleSourceUriLineRefInstanceId = callerCtx.capsuleSourceUriLineRefInstanceId
            }
            if (callerCtx.prop) {
                event.caller.prop = callerCtx.prop
            }
            if (callerCtx.filepath) {
                event.caller.filepath = callerCtx.filepath
            }
            if (callerCtx.line) {
                event.caller.line = callerCtx.line
            }
            if (callerCtx.stack) {
                event.caller.stack = callerCtx.stack
            }
        } else if (this.enableCallerStackInference) {
            const stackStr = new Error('[MEMBRANE_EVENT]').stack
            if (stackStr) {
                const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                if (stackFrames.length > 0) {
                    const callerInfo = extractCallerInfo(stackFrames, 3)
                    event.caller = {
                        ...callerInfo,
                        stack: stackFrames
                    }
                }
            }
        }
    }
}

export function CapsuleSpineContract({
    onMembraneEvent,
    freezeCapsule,
    enableCallerStackInference = false,
    spineFilesystemRoot,
    resolve,
    importCapsule
}: {
    onMembraneEvent?: (event: any) => void
    freezeCapsule?: (capsule: any) => Promise<any>
    enableCallerStackInference?: boolean
    spineFilesystemRoot?: string
    resolve?: (uri: string, parentFilepath: string) => Promise<string>
    importCapsule?: (filepath: string) => Promise<any>
} = {}) {

    let eventIndex = 0
    let currentCallerContext: CallerContext | undefined = undefined
    const instanceRegistry: CapsuleInstanceRegistry = new Map()

    // Re-entrancy guard: suppress event emission while inside an onMembraneEvent callback.
    // This prevents consumers (e.g. JSON.stringify on event.value) from triggering proxy getters
    // that would cause spurious recursive membrane events with wrong caller context and ordering.
    let isEmittingEvent = false
    const guardedOnMembraneEvent = onMembraneEvent ? (event: any) => {
        if (isEmittingEvent) return
        isEmittingEvent = true
        try {
            onMembraneEvent(event)
        } finally {
            isEmittingEvent = false
        }
    } : undefined

    return {
        '#': CapsuleSpineContract['#'],
        instanceRegistry,
        makeContractCapsuleInstance: ({ encapsulateOptions, spineContractUri, self, ownSelf, capsule, encapsulatedApi, runtimeSpineContracts, extendedCapsuleInstance, capsuleInstance }: { encapsulateOptions: any, spineContractUri: string, self: any, ownSelf?: any, capsule?: any, encapsulatedApi: Record<string, any>, runtimeSpineContracts?: Record<string, any>, extendedCapsuleInstance?: any, capsuleInstance?: any }) => {
            return new MembraneContractCapsuleInstanceFactory({
                spineContractUri,
                capsule,
                self,
                ownSelf,
                encapsulatedApi,
                spineFilesystemRoot,
                freezeCapsule,
                resolve,
                importCapsule,
                onMembraneEvent: guardedOnMembraneEvent,
                enableCallerStackInference,
                encapsulateOptions,
                getEventIndex: () => eventIndex,
                incrementEventIndex: () => eventIndex++,
                getCurrentCallerContext: () => currentCallerContext,
                setCurrentCallerContext: (ctx: CallerContext | undefined) => { currentCallerContext = ctx },
                runtimeSpineContracts,
                instanceRegistry,
                extendedCapsuleInstance,
                capsuleInstance
            })
        },
        hydrate: ({ capsuleSnapshot }: { capsuleSnapshot: any }): any => {
            return capsuleSnapshot
        }
    }
}

CapsuleSpineContract['#'] = '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'




function parseCallerFromStack(stack: string, spineFilesystemRoot?: string): Array<{ function?: string, filepath?: string, line?: number, column?: number }> {
    const lines = stack.split('\n')
    const result: Array<{ function?: string, filepath?: string, line?: number, column?: number }> = []

    // Skip first line (Error message), then collect ALL frames
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()

        // Match various stack trace formats:
        // "at functionName (/path/to/file:line:column)"
        // "at /path/to/file:line:column"
        // "at functionName (file:line:column)"
        const match = line.match(/at\s+(.+)/)
        if (match) {
            const frame: { function?: string, filepath?: string, line?: number, column?: number } = {}
            const content = match[1]

            // Try to extract function name and location
            const funcMatch = content.match(/^(.+?)\s+\((.+)\)$/)
            if (funcMatch) {
                // Has function name: "functionName (/path/to/file:line:column)"
                const funcName = funcMatch[1].trim()
                // Only include function name if not anonymous
                if (funcName !== '<anonymous>' && funcName !== 'async <anonymous>') {
                    frame.function = funcName
                }
                const location = funcMatch[2]
                const locMatch = location.match(/^(.+):(\d+):(\d+)$/)
                if (locMatch) {
                    frame.filepath = locMatch[1]
                    frame.line = parseInt(locMatch[2], 10)
                    frame.column = parseInt(locMatch[3], 10)
                }
            } else {
                // No function name: "/path/to/file:line:column"
                const locMatch = content.match(/^(.+):(\d+):(\d+)$/)
                if (locMatch) {
                    frame.filepath = locMatch[1]
                    frame.line = parseInt(locMatch[2], 10)
                    frame.column = parseInt(locMatch[3], 10)
                }
            }

            // Convert absolute paths to relative paths if spineFilesystemRoot is provided
            if (frame.filepath && spineFilesystemRoot) {
                if (frame.filepath.startsWith(spineFilesystemRoot)) {
                    frame.filepath = frame.filepath.slice(spineFilesystemRoot.length)
                    // Remove leading slash if present
                    if (frame.filepath.startsWith('/')) {
                        frame.filepath = frame.filepath.slice(1)
                    }
                }
            }

            // Include all frames, even if incomplete
            if (frame.filepath || frame.function) {
                result.push(frame)
            }
        }
    }
    return result
}

function extractCallerInfo(stack: Array<{ function?: string, filepath?: string, line?: number, column?: number }>, offset: number = 0) {
    // Use offset to skip frames in the stack
    // offset 0 = first frame, offset 1 = second frame, etc.

    if (offset < stack.length) {
        const frame = stack[offset]
        return {
            filepath: frame.filepath,
            line: frame.line
        }
    }

    // Fallback to first frame if offset is out of bounds
    if (stack.length > 0) {
        return {
            filepath: stack[0].filepath,
            line: stack[0].line
        }
    }
    return {}
}

