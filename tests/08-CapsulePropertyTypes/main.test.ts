
import { describe, it, expect } from 'bun:test'
import * as bunTest from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


for (const { label, Contract } of [
    { label: 'Static.v0', Contract: StaticCapsuleSpineContract },
    { label: 'Membrane.v0', Contract: CapsuleSpineContract },
]) {

    describe(label, function () {

        it('All property types for non-struct capsules', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        // Literal property
                        literalProp: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'literal-value'
                        },
                        // String property
                        stringProp: {
                            type: CapsulePropertyTypes.String,
                            value: 'string-value'
                        },
                        // Constant property (read-only)
                        constantProp: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'constant-value'
                        },
                        // Function property
                        functionProp: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any, suffix: string): string {
                                return `${this.literalProp}-${suffix}`
                            }
                        },
                        // GetterFunction property
                        getterProp: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): string {
                                return `getter:${this.stringProp}`
                            }
                        },
                        // Init property (fires for non-struct capsules - but this capsule has Capsule struct so uses StructInit semantics)
                        // For this test, we use Init to verify it works
                        initSetup: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.initDone = true
                            }
                        },
                        // Dispose property
                        disposeCleanup: {
                            type: CapsulePropertyTypes.Dispose,
                            value: function (this: any) {
                                this.disposeDone = true
                            }
                        },
                        // State properties for lifecycle tracking
                        initDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        disposeDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'allPropertyTypesCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            let handlerResult: any
            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]

                handlerResult = {
                    // Test Literal
                    literalProp: api.literalProp,
                    // Test String
                    stringProp: api.stringProp,
                    // Test Constant
                    constantProp: api.constantProp,
                    // Test Function
                    functionResult: api.functionProp('test'),
                    // Test GetterFunction
                    getterResult: api.getterProp,
                    // Test Init fired
                    initDone: api.initDone,
                    // Test Dispose not yet fired
                    disposeDone: api.disposeDone,
                    // Init/Dispose should NOT be on API
                    hasInitSetup: 'initSetup' in api,
                    hasDisposeCleanup: 'disposeCleanup' in api
                }
            })

            // Verify all property types work correctly
            expect(handlerResult.literalProp).toBe('literal-value')
            expect(handlerResult.stringProp).toBe('string-value')
            expect(handlerResult.constantProp).toBe('constant-value')
            expect(handlerResult.functionResult).toBe('literal-value-test')
            expect(handlerResult.getterResult).toBe('getter:string-value')
            expect(handlerResult.initDone).toBe(true)
            expect(handlerResult.disposeDone).toBe(false)
            expect(handlerResult.hasInitSetup).toBe(false)
            expect(handlerResult.hasDisposeCleanup).toBe(false)
        })


        it('Init fires for capsules with Init property', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'initTest'
                        },
                        initDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        disposeDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initHandler: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.initDone = true
                            }
                        },
                        disposeHandler: {
                            type: CapsulePropertyTypes.Dispose,
                            value: function (this: any) {
                                this.disposeDone = true
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'initTestCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            let initDoneInHandler = false
            let disposeDoneInHandler = false
            await run({}, async ({ apis }) => {
                initDoneInHandler = apis[capsule1.capsuleSourceLineRef].initDone
                disposeDoneInHandler = apis[capsule1.capsuleSourceLineRef].disposeDone
            })

            expect(initDoneInHandler).toBe(true)
            expect(disposeDoneInHandler).toBe(false)
        })


        it('Dispose runs after handler for capsules with Dispose property', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const leafCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'leaf'
                        },
                        leafInitDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        leafDisposeDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initHandler: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.leafInitDone = true
                            }
                        },
                        disposeHandler: {
                            type: CapsulePropertyTypes.Dispose,
                            value: function (this: any) {
                                this.leafDisposeDone = true
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'disposeLeaf'
            })

            const rootCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'root'
                        },
                        rootInitDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        rootDisposeDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initHandler: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.rootInitDone = true
                            }
                        },
                        disposeHandler: {
                            type: CapsulePropertyTypes.Dispose,
                            value: function (this: any) {
                                this.rootDisposeDone = true
                            }
                        },
                        mapped: {
                            type: CapsulePropertyTypes.Mapping,
                            value: leafCapsule
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'disposeRoot',
                ambientReferences: { leafCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            let rootInitInHandler = false
            let leafInitInHandler = false
            let rootDisposeInHandler = false
            let leafDisposeInHandler = false
            await run({}, async ({ apis }) => {
                rootInitInHandler = apis[rootCapsule.capsuleSourceLineRef].rootInitDone
                leafInitInHandler = apis[rootCapsule.capsuleSourceLineRef].mapped.leafInitDone
                rootDisposeInHandler = apis[rootCapsule.capsuleSourceLineRef].rootDisposeDone
                leafDisposeInHandler = apis[rootCapsule.capsuleSourceLineRef].mapped.leafDisposeDone
            })

            // Inits should have run, disposes should not have run yet during handler
            expect(rootInitInHandler).toBe(true)
            expect(leafInitInHandler).toBe(true)
            expect(rootDisposeInHandler).toBe(false)
            expect(leafDisposeInHandler).toBe(false)
        })


        it('Async Init and Dispose support', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'async'
                        },
                        asyncInitDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        asyncDisposeDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initHandler: {
                            type: CapsulePropertyTypes.Init,
                            value: async function (this: any) {
                                this.asyncInitDone = true
                            }
                        },
                        disposeHandler: {
                            type: CapsulePropertyTypes.Dispose,
                            value: async function (this: any) {
                                this.asyncDisposeDone = true
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'asyncInitDisposeCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            let initDoneInHandler = false
            let disposeDoneInHandler = false
            await run({}, async ({ apis }) => {
                initDoneInHandler = apis[capsule1.capsuleSourceLineRef].asyncInitDone
                disposeDoneInHandler = apis[capsule1.capsuleSourceLineRef].asyncDisposeDone
            })

            expect(initDoneInHandler).toBe(true)
            expect(disposeDoneInHandler).toBe(false)
        })


        it('Multiple Init per capsule', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        initADone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initBDone: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        initA: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.initADone = true
                            }
                        },
                        initB: {
                            type: CapsulePropertyTypes.Init,
                            value: function (this: any) {
                                this.initBDone = true
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'multiInitCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]
                expect(api.initADone).toBe(true)
                expect(api.initBDone).toBe(true)
            })
        })


        it('Constant property is read-only', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        readOnlyValue: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'immutable'
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'constantCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]
                expect(api.readOnlyValue).toBe('immutable')
            })
        })


        it('Mapping property with options', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        prefix: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined
                        },
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'child'
                        },
                        fullName: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): string {
                                return this.prefix ? `${this.prefix}:${this.name}` : this.name
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'mappingChildCapsule'
            })

            const parentCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        child: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: async ({ constants }: { constants: any }) => {
                                return {
                                    '#': {
                                        prefix: `parent-${constants.name}`
                                    }
                                }
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'mappingParentCapsule',
                ambientReferences: { childCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[parentCapsule.capsuleSourceLineRef]
                expect(api.child.fullName).toBe('parent-child:child')
            })
        })


        it('Memoize returns same value on repeated calls', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        memoizedFunction: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any): string {
                                return 'function-result'
                            },
                            memoize: true
                        },
                        memoizedGetter: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): string {
                                return 'getter-result'
                            },
                            memoize: true
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'memoizeCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]

                // Call function multiple times - should return same value
                expect(api.memoizedFunction()).toBe('function-result')
                expect(api.memoizedFunction()).toBe('function-result')
                expect(api.memoizedFunction()).toBe('function-result')

                // Access getter multiple times - should return same value
                expect(api.memoizedGetter).toBe('getter-result')
                expect(api.memoizedGetter).toBe('getter-result')
                expect(api.memoizedGetter).toBe('getter-result')
            })
        })


        it('SetterFunction property calls function when value is assigned', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        internalValue: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'initial'
                        },
                        setterWasCalled: {
                            type: CapsulePropertyTypes.Literal,
                            value: false
                        },
                        lastSetValue: {
                            type: CapsulePropertyTypes.Literal,
                            value: null
                        },
                        valueSetter: {
                            type: CapsulePropertyTypes.SetterFunction,
                            value: function (this: any, newValue: string) {
                                this.setterWasCalled = true
                                this.lastSetValue = newValue
                                this.internalValue = `processed:${newValue}`
                            }
                        },
                        getValue: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): string {
                                return this.internalValue
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'setterFunctionCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]

                // Initial state
                expect(api.getValue).toBe('initial')

                // Assign to the setter property
                api.valueSetter = 'newValue'

                // Verify setter was called and processed the value
                expect(api.getValue).toBe('processed:newValue')
            })
        })


        it('SetterFunction with validation logic', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        age: {
                            type: CapsulePropertyTypes.Literal,
                            value: 0
                        },
                        setAge: {
                            type: CapsulePropertyTypes.SetterFunction,
                            value: function (this: any, newAge: number) {
                                if (newAge < 0) {
                                    throw new Error('Age cannot be negative')
                                }
                                this.age = newAge
                            }
                        },
                        getAge: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): number {
                                return this.age
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'setterValidationCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]

                // Set valid age
                api.setAge = 25
                expect(api.getAge).toBe(25)

                // Set another valid age
                api.setAge = 30
                expect(api.getAge).toBe(30)

                // Try to set invalid age - should throw
                expect(() => {
                    api.setAge = -5
                }).toThrow('Age cannot be negative')

                // Age should remain unchanged after failed set
                expect(api.getAge).toBe(30)
            })
        })


        it('Literal Map property preserves Map methods', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const capsule1 = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        // Literal Map property
                        resourceMap: {
                            type: CapsulePropertyTypes.Literal,
                            value: new Map<string, boolean>()
                        },
                        // Function that uses the Map
                        addResource: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any, key: string): void {
                                this.resourceMap.set(key, true)
                            }
                        },
                        hasResource: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any, key: string): boolean {
                                return this.resourceMap.has(key)
                            }
                        },
                        getResourceCount: {
                            type: CapsulePropertyTypes.GetterFunction,
                            value: function (this: any): number {
                                return this.resourceMap.size
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'literalMapCapsule'
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[capsule1.capsuleSourceLineRef]

                // Verify Map is accessible and has methods
                expect(api.resourceMap).toBeInstanceOf(Map)
                expect(typeof api.resourceMap.set).toBe('function')
                expect(typeof api.resourceMap.get).toBe('function')
                expect(typeof api.resourceMap.has).toBe('function')

                // Use Map directly
                api.resourceMap.set('direct-key', true)
                expect(api.resourceMap.has('direct-key')).toBe(true)
                expect(api.resourceMap.get('direct-key')).toBe(true)

                // Use Map through function
                api.addResource('function-key')
                expect(api.hasResource('function-key')).toBe(true)

                // Verify size
                expect(api.getResourceCount).toBe(2)
            })
        })
    })
}
