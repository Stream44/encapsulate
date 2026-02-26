
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"


it('Membrane construction & execution', async function () {

    const membraneEvents: any[] = []

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        },
        onMembraneEvent: (event: any) => membraneEvents.push(event)
    })

    // ##################################################
    // # Fixed Declared Structural Definitions
    // ##################################################

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                realm: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                group: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'Admin'
                },
                username: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        return `[${this.realm}] Hello (capsule1): ${this.username}`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `[${this.realm}] Hello (capsule1): ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `[${this.realm}] Hello (capsule1): ${this.username}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule1'
    })

    const capsule2 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                mappedCapsule: {
                    type: CapsulePropertyTypes.Mapping,
                    value: capsule1,
                    options: async ({ constants }: { constants: any }) => {
                        return {
                            '#': {
                                realm: `realm:${constants.group}`
                            }
                        }
                    }
                },
                username: {
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        const mappedCapsuleResponse = this.mappedCapsule.hello()

                        return `Hello (capsule2): ${this.username} [mappedCapsule.hello: ${mappedCapsuleResponse}]`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `Hello (capsule2): ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `Hello (capsule2): ${this.username}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule2',
        ambientReferences: {
            capsule1
        }
    })

    // ##################################################
    // # Runtime Context with Imperative Binding Code
    // ##################################################

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({
        options: {
            [capsule1.capsuleSourceLineRef]: {
                '#': {
                    realm: 'global'
                }
            },
        },
        overrides: {
            [capsule1.capsuleSourceLineRef]: {
                '#': {
                    username: 'World'
                }
            },
            [capsule2.capsuleSourceLineRef]: {
                '#': {
                    username: 'Sun'
                }
            }
        }
    }, async ({ apis }) => {

        return Promise.all([
            apis[capsule1.capsuleSourceLineRef].username,
            apis[capsule1.capsuleSourceLineRef].hello(),
            apis[capsule1.capsuleSourceLineRef].helloGetter1,
            apis[capsule1.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].username,
            apis[capsule2.capsuleSourceLineRef].hello(),
            apis[capsule2.capsuleSourceLineRef].helloGetter1,
            apis[capsule2.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.username,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.hello(),
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter1,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter2
        ])
    })

    expect(result as any).toEqual([
        'World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        'Sun',
        'Hello (capsule2): Sun [mappedCapsule.hello: [realm:Admin] Hello (capsule1): World]',
        'Hello (capsule2): Sun',
        'Hello (capsule2): Sun',
        'World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
    ])

    expect(membraneEvents.length).toBeGreaterThan(0)
    expect(membraneEvents[0].event).toBe('get')
    expect(membraneEvents[0].target.prop).toBe('username')
    expect(membraneEvents[0].target.capsuleSourceLineRef).toMatch(/main\.test\.ts:67$/)
    expect(membraneEvents[0].target.capsuleSourceNameRef).toMatch(/main\.test\.ts:capsule1$/)
    expect(membraneEvents[0].target.capsuleSourceNameRefHash).toBeTruthy()
    expect(membraneEvents[0].value).toBe('World')

    const callEvents = membraneEvents.filter((e: any) => e.event === 'call')
    expect(callEvents.length).toBeGreaterThan(0)
    expect(callEvents[0].target.prop).toBe('hello')

    const callResultEvents = membraneEvents.filter((e: any) => e.event === 'call-result')
    expect(callResultEvents.length).toBeGreaterThan(0)
    expect(callResultEvents[0].result).toBe('[global] Hello (capsule1): World')
})


describe('Membrane Features', () => {

    it('Memoize feature for GetterFunction and Function properties', async function () {

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    callCount: {
                        type: CapsulePropertyTypes.Literal,
                        value: 0
                    },
                    prefix: {
                        type: CapsulePropertyTypes.Literal,
                        value: 'Hello'
                    },
                    memoizedGetter: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            this.callCount++
                            return { computed: 'getter-result', callCount: this.callCount }
                        },
                        memoize: true
                    },
                    nonMemoizedGetter: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            this.callCount++
                            return { callCount: this.callCount }
                        }
                    },
                    asyncMemoizedGetter: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any) {
                            this.callCount++
                            return { computed: 'async-getter-result', callCount: this.callCount }
                        },
                        memoize: true
                    },
                    memoizedFunction: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            this.callCount++
                            return { computed: 'function-result', callCount: this.callCount }
                        },
                        memoize: true
                    },
                    asyncMemoizedFunction: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any) {
                            this.callCount++
                            return { computed: 'async-function-result', callCount: this.callCount }
                        },
                        memoize: true
                    },
                    memoizedGreeting: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            this.callCount++
                            return `${this.prefix}, World!`
                        },
                        memoize: true
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'memoizeTestCapsule'
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        await run({}, async ({ apis }) => {
            const api = apis[capsule.capsuleSourceLineRef]

            const firstGetter = api.memoizedGetter
            expect(firstGetter.computed).toBe('getter-result')
            expect(firstGetter.callCount).toBe(1)
            expect(api.callCount).toBe(1)

            const secondGetter = api.memoizedGetter
            expect(secondGetter.computed).toBe('getter-result')
            expect(secondGetter.callCount).toBe(1)
            expect(api.callCount).toBe(1)
            expect(secondGetter).toBe(firstGetter)

            const firstNonMemoized = api.nonMemoizedGetter
            expect(firstNonMemoized.callCount).toBe(2)
            expect(api.callCount).toBe(2)

            const secondNonMemoized = api.nonMemoizedGetter
            expect(secondNonMemoized.callCount).toBe(3)
            expect(api.callCount).toBe(3)

            const firstAsyncGetter = await api.asyncMemoizedGetter
            expect(firstAsyncGetter.computed).toBe('async-getter-result')
            expect(firstAsyncGetter.callCount).toBe(4)
            expect(api.callCount).toBe(4)

            const secondAsyncGetter = await api.asyncMemoizedGetter
            expect(secondAsyncGetter.computed).toBe('async-getter-result')
            expect(secondAsyncGetter.callCount).toBe(4)
            expect(api.callCount).toBe(4)

            const firstFunction = api.memoizedFunction()
            expect(firstFunction.computed).toBe('function-result')
            expect(firstFunction.callCount).toBe(5)
            expect(api.callCount).toBe(5)

            const secondFunction = api.memoizedFunction()
            expect(secondFunction.computed).toBe('function-result')
            expect(secondFunction.callCount).toBe(5)
            expect(api.callCount).toBe(5)
            expect(secondFunction).toBe(firstFunction)

            const firstAsyncFunction = await api.asyncMemoizedFunction()
            expect(firstAsyncFunction.computed).toBe('async-function-result')
            expect(firstAsyncFunction.callCount).toBe(6)
            expect(api.callCount).toBe(6)

            const secondAsyncFunction = await api.asyncMemoizedFunction()
            expect(secondAsyncFunction.computed).toBe('async-function-result')
            expect(secondAsyncFunction.callCount).toBe(6)
            expect(api.callCount).toBe(6)

            const firstGreeting = api.memoizedGreeting
            expect(firstGreeting).toBe('Hello, World!')
            expect(api.callCount).toBe(7)

            const secondGreeting = api.memoizedGreeting
            expect(secondGreeting).toBe('Hello, World!')
            expect(api.callCount).toBe(7)
        })
    })


    it('Memoize TTL expires cache after specified milliseconds', async function () {

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    getterCallCount: {
                        type: CapsulePropertyTypes.Literal,
                        value: 0
                    },
                    functionCallCount: {
                        type: CapsulePropertyTypes.Literal,
                        value: 0
                    },
                    ttlMemoizedGetter: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            this.getterCallCount++
                            return { result: 'getter-value', callCount: this.getterCallCount }
                        },
                        memoize: 50
                    },
                    ttlMemoizedFunction: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            this.functionCallCount++
                            return { result: 'function-value', callCount: this.functionCallCount }
                        },
                        memoize: 50
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'memoizeTtlCapsule'
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        await run({}, async ({ apis }) => {
            const api = apis[capsule.capsuleSourceLineRef]

            const firstGetter = api.ttlMemoizedGetter
            expect(firstGetter.result).toBe('getter-value')
            expect(firstGetter.callCount).toBe(1)
            expect(api.getterCallCount).toBe(1)

            const secondGetter = api.ttlMemoizedGetter
            expect(secondGetter.callCount).toBe(1)
            expect(api.getterCallCount).toBe(1)
            expect(secondGetter).toBe(firstGetter)

            const firstFunction = api.ttlMemoizedFunction()
            expect(firstFunction.result).toBe('function-value')
            expect(firstFunction.callCount).toBe(1)
            expect(api.functionCallCount).toBe(1)

            const secondFunction = api.ttlMemoizedFunction()
            expect(secondFunction.callCount).toBe(1)
            expect(api.functionCallCount).toBe(1)

            await new Promise(resolve => setTimeout(resolve, 60))

            const thirdGetter = api.ttlMemoizedGetter
            expect(thirdGetter.callCount).toBe(2)
            expect(api.getterCallCount).toBe(2)

            const thirdFunction = api.ttlMemoizedFunction()
            expect(thirdFunction.callCount).toBe(2)
            expect(api.functionCallCount).toBe(2)
        })
    })


    it('Memoize timeouts are cleared on script exit', async function () {

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    callCount: {
                        type: CapsulePropertyTypes.Literal,
                        value: 0
                    },
                    longTtlGetter: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            this.callCount++
                            return this.callCount
                        },
                        memoize: 10000
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'memoizeTimeoutCleanupCapsule'
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        await run({}, async ({ apis }) => {
            const api = apis[capsule.capsuleSourceLineRef]

            const result = api.longTtlGetter
            expect(result).toBe(1)
        })
    })


    it('Constant property throws on set (Membrane only)', async function () {

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
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
            capsuleName: 'constantThrowsCapsule'
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        await run({}, async ({ apis }) => {
            const api = apis[capsule.capsuleSourceLineRef]
            expect(api.readOnlyValue).toBe('immutable')

            expect(() => {
                api.readOnlyValue = 'new-value'
            }).toThrow("Cannot set constant property 'readOnlyValue'")
        })
    })

})
