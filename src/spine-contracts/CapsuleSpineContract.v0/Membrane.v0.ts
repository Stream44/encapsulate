import { CapsulePropertyTypes } from "../../encapsulate"
import { ContractCapsuleInstanceFactory, CapsuleInstanceRegistry } from "./Static.v0"

type CallerContext = {
    capsuleSourceLineRef: string
    capsuleSourceNameRef?: string
    spineContractCapsuleInstanceId: string
    capsuleSourceNameRefHash?: string
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
    private currentCallerContext: CallerContext | undefined
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
        currentCallerContext,
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
        currentCallerContext?: CallerContext
        runtimeSpineContracts?: Record<string, any>
        instanceRegistry?: CapsuleInstanceRegistry
        extendedCapsuleInstance?: any
        capsuleInstance?: any
    }) {
        super({ spineContractUri, capsule, self, ownSelf, encapsulatedApi, resolve, importCapsule, spineFilesystemRoot, freezeCapsule, instanceRegistry, extendedCapsuleInstance, capsuleInstance })
        this.getEventIndex = getEventIndex
        this.incrementEventIndex = incrementEventIndex
        this.currentCallerContext = currentCallerContext
        this.onMembraneEvent = onMembraneEvent
        this.enableCallerStackInference = enableCallerStackInference
        this.encapsulateOptions = encapsulateOptions
        this.capsuleSourceNameRef = capsule?.cst?.capsuleSourceNameRef
        this.capsuleSourceNameRefHash = capsule?.cst?.capsuleSourceNameRefHash
        this.runtimeSpineContracts = runtimeSpineContracts
        this.id = `$${encapsulateOptions.capsuleSourceLineRef}`
    }

    setCurrentCallerContext(context: CallerContext | undefined): void {
        this.currentCallerContext = context
    }

    protected async mapMappingProperty({ overrides, options, property }: { overrides: any, options: any, property: any }) {

        const mappedCapsule = await this.resolveMappedCapsule({ property })
        const constants = await this.extractConstants({ mappedCapsule })

        // delegateOptions is set by encapsulate.ts for property contract delegates
        // options can be a function or an object for regular mappings
        const mappingOptions = property.definition.delegateOptions
            || (typeof property.definition.options === 'function'
                ? await property.definition.options({ constants })
                : property.definition.options)

        // Check for existing instance in registry - reuse if available (regardless of options)
        // Pre-registration with null allows parent capsules to "claim" a slot before child capsules process
        const capsuleName = mappedCapsule.encapsulateOptions?.capsuleName

        if (capsuleName && this.instanceRegistry) {
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

                            this.currentCallerContext = {
                                capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                                capsuleSourceNameRef: this.capsuleSourceNameRef,
                                spineContractCapsuleInstanceId: this.id,
                                capsuleSourceNameRefHash: this.capsuleSourceNameRefHash,
                                prop: apiProp as string
                            }

                            if (this.enableCallerStackInference) {
                                const stackStr = new Error('[MAPPED_CAPSULE]').stack
                                if (stackStr) {
                                    const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                                    if (stackFrames.length > 0) {
                                        const callerInfo = extractCallerInfo(stackFrames, 3)
                                        this.currentCallerContext.filepath = callerInfo.filepath
                                        this.currentCallerContext.line = callerInfo.line
                                        this.currentCallerContext.stack = stackFrames
                                    }
                                }
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

        const mappedCapsuleInstance = await mappedCapsule.makeInstance({
            overrides: mappedOverrides,
            options: mappingOptions,
            runtimeSpineContracts: this.runtimeSpineContracts,
            rootCapsule: this.capsuleInstance?.rootCapsule
        })

        // Register the instance (replaces null pre-registration marker)
        // Always register to make instance available for child capsules with deferred proxies
        if (capsuleName && this.instanceRegistry) {
            this.instanceRegistry.set(capsuleName, mappedCapsuleInstance)
        }

        this.mappedCapsuleInstances.push(mappedCapsuleInstance)

        const apiTarget = this.getApiTarget({ property })
        apiTarget[property.name] = new Proxy(mappedCapsuleInstance, {
            get: (apiTarget: any, apiProp: string | symbol) => {
                if (typeof apiProp === 'symbol') return apiTarget[apiProp]

                this.currentCallerContext = {
                    capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                    capsuleSourceNameRef: this.capsuleSourceNameRef,
                    spineContractCapsuleInstanceId: this.id,
                    capsuleSourceNameRefHash: this.capsuleSourceNameRefHash,
                    prop: apiProp as string
                }

                if (this.enableCallerStackInference) {
                    const stackStr = new Error('[MAPPED_CAPSULE]').stack
                    if (stackStr) {
                        const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                        if (stackFrames.length > 0) {
                            const callerInfo = extractCallerInfo(stackFrames, 3)
                            this.currentCallerContext.filepath = callerInfo.filepath
                            this.currentCallerContext.line = callerInfo.line
                            this.currentCallerContext.stack = stackFrames
                        }
                    }
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
            const spineContractProperties = mappedCapsuleCst?.spineContracts?.[this.spineContractUri]?.properties

            if (spineContractProperties) {
                for (const [key, propDef] of Object.entries(spineContractProperties)) {
                    // Skip internal properties that start with '#'
                    if (key.startsWith('#')) continue

                    // Wrap the property access in a proxy to track membrane events
                    Object.defineProperty(delegateTarget, key, {
                        get: () => {
                            this.currentCallerContext = {
                                capsuleSourceLineRef: this.encapsulateOptions.capsuleSourceLineRef,
                                capsuleSourceNameRef: this.capsuleSourceNameRef,
                                spineContractCapsuleInstanceId: this.id,
                                capsuleSourceNameRefHash: this.capsuleSourceNameRefHash,
                                prop: key
                            }

                            if (this.enableCallerStackInference) {
                                const stackStr = new Error('[PROPERTY_CONTRACT_DELEGATE]').stack
                                if (stackStr) {
                                    const stackFrames = parseCallerFromStack(stackStr, this.spineFilesystemRoot)
                                    if (stackFrames.length > 0) {
                                        const callerInfo = extractCallerInfo(stackFrames, 3)
                                        this.currentCallerContext.filepath = callerInfo.filepath
                                        this.currentCallerContext.line = callerInfo.line
                                        this.currentCallerContext.stack = stackFrames
                                    }
                                }
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

                        this.addCallerContextToEvent(callEvent)
                        this.onMembraneEvent?.(callEvent)

                        const resultEvent: any = {
                            event: 'call-result',
                            eventIndex: this.incrementEventIndex(),
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

                    this.addCallerContextToEvent(callEvent)
                    this.onMembraneEvent?.(callEvent)

                    const result = boundFunction(...args)

                    // Store in memoize cache if memoize is enabled
                    if (shouldMemoize) {
                        this.memoizeCache.set(cacheKey, result)
                        setupTtlExpiration()
                    }

                    const resultEvent: any = {
                        event: 'call-result',
                        eventIndex: this.incrementEventIndex(),
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

                // Call the getter function lazily when accessed with proper this context
                const result = getterFn.call(selfProxy)

                // Store in memoize cache if memoize is enabled
                if (shouldMemoize) {
                    this.memoizeCache.set(cacheKey, result)
                    setupTtlExpiration()
                }

                const event: any = {
                    event: 'get',
                    eventIndex: this.incrementEventIndex(),
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

    private addCallerContextToEvent(event: any): void {
        if (this.currentCallerContext) {
            event.caller = {
                capsuleSourceLineRef: this.currentCallerContext.capsuleSourceLineRef,
                spineContractCapsuleInstanceId: this.currentCallerContext.spineContractCapsuleInstanceId,
            }
            if (this.currentCallerContext.capsuleSourceNameRef) {
                event.caller.capsuleSourceNameRef = this.currentCallerContext.capsuleSourceNameRef
            }
            if (this.currentCallerContext.capsuleSourceNameRefHash) {
                event.caller.capsuleSourceNameRefHash = this.currentCallerContext.capsuleSourceNameRefHash
            }
            if (this.currentCallerContext.prop) {
                event.caller.prop = this.currentCallerContext.prop
            }
            if (this.currentCallerContext.filepath) {
                event.caller.filepath = this.currentCallerContext.filepath
            }
            if (this.currentCallerContext.line) {
                event.caller.line = this.currentCallerContext.line
            }
            if (this.currentCallerContext.stack) {
                event.caller.stack = this.currentCallerContext.stack
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
                onMembraneEvent,
                enableCallerStackInference,
                encapsulateOptions,
                getEventIndex: () => eventIndex,
                incrementEventIndex: () => eventIndex++,
                currentCallerContext,
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

