
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"


describe('Membrane: Inline capsule extends + mappings', () => {

    it('extends an inline capsule (no file-based references)', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const baseCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    serviceName: {
                        type: CapsulePropertyTypes.String,
                        value: 'base-service'
                    },
                    healthCheck: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.serviceName}: healthy`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'baseCapsule',
        })

        const extendedCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    endpoint: {
                        type: CapsulePropertyTypes.Literal,
                        value: '/api/v1'
                    },
                    getEndpointInfo: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return `${this.serviceName}:${this.endpoint}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: baseCapsule,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'extendedCapsule',
            ambientReferences: { baseCapsule }
        })

        const result = await run({
            overrides: {
                ['extendedCapsule']: {
                    '#': {
                        serviceName: 'my-service'
                    }
                }
            }
        }, async ({ apis }: any) => {
            const api = apis[extendedCapsule.capsuleSourceLineRef]
            return {
                healthCheck: api.healthCheck(),
                endpointInfo: api.getEndpointInfo,
            }
        })

        expect(result.healthCheck).toBe('my-service: healthy')
        expect(result.endpointInfo).toBe('my-service:/api/v1')
    })

    it('maps an inline capsule (no file-based references)', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const innerCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    value: {
                        type: CapsulePropertyTypes.Literal,
                        value: 42
                    },
                    getValue: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) { return this.value }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'innerCapsule',
        })

        const outerCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    inner: {
                        type: CapsulePropertyTypes.Mapping,
                        value: innerCapsule,
                    },
                    getInnerValue: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) { return this.inner.getValue }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'outerCapsule',
            ambientReferences: { innerCapsule }
        })

        const result = await run({}, async ({ apis }: any) => {
            const api = apis[outerCapsule.capsuleSourceLineRef]
            return api.getInnerValue()
        })

        expect(result).toBe(42)
    })

    it('extends + maps inline capsules combined', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const baseCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    serviceName: {
                        type: CapsulePropertyTypes.String,
                        value: 'base'
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'baseCapsule',
        })

        const helperCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    helperName: {
                        type: CapsulePropertyTypes.Constant,
                        value: 'helper-1'
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'helperCapsule',
        })

        const compositeCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    helper: {
                        type: CapsulePropertyTypes.Mapping,
                        value: helperCapsule,
                    },
                    describe: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.serviceName} + ${this.helper.helperName}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: baseCapsule,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'compositeCapsule',
            ambientReferences: { baseCapsule, helperCapsule }
        })

        const result = await run({
            overrides: {
                ['compositeCapsule']: {
                    '#': {
                        serviceName: 'composite'
                    }
                }
            }
        }, async ({ apis }: any) => {
            const api = apis[compositeCapsule.capsuleSourceLineRef]
            return api.describe()
        })

        expect(result).toBe('composite + helper-1')
    })

    it('extends an inline capsule with static analysis enabled', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const baseCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    serviceName: {
                        type: CapsulePropertyTypes.String,
                        value: 'base-service'
                    },
                    healthCheck: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.serviceName}: healthy`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'baseCapsule',
        })

        const extendedCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    endpoint: {
                        type: CapsulePropertyTypes.Literal,
                        value: '/api/v1'
                    },
                    getEndpointInfo: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return `${this.serviceName}:${this.endpoint}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: baseCapsule,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'extendedCapsule',
            ambientReferences: { baseCapsule }
        })

        const result = await run({
            overrides: {
                ['extendedCapsule']: {
                    '#': {
                        serviceName: 'my-service'
                    }
                }
            }
        }, async ({ apis }: any) => {
            const api = apis[extendedCapsule.capsuleSourceLineRef]
            return {
                healthCheck: api.healthCheck(),
                endpointInfo: api.getEndpointInfo,
            }
        })

        expect(result.healthCheck).toBe('my-service: healthy')
        expect(result.endpointInfo).toBe('my-service:/api/v1')
    })

    it('maps an inline capsule with static analysis enabled', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const innerCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    value: {
                        type: CapsulePropertyTypes.Literal,
                        value: 42
                    },
                    getValue: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) { return this.value }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'innerCapsule',
        })

        const outerCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    inner: {
                        type: CapsulePropertyTypes.Mapping,
                        value: innerCapsule,
                    },
                    getInnerValue: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) { return this.inner.getValue }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'outerCapsule',
            ambientReferences: { innerCapsule }
        })

        const result = await run({}, async ({ apis }: any) => {
            const api = apis[outerCapsule.capsuleSourceLineRef]
            return api.getInnerValue()
        })

        expect(result).toBe(42)
    })

    it('struct delegate with inline capsule and static analysis enabled', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const schemaStruct = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    schemaValue: {
                        type: CapsulePropertyTypes.Literal,
                        value: undefined
                    },
                    getSchema: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) { return this.schemaValue }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'schemaStruct',
        })

        const consumer = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                ['#' + schemaStruct.capsuleSourceLineRef]: {
                    as: '$schema',
                    options: { '#': { schemaValue: { type: 'user', version: 2 } } }
                },
                '#': {
                    useSchema: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) { return this.$schema.getSchema }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'consumer',
            ambientReferences: { schemaStruct }
        })

        const result = await run({}, async ({ apis }: any) => {
            const api = apis[consumer.capsuleSourceLineRef]
            return api.useSchema()
        })

        expect(result).toEqual({ type: 'user', version: 2 })
    })

    it('extends + maps with enableCallerStackInference and capsuleModuleProjectionRoot (standalone-rt setup)', async function () {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const baseCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    serviceName: {
                        type: CapsulePropertyTypes.String,
                        value: 'base-service'
                    },
                    healthCheck: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.serviceName}: healthy`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'baseCapsule',
        })

        const innerCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    value: {
                        type: CapsulePropertyTypes.Constant,
                        value: 99
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'innerCapsule',
        })

        const compositeCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    inner: {
                        type: CapsulePropertyTypes.Mapping,
                        value: innerCapsule,
                    },
                    describe: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.serviceName}: inner=${this.inner.value}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: baseCapsule,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'compositeCapsule',
            ambientReferences: { baseCapsule, innerCapsule }
        })

        const result = await run({
            overrides: {
                ['compositeCapsule']: {
                    '#': {
                        serviceName: 'test-svc'
                    }
                }
            }
        }, async ({ apis }: any) => {
            const api = apis[compositeCapsule.capsuleSourceLineRef]
            return api.describe()
        })

        expect(result).toBe('test-svc: inner=99')
    })
})
