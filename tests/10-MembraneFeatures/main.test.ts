
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"


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

        // Test memoized getter
        const firstGetter = api.memoizedGetter
        expect(firstGetter.computed).toBe('getter-result')
        expect(firstGetter.callCount).toBe(1)
        expect(api.callCount).toBe(1)

        const secondGetter = api.memoizedGetter
        expect(secondGetter.computed).toBe('getter-result')
        expect(secondGetter.callCount).toBe(1)
        expect(api.callCount).toBe(1)
        expect(secondGetter).toBe(firstGetter)

        // Test non-memoized getter
        const firstNonMemoized = api.nonMemoizedGetter
        expect(firstNonMemoized.callCount).toBe(2)
        expect(api.callCount).toBe(2)

        const secondNonMemoized = api.nonMemoizedGetter
        expect(secondNonMemoized.callCount).toBe(3)
        expect(api.callCount).toBe(3)

        // Test async memoized getter
        const firstAsyncGetter = await api.asyncMemoizedGetter
        expect(firstAsyncGetter.computed).toBe('async-getter-result')
        expect(firstAsyncGetter.callCount).toBe(4)
        expect(api.callCount).toBe(4)

        const secondAsyncGetter = await api.asyncMemoizedGetter
        expect(secondAsyncGetter.computed).toBe('async-getter-result')
        expect(secondAsyncGetter.callCount).toBe(4)
        expect(api.callCount).toBe(4)

        // Test memoized function
        const firstFunction = api.memoizedFunction()
        expect(firstFunction.computed).toBe('function-result')
        expect(firstFunction.callCount).toBe(5)
        expect(api.callCount).toBe(5)

        const secondFunction = api.memoizedFunction()
        expect(secondFunction.computed).toBe('function-result')
        expect(secondFunction.callCount).toBe(5)
        expect(api.callCount).toBe(5)
        expect(secondFunction).toBe(firstFunction)

        // Test async memoized function
        const firstAsyncFunction = await api.asyncMemoizedFunction()
        expect(firstAsyncFunction.computed).toBe('async-function-result')
        expect(firstAsyncFunction.callCount).toBe(6)
        expect(api.callCount).toBe(6)

        const secondAsyncFunction = await api.asyncMemoizedFunction()
        expect(secondAsyncFunction.computed).toBe('async-function-result')
        expect(secondAsyncFunction.callCount).toBe(6)
        expect(api.callCount).toBe(6)

        // Test memoized getter with this context
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
                    memoize: 50  // 50ms TTL
                },
                ttlMemoizedFunction: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any) {
                        this.functionCallCount++
                        return { result: 'function-value', callCount: this.functionCallCount }
                    },
                    memoize: 50  // 50ms TTL
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

        // First call - should execute and cache
        const firstGetter = api.ttlMemoizedGetter
        expect(firstGetter.result).toBe('getter-value')
        expect(firstGetter.callCount).toBe(1)
        expect(api.getterCallCount).toBe(1)

        // Second call immediately - should return cached value
        const secondGetter = api.ttlMemoizedGetter
        expect(secondGetter.callCount).toBe(1)
        expect(api.getterCallCount).toBe(1)
        expect(secondGetter).toBe(firstGetter)

        // Test function memoization
        const firstFunction = api.ttlMemoizedFunction()
        expect(firstFunction.result).toBe('function-value')
        expect(firstFunction.callCount).toBe(1)
        expect(api.functionCallCount).toBe(1)

        const secondFunction = api.ttlMemoizedFunction()
        expect(secondFunction.callCount).toBe(1)
        expect(api.functionCallCount).toBe(1)

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 60))

        // After TTL expires, should re-execute
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
                    memoize: 10000  // 10 second TTL - longer than test
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

    // Run completes and should clear timeouts without waiting for TTL
    await run({}, async ({ apis }) => {
        const api = apis[capsule.capsuleSourceLineRef]

        // Trigger memoization which sets up a 10 second timeout
        const result = api.longTtlGetter
        expect(result).toBe(1)
    })

    // If timeouts weren't cleared, this test would hang or leak
    // The fact that it completes quickly proves timeouts are cleared
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

        // Attempting to set should throw (Membrane contract enforces this)
        expect(() => {
            api.readOnlyValue = 'new-value'
        }).toThrow("Cannot set constant property 'readOnlyValue'")
    })
})
