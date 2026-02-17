
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
