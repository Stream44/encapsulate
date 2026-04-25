
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"


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
    expect(membraneEvents[0].target.capsuleSourceLineRef).toMatch(/main\.test:67$/)
    expect(membraneEvents[0].target.capsuleSourceNameRef).toMatch(/main\.test:capsule1$/)
    expect(membraneEvents[0].target.capsuleSourceNameRefHash).toBeTruthy()
    expect(membraneEvents[0].value).toBe('World')

    const callEvents = membraneEvents.filter((e: any) => e.event === 'call')
    expect(callEvents.length).toBeGreaterThan(0)
    expect(callEvents[0].target.prop).toBe('hello')

    const callResultEvents = membraneEvents.filter((e: any) => e.event === 'call-result')
    expect(callResultEvents.length).toBeGreaterThan(0)
    expect(callResultEvents[0].result).toBe('[global] Hello (capsule1): World')

    // Verify membrane property exists on all events
    for (const event of membraneEvents) {
        expect(event.membrane).toBeDefined()
        expect(['external', 'internal']).toContain(event.membrane)
    }

    // Verify external events (direct API access)
    const externalEvents = membraneEvents.filter((e: any) => e.membrane === 'external')
    expect(externalEvents.length).toBeGreaterThan(0)

    // Verify internal events (property access from within function bodies)
    const internalEvents = membraneEvents.filter((e: any) => e.membrane === 'internal')
    expect(internalEvents.length).toBeGreaterThan(0)

    // The hello() function accesses this.realm and this.username internally
    // These should be internal get events
    const internalGetEvents = internalEvents.filter((e: any) => e.event === 'get')
    expect(internalGetEvents.length).toBeGreaterThan(0)

    // Verify internal get events have the expected properties
    const realmInternalGet = internalGetEvents.find((e: any) => e.target.prop === 'realm')
    expect(realmInternalGet).toBeDefined()
    expect(realmInternalGet.membrane).toBe('internal')

    const usernameInternalGet = internalGetEvents.find((e: any) => e.target.prop === 'username')
    expect(usernameInternalGet).toBeDefined()
    expect(usernameInternalGet.membrane).toBe('internal')

    // ── Verify caller context is present on ALL non-result events ──────
    // Every membrane event (except call-result) should have a caller object
    // call-result events are emitted after function return and reference callEventIndex instead
    const nonResultEvents = membraneEvents.filter((e: any) => e.event !== 'call-result')
    for (const event of nonResultEvents) {
        expect(event.caller).toBeDefined()
        // caller must have either capsuleSourceLineRef (from capsule context) or fileUri (from stack inference)
        const hasCapsuleRef = event.caller.capsuleSourceLineRef !== undefined
        const hasFileUri = event.caller.fileUri !== undefined
        expect(hasCapsuleRef || hasFileUri).toBe(true)
    }

    // Internal events should have capsule-level caller context (from the function that accessed the property)
    for (const event of internalEvents) {
        expect(event.caller).toBeDefined()
        expect(event.caller.capsuleSourceLineRef).toBeDefined()
        expect(event.caller.spineContractCapsuleInstanceId).toBeDefined()
        expect(event.caller.prop).toBeDefined()
    }

    // Cross-capsule calls: when capsule2.hello() calls this.mappedCapsule.hello(),
    // the external call on capsule1 should have capsule2 as the caller
    const capsule1ExternalCalls = membraneEvents.filter((e: any) =>
        e.event === 'call' && e.membrane === 'external' &&
        e.target.capsuleSourceNameRef?.includes('capsule1') &&
        e.caller?.capsuleSourceNameRef?.includes('capsule2')
    )
    expect(capsule1ExternalCalls.length).toBeGreaterThan(0)

})


it('Internal set events are emitted when functions modify properties', async function () {

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

    const capsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                counter: {
                    type: CapsulePropertyTypes.Literal,
                    value: 0
                },
                increment: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): number {
                        this.counter++
                        return this.counter
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'internalSetCapsule'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const api = apis[capsule.capsuleSourceLineRef]

        // Call increment which internally sets this.counter
        const result1 = api.increment()
        expect(result1).toBe(1)

        const result2 = api.increment()
        expect(result2).toBe(2)
    })

    // Verify internal set events were emitted
    const internalSetEvents = membraneEvents.filter((e: any) => e.event === 'set' && e.membrane === 'internal')
    expect(internalSetEvents.length).toBe(2) // Two increment() calls

    // Verify internal set events have correct properties
    for (const event of internalSetEvents) {
        expect(event.target.prop).toBe('counter')
        expect(event.membrane).toBe('internal')
    }

    // Verify internal get events were also emitted (reading counter before incrementing)
    // Note: this.counter++ does a read then write, so we get at least 2 internal get events
    const internalGetEvents = membraneEvents.filter((e: any) => e.event === 'get' && e.membrane === 'internal' && e.target.prop === 'counter')
    expect(internalGetEvents.length).toBeGreaterThanOrEqual(2)
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


describe('Cross-capsule caller tracking and event sequencing', () => {

    it('caller is the last function that triggered the access, not the original external caller', async () => {
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

        // 3-level hierarchy: Root → User → LoginForm (mirrors the real Codepath model)
        const { capsule: rootCapsuleFn } = await import('./caps/Root')
        const root = await rootCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }) => {
            apis[root.capsuleSourceLineRef].runModel()
        })

        // ── Event sequencing: events must be in eventIndex order ──────────
        for (let i = 1; i < membraneEvents.length; i++) {
            expect(membraneEvents[i].eventIndex).toBeGreaterThan(membraneEvents[i - 1].eventIndex)
        }

        // ── Caller tracking: internal set on loginForm._email should have loginForm.setEmail as caller ──
        const internalSetEmail = membraneEvents.find((e: any) =>
            e.event === 'set' && e.membrane === 'internal' && e.target.prop === '_email'
        )
        expect(internalSetEmail).toBeDefined()
        expect(internalSetEmail.caller).toBeDefined()
        expect(internalSetEmail.caller.capsuleSourceNameRef).toMatch(/LoginForm$/)
        expect(internalSetEmail.caller.prop).toBe('setEmail')

        // ── Caller tracking: the external call to loginForm.setEmail should have user.login as caller ──
        const externalCallSetEmail = membraneEvents.find((e: any) =>
            e.event === 'call' && e.membrane === 'external' && e.target.prop === 'setEmail'
        )
        expect(externalCallSetEmail).toBeDefined()
        expect(externalCallSetEmail.caller).toBeDefined()
        expect(externalCallSetEmail.caller.capsuleSourceNameRef).toMatch(/User$/)
        expect(externalCallSetEmail.caller.prop).toBe('login')

        // ── NO spurious external get events for _email/_password during function calls ──
        // When setEmail runs this._email = value, only internal set should fire, not external get
        const externalGetsOnEmailDuringSetEmail = membraneEvents.filter((e: any) =>
            e.event === 'get' && e.membrane === 'external' && e.target.prop === '_email' &&
            e.caller?.prop === 'login'
        )
        // External gets on _email with User.login as caller are spurious — they should not exist
        // (if they do exist, the caller should be the actual function accessing the property, not user.login)
        expect(externalGetsOnEmailDuringSetEmail.length).toBe(0)

    })

    it('re-entrancy guard prevents spurious events when onMembraneEvent touches event.value proxies', async () => {
        const membraneEvents: any[] = []

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            },
            // Simulate standalone-rt: JSON.stringify event.value inside onMembraneEvent
            // Without the re-entrancy guard, this would trigger proxy getters on capsule APIs
            // and emit spurious recursive membrane events with wrong caller and ordering
            onMembraneEvent: (event: any) => {
                let safeValue: any = undefined
                try {
                    if (event.value !== undefined) {
                        JSON.stringify(event.value)
                        safeValue = event.value
                    }
                } catch {
                    safeValue = typeof event.value === 'object' ? `[${typeof event.value}]` : String(event.value)
                }
                membraneEvents.push({
                    ...event,
                    value: safeValue
                })
            }
        })

        // 3-level hierarchy: Root → User → LoginForm
        const { capsule: rootCapsuleFn } = await import('./caps/Root')
        const root = await rootCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }) => {
            apis[root.capsuleSourceLineRef].runModel()
        })

        // ── Event sequencing: events must be in eventIndex order ──────────
        for (let i = 1; i < membraneEvents.length; i++) {
            expect(membraneEvents[i].eventIndex).toBeGreaterThan(membraneEvents[i - 1].eventIndex)
        }

        // ── NO spurious external get events with wrong caller ──────────
        const spuriousExternalGets = membraneEvents.filter((e: any) =>
            e.event === 'get' && e.membrane === 'external' &&
            (e.target.prop === '_email' || e.target.prop === '_password' || e.target.prop === '_error') &&
            e.caller?.prop === 'login'
        )
        expect(spuriousExternalGets.length).toBe(0)

        // ── Caller tracking still correct ──────────
        const internalSetEmail = membraneEvents.find((e: any) =>
            e.event === 'set' && e.membrane === 'internal' && e.target.prop === '_email'
        )
        expect(internalSetEmail).toBeDefined()
        expect(internalSetEmail.caller).toBeDefined()
        expect(internalSetEmail.caller.prop).toBe('setEmail')
    })
})


describe('Caller info', () => {

    it('caller info is present on all non-result membrane events (in-memory)', async () => {
        // This tests the CapsuleSpineFactory membrane event emission directly
        // to verify every event type has caller info
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

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    counter: {
                        type: CapsulePropertyTypes.Literal,
                        value: 0
                    },
                    increment: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            this.counter++
                            return this.counter
                        }
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'caller-verify-capsule'
        })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }) => {
            const api = apis[capsule.capsuleSourceLineRef]
            api.increment()
        })

        // Verify all non-result events have caller
        const nonResultEvents = membraneEvents.filter((e: any) => e.event !== 'call-result')
        expect(nonResultEvents.length).toBeGreaterThan(0)
        for (const event of nonResultEvents) {
            expect(event.caller).toBeDefined()
            const hasCapsuleRef = event.caller.capsuleSourceLineRef !== undefined
            const hasFileUri = event.caller.fileUri !== undefined
            expect(hasCapsuleRef || hasFileUri).toBe(true)
        }

        // Specifically: internal events have capsule-level caller with prop
        const internalEvents = membraneEvents.filter((e: any) => e.membrane === 'internal')
        for (const event of internalEvents) {
            expect(event.caller.capsuleSourceLineRef).toBeDefined()
            expect(event.caller.spineContractCapsuleInstanceId).toBeDefined()
            expect(event.caller.prop).toBe('increment')
        }
    })

    it('runFromSnapshot does not affect caller info', async () => {
        // Run twice: once with snapshot, once without — both should have identical caller info
        const eventsWithSnapshot: any[] = []
        const eventsWithoutSnapshot: any[] = []

        for (const [useSnapshot, collector] of [[true, eventsWithSnapshot], [false, eventsWithoutSnapshot]] as const) {
            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot, run: spineRun } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
                },
                onMembraneEvent: (event: any) => collector.push(event)
            })

            const capsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        value: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'test'
                        },
                        readValue: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.value
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'snapshot-compare-capsule'
            })

            let run: any
            if (useSnapshot) {
                const { run: snapshotRun } = await hoistSnapshot({ snapshot: await freeze() })
                run = snapshotRun
            } else {
                run = spineRun
            }

            await run({}, async ({ apis }: any) => {
                const api = apis[capsule.capsuleSourceLineRef]
                api.readValue()
            })
        }

        // Both runs should produce the same number and types of events
        expect(eventsWithSnapshot.length).toBe(eventsWithoutSnapshot.length)

        // Both should have caller info on all non-result events
        for (const events of [eventsWithSnapshot, eventsWithoutSnapshot]) {
            const nonResultEvents = events.filter((e: any) => e.event !== 'call-result')
            for (const event of nonResultEvents) {
                expect(event.caller).toBeDefined()
                const hasCapsuleRef = event.caller.capsuleSourceLineRef !== undefined
                const hasFileUri = event.caller.fileUri !== undefined
                expect(hasCapsuleRef || hasFileUri).toBe(true)
            }
        }

        // Internal events should have matching caller prop in both runs
        const snapshotInternal = eventsWithSnapshot.filter((e: any) => e.membrane === 'internal')
        const noSnapshotInternal = eventsWithoutSnapshot.filter((e: any) => e.membrane === 'internal')
        expect(snapshotInternal.length).toBe(noSnapshotInternal.length)
        for (let i = 0; i < snapshotInternal.length; i++) {
            expect(snapshotInternal[i].caller.prop).toBe(noSnapshotInternal[i].caller.prop)
        }
    })
})
