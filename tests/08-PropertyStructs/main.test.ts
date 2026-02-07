
import { describe, it, expect } from 'bun:test'
import * as bunTest from 'bun:test'
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
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
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
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
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
            apis[capsule1.capsuleSourceLineRef]['#@stream44.studio/encapsulate/structs/Capsule.v0'].capsuleSourceNameRefHash,
            apis[capsule1.capsuleSourceLineRef]['#@stream44.studio/encapsulate/structs/Capsule.v0'].capsuleSourceNameRefHash,
            apis[capsule2.capsuleSourceLineRef].username,
            apis[capsule2.capsuleSourceLineRef].hello(),
            apis[capsule2.capsuleSourceLineRef].helloGetter1,
            apis[capsule2.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.username,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.hello(),
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter1,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule['#@stream44.studio/encapsulate/structs/Capsule.v0'].capsuleSourceNameRefHash,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule['#@stream44.studio/encapsulate/structs/Capsule.v0'].capsuleSourceNameRefHash
        ])
    })

    expect(result as any).toEqual([
        'World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        '33ef2e9143c47fb44aae8f7c55a210cc',
        '33ef2e9143c47fb44aae8f7c55a210cc',
        'Sun',
        'Hello (capsule2): Sun [mappedCapsule.hello: [realm:Admin] Hello (capsule1): World]',
        'Hello (capsule2): Sun',
        'Hello (capsule2): Sun',
        'World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
        '33ef2e9143c47fb44aae8f7c55a210cc',
        '33ef2e9143c47fb44aae8f7c55a210cc'
    ])

    expect(JSON.parse(JSON.stringify(membraneEvents))).toMatchSnapshot()
})


it('Property struct with "as" alias', async function () {

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

    // Define a capsule that uses the Capsule.v0 struct with 'as' alias
    // This tests the pattern: '#@stream44.studio/encapsulate/structs/Capsule.v0': { as: '$capsuleInfo' }
    // Instead of accessing via api['#@stream44.studio/encapsulate/structs/Capsule.v0'], use api.$capsuleInfo
    const capsuleWithAlias = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {
                as: '$capsuleInfo',
            },
            '#': {
                myValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'test-value'
                },
                getHash: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Hash: ${this.$capsuleInfo.capsuleSourceNameRefHash}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsuleWithAlias'
    })

    // Verify the CST contains the 'as' property on the property contract
    const spineContractProps = capsuleWithAlias.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'].properties
    expect(spineContractProps['#@stream44.studio/encapsulate/structs/Capsule.v0'].as).toBe('$capsuleInfo')

    // Verify the dynamic mapping in '#' uses the alias as the key
    expect(spineContractProps['#'].properties['$capsuleInfo']).toBeDefined()
    expect(spineContractProps['#'].properties['$capsuleInfo'].as).toBe('$capsuleInfo')
    expect(spineContractProps['#'].properties['$capsuleInfo'].propertyContractDelegate).toBe('#@stream44.studio/encapsulate/structs/Capsule.v0')

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[capsuleWithAlias.capsuleSourceLineRef]

        // Access via the alias '$capsuleInfo' instead of the full URI
        const hashViaAlias = api.$capsuleInfo.capsuleSourceNameRefHash
        const getHashResult = api.getHash()

        return { hashViaAlias, getHashResult }
    })

    // Verify alias access works
    expect(result.hashViaAlias).toBeDefined()
    // Verify function using alias in this context works
    expect(result.getHashResult).toBe(`Hash: ${result.hashViaAlias}`)
})


it('Multiple structs extending same parent capsule get separate instances', async function () {
    // This tests the pattern where two different struct capsules extend the same parent capsule.
    // Each struct should get its own instance of the parent with its own 'this' context.
    // This is the pattern used by ProjectDeploymentConfig and WorkspaceCliConfig both extending WorkspaceConfig.

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Create a test capsule that maps the consumer capsule by string URI
    const testCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
            '#': {
                consumer: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './caps/Consumer.v0'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'testCapsule'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[testCapsule.capsuleSourceLineRef]

        return {
            configA: await api.consumer.getConfigA,
            configB: await api.consumer.getConfigB,
            capsuleNameA: await api.consumer.getCapsuleNameA,
            capsuleNameB: await api.consumer.getCapsuleNameB,
            structAOnly: api.consumer.$configA.structAOnly,
            structBOnly: api.consumer.$configB.structBOnly,
            sharedValueA: api.consumer.$configA.sharedValue,
            sharedValueB: api.consumer.$configB.sharedValue
        }
    })

    // CRITICAL: Each struct should have its own capsuleName in the 'this' context
    // structA should see its own capsuleName '@test/08-PropertyStructs/structs/StructA.v0'
    // structB should see its own capsuleName '@test/08-PropertyStructs/structs/StructB.v0'
    // They should NOT share the same 'this' context!
    expect(result.capsuleNameA).toBe('@test/08-PropertyStructs/structs/StructA.v0')
    expect(result.capsuleNameB).toBe('@test/08-PropertyStructs/structs/StructB.v0')

    // The getConfigForCapsule getter should return different values based on capsuleName
    expect(result.configA).toBe('config-for-@test/08-PropertyStructs/structs/StructA.v0')
    expect(result.configB).toBe('config-for-@test/08-PropertyStructs/structs/StructB.v0')

    // Each struct should have its own unique properties
    expect(result.structAOnly).toBe('only-in-A')
    expect(result.structBOnly).toBe('only-in-B')

    // Both should inherit sharedValue from parent
    expect(result.sharedValueA).toBe('shared-from-parent')
    expect(result.sharedValueB).toBe('shared-from-parent')
})
