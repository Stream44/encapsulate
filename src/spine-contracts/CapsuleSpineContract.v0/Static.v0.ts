import { CapsulePropertyTypes, join } from "../../encapsulate"

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
    protected runtimeSpineContracts?: Record<string, any>
    protected capsuleInstance?: any
    public structInitFunctions: Array<() => any> = []
    public mappedCapsuleInstances: Array<any> = []

    constructor({ spineContractUri, capsule, self, ownSelf, encapsulatedApi, resolve, importCapsule, spineFilesystemRoot, freezeCapsule, instanceRegistry, extendedCapsuleInstance, runtimeSpineContracts, capsuleInstance }: { spineContractUri: string, capsule: any, self: any, ownSelf?: any, encapsulatedApi: Record<string, any>, resolve?: (uri: string, parentFilepath: string) => Promise<string>, importCapsule?: (filepath: string) => Promise<any>, spineFilesystemRoot?: string, freezeCapsule?: (capsule: any) => Promise<any>, instanceRegistry?: CapsuleInstanceRegistry, extendedCapsuleInstance?: any, runtimeSpineContracts?: Record<string, any>, capsuleInstance?: any }) {
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
    }

    async mapProperty({ overrides, options, property }: { overrides: any, options: any, property: any }) {
        if (property.definition.type === CapsulePropertyTypes.Mapping) {
            await this.mapMappingProperty({ overrides, options, property })
        } else if (
            property.definition.type === CapsulePropertyTypes.String ||
            property.definition.type === CapsulePropertyTypes.Literal ||
            property.definition.type === CapsulePropertyTypes.Constant
        ) {
            this.mapLiteralProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.Function) {
            this.mapFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.GetterFunction) {
            this.mapGetterFunctionProperty({ property })
        } else if (property.definition.type === CapsulePropertyTypes.StructInit) {
            this.mapStructInitProperty({ property })
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

            // Use encapsulateOptions.moduleFilepath (always available) instead of cst.source.moduleFilepath
            const moduleFilepath = this.capsule.encapsulateOptions?.moduleFilepath || this.capsule.cst?.source?.moduleFilepath
            if (!moduleFilepath) throw new Error(`'moduleFilepath' not available on capsule!`)

            const parentPath = join(this.spineFilesystemRoot, moduleFilepath)
            const filepath = await this.resolve(property.definition.value, parentPath)
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

    protected async extractConstants({ mappedCapsule }: { mappedCapsule: any }) {
        const constants: Record<string, any> = {}

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
                        type === CapsulePropertyTypes.Literal
                    ) {
                        constants[prop] = propValue
                    }
                }
            } else {
                // Regular property (backwards compatibility)
                const { type, value: propValue } = value as any

                if (typeof propValue === 'undefined') continue

                if (
                    type === CapsulePropertyTypes.String ||
                    type === CapsulePropertyTypes.Literal
                ) {
                    constants[key] = propValue
                }
            }
        }

        return constants
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

        // Check for existing instance in registry - reuse if available when no options
        // Pre-registration with null allows parent capsules to "claim" a slot before child capsules process
        const capsuleName = mappedCapsule.encapsulateOptions?.capsuleName

        if (capsuleName && this.instanceRegistry) {
            if (this.instanceRegistry.has(capsuleName)) {
                const existingEntry = this.instanceRegistry.get(capsuleName)

                // Only reuse if current mapping has no options
                if (!mappingOptions) {
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

        const apiTarget = this.getApiTarget({ property })
        const mappedInstance = await mappedCapsule.makeInstance({
            overrides: mappedOverrides,
            options: mappingOptions,
            runtimeSpineContracts: this.runtimeSpineContracts,
            rootCapsule: this.capsuleInstance?.rootCapsule
        })

        // Register the instance (replaces null pre-registration marker)
        // Always register to make instance available for child capsules with deferred proxies
        if (capsuleName && this.instanceRegistry) {
            this.instanceRegistry.set(capsuleName, mappedInstance)
        }

        apiTarget[property.name] = mappedInstance
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
        // to the property contract namespace for direct access
        if (property.definition.propertyContractDelegate) {
            // Create the property contract namespace if it doesn't exist
            if (!this.encapsulatedApi[property.definition.propertyContractDelegate]) {
                this.encapsulatedApi[property.definition.propertyContractDelegate] = {}
            }

            // Mount all properties from the mapped capsule's API to the property contract namespace
            const delegateTarget = this.encapsulatedApi[property.definition.propertyContractDelegate]
            for (const [key, value] of Object.entries(mappedInstance.api)) {
                delegateTarget[key] = value
            }
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

    protected createSelfProxy() {
        const extendedApi = this.extendedCapsuleInstance?.api
        const ownSelf = this.ownSelf
        return new Proxy(this.self, {
            get: (target: any, prop: string | symbol) => {
                if (typeof prop === 'symbol') return target[prop]

                // 'self' property returns ownSelf (only this capsule's own properties)
                if (prop === 'self' && ownSelf) {
                    return ownSelf
                }

                // First check if the property exists in target (this.self)
                if (prop in target) {
                    return target[prop]
                }

                // Fall back to encapsulatedApi
                if (prop in this.encapsulatedApi) {
                    return this.encapsulatedApi[prop]
                }

                // Fall back to extended capsule's API
                if (extendedApi && prop in extendedApi) {
                    return extendedApi[prop]
                }

                return undefined
            }
        })
    }

    protected mapFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const selfProxy = this.createSelfProxy()
        apiTarget[property.name] = property.definition.value.bind(selfProxy)
    }

    protected mapGetterFunctionProperty({ property }: { property: any }) {
        const apiTarget = this.getApiTarget({ property })
        const getterFn = property.definition.value
        const selfProxy = this.createSelfProxy()

        // Define a lazy getter that calls the function only when accessed with proper this context
        Object.defineProperty(apiTarget, property.name, {
            get: () => {
                return getterFn.call(selfProxy)
            },
            enumerable: true,
            configurable: true
        })

        // Also define the getter on ownSelf so this.self.propertyName works for getter functions
        // This ensures this.self accesses the getter, not a raw value
        if (this.ownSelf) {
            Object.defineProperty(this.ownSelf, property.name, {
                get: () => {
                    return getterFn.call(selfProxy)
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

    async freeze(options: any): Promise<any> {
        return this.freezeCapsule?.(options) || {}
    }

}




export function CapsuleSpineContract({ freezeCapsule, resolve, importCapsule, spineFilesystemRoot }: { freezeCapsule?: (capsule: any) => Promise<any>, resolve?: (uri: string, parentFilepath: string) => Promise<string>, importCapsule?: (filepath: string) => Promise<any>, spineFilesystemRoot?: string } = {}) {

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
                capsuleInstance
            })
        },
        hydrate: ({ capsuleSnapshot }: { capsuleSnapshot: any }): any => {

            return capsuleSnapshot
        }
    }
}

CapsuleSpineContract['#'] = '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'
