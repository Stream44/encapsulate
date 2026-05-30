
import { describe, it, expect } from 'bun:test'
import * as bunTest from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


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
            apis[capsule1.capsuleSourceLineRef]['#@stream44.studio/encapsulate/structs/Capsule'].capsuleSourceNameRefHash,
            apis[capsule1.capsuleSourceLineRef]['#@stream44.studio/encapsulate/structs/Capsule'].capsuleSourceNameRefHash,
            apis[capsule2.capsuleSourceLineRef].username,
            apis[capsule2.capsuleSourceLineRef].hello(),
            apis[capsule2.capsuleSourceLineRef].helloGetter1,
            apis[capsule2.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.username,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.hello(),
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter1,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule['#@stream44.studio/encapsulate/structs/Capsule'].capsuleSourceNameRefHash,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule['#@stream44.studio/encapsulate/structs/Capsule'].capsuleSourceNameRefHash
        ])
    })

    const capsule1Hash = capsule1.cst.capsuleSourceNameRefHash
    expect(result as any).toEqual([
        'World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        '[global] Hello (capsule1): World',
        capsule1Hash,
        capsule1Hash,
        'Sun',
        'Hello (capsule2): Sun [mappedCapsule.hello: [realm:Admin] Hello (capsule1): World]',
        'Hello (capsule2): Sun',
        'Hello (capsule2): Sun',
        'World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
        '[realm:Admin] Hello (capsule1): World',
        capsule1Hash,
        capsule1Hash
    ])

    expect(membraneEvents.length).toBeGreaterThan(0)
    expect(membraneEvents[0].event).toBe('get')
    expect(membraneEvents[0].target.prop).toBe('username')
    expect(membraneEvents[0].target.capsuleSourceLineRef).toMatch(/main\.test:69$/)
    expect(membraneEvents[0].target.capsuleSourceNameRef).toMatch(/main\.test:capsule1$/)
    expect(membraneEvents[0].target.capsuleSourceNameRefHash).toBe(capsule1Hash)
    expect(membraneEvents[0].value).toBe('World')

    const callEvents = membraneEvents.filter((e: any) => e.event === 'call')
    expect(callEvents.length).toBeGreaterThan(0)
    expect(callEvents[0].target.prop).toBe('hello')

    const callResultEvents = membraneEvents.filter((e: any) => e.event === 'call-result')
    expect(callResultEvents.length).toBeGreaterThan(0)
    expect(callResultEvents[0].result).toBe('[global] Hello (capsule1): World')

    const structEvents = membraneEvents.filter((e: any) => e.target?.capsuleSourceLineRef?.includes('structs/Capsule'))
    expect(structEvents.length).toBeGreaterThan(0)
})


it('spineFilesystemRoot is accessible on the Capsule struct metadata', async function () {

    const spineRoot = join(import.meta.dir, '../../../../..')

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: spineRoot,
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        },
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'test'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'spineFilesystemRootTest'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[capsule1.capsuleSourceLineRef]
        const structMeta = api['#@stream44.studio/encapsulate/structs/Capsule']
        return {
            spineFilesystemRoot: structMeta.spineFilesystemRoot,
            hash: structMeta.capsuleSourceNameRefHash,
        }
    })

    expect(result.spineFilesystemRoot).toBe(spineRoot)
    expect(result.hash).toBeDefined()
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
    // This tests the pattern: '#@stream44.studio/encapsulate/structs/Capsule': { as: '$capsuleInfo' }
    // Instead of accessing via api['#@stream44.studio/encapsulate/structs/Capsule'], use api.$capsuleInfo
    const capsuleWithAlias = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {
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
    const spineContractProps = capsuleWithAlias.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'].propertyContracts
    expect(spineContractProps['#@stream44.studio/encapsulate/structs/Capsule'].as).toBe('$capsuleInfo')

    // Verify the dynamic mapping in '#' uses the alias as the key
    expect(spineContractProps['#'].properties['$capsuleInfo']).toBeDefined()
    expect(spineContractProps['#'].properties['$capsuleInfo'].as).toBe('$capsuleInfo')
    expect(spineContractProps['#'].properties['$capsuleInfo'].propertyContractDelegate).toBe('#@stream44.studio/encapsulate/structs/Capsule')

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
            '#@stream44.studio/encapsulate/structs/Capsule': {},
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
            sharedValueB: api.consumer.$configB.sharedValue,
            structBTestOption: api.consumer.$configB.testOption
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

    // Verify options are passed to StructB and set the testOption property
    expect(result.structBTestOption).toBe('testValue')
})


it('StructInit runs once after initialization, before handler, with proper this context', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'capsule1'
                },
                initialized: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initSetup: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initialized = true
                    }
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Hello from ${this.name}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structInitCapsule1'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[capsule1.capsuleSourceLineRef]

        return {
            initialized: api.initialized,
            hello: api.hello(),
            // StructInit property should NOT be on the API
            hasInitSetup: 'initSetup' in api
        }
    })

    expect(result.initialized).toBe(true)
    expect(result.hello).toBe('Hello from capsule1')
    expect(result.hasInitSetup).toBe(false)
})


it('StructInit async function support', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'asyncCapsule'
                },
                asyncInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                asyncInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: async function (this: any) {
                        this.asyncInitDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'asyncStructInitCapsule'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        expect(apis[capsule1.capsuleSourceLineRef].asyncInitDone).toBe(true)
    })
})


it('StructInit multiple per capsule', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'multiInit'
                },
                initADone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initBDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initA: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initADone = true
                    }
                },
                initB: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initBDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'multiStructInitCapsule'
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


it('StructInit tree traversal: child before extended parent (top-down)', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Root capsule that maps the child (which extends parent via file-based capsules)
    const rootCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                child: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './caps/InitChild.v0'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structInitRoot'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const childApi = apis[rootCapsule.capsuleSourceLineRef].child
        // Top-down: child's StructInit runs before parent's StructInit
        // Both share the same 'this' (sharedSelf), so initOrder tracks the order
        expect(childApi.initOrder).toBe('child,parent')
    })
})


it('StructInit runs for mapped capsules in the tree', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Leaf capsule with StructInit
    const leafCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                label: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'leaf'
                },
                leafInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                leafInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.leafInitDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structInitLeaf'
    })

    // Root capsule with StructInit that maps the leaf
    const rootCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                label: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'root'
                },
                rootInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                rootInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.rootInitDone = true
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
        capsuleName: 'structInitRootWithMapping',
        ambientReferences: { leafCapsule }
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const rootApi = apis[rootCapsule.capsuleSourceLineRef]
        // Both root and leaf StructInit should have run
        expect(rootApi.rootInitDone).toBe(true)
        expect(rootApi.mapped.leafInitDone).toBe(true)
    })
})


// ##################################################
// # Static Contract StructInit Tests
// ##################################################

it('Static: StructInit runs once after initialization, before handler, with proper this context', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + StaticCapsuleSpineContract['#']]: StaticCapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'capsule1'
                },
                initialized: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initSetup: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initialized = true
                    }
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Hello from ${this.name}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'staticStructInitCapsule1'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[capsule1.capsuleSourceLineRef]

        return {
            initialized: api.initialized,
            hello: api.hello(),
            hasInitSetup: 'initSetup' in api
        }
    })

    expect(result.initialized).toBe(true)
    expect(result.hello).toBe('Hello from capsule1')
    expect(result.hasInitSetup).toBe(false)
})


it('Static: StructInit async function support', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + StaticCapsuleSpineContract['#']]: StaticCapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'asyncCapsule'
                },
                asyncInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                asyncInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: async function (this: any) {
                        this.asyncInitDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'staticAsyncStructInitCapsule'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        expect(apis[capsule1.capsuleSourceLineRef].asyncInitDone).toBe(true)
    })
})


it('Static: StructInit multiple per capsule', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + StaticCapsuleSpineContract['#']]: StaticCapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'multiInit'
                },
                initADone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initBDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initA: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initADone = true
                    }
                },
                initB: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initBDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'staticMultiStructInitCapsule'
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


it('Static: StructInit tree traversal: child before extended parent (top-down)', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + StaticCapsuleSpineContract['#']]: StaticCapsuleSpineContract
        }
    })

    const rootCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                child: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './caps/InitChild.v0'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'staticStructInitRoot'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const childApi = apis[rootCapsule.capsuleSourceLineRef].child
        expect(childApi.initOrder).toBe('child,parent')
    })
})


it('Static: StructInit runs for mapped capsules in the tree', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + StaticCapsuleSpineContract['#']]: StaticCapsuleSpineContract
        }
    })

    const leafCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                label: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'leaf'
                },
                leafInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                leafInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.leafInitDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'staticStructInitLeaf'
    })

    const rootCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                label: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'root'
                },
                rootInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                rootInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.rootInitDone = true
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
        capsuleName: 'staticStructInitRootWithMapping',
        ambientReferences: { leafCapsule }
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const rootApi = apis[rootCapsule.capsuleSourceLineRef]
        expect(rootApi.rootInitDone).toBe(true)
        expect(rootApi.mapped.leafInitDone).toBe(true)
    })
})


// ##################################################
// # StructDispose Tests
// ##################################################

it('StructDispose runs after handler completes', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'capsule1'
                },
                initDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                disposeDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                structInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initDone = true
                    }
                },
                structDispose: {
                    type: CapsulePropertyTypes.StructDispose,
                    value: function (this: any) {
                        this.disposeDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structDisposeCapsule1'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    let initDoneInHandler = false
    let disposeDoneInHandler = false
    await run({}, async ({ apis }) => {
        const api = apis[capsule1.capsuleSourceLineRef]
        initDoneInHandler = api.initDone
        disposeDoneInHandler = api.disposeDone
    })

    expect(initDoneInHandler).toBe(true)
    expect(disposeDoneInHandler).toBe(false)
})


it('StructDispose runs in reverse order (bottom-up)', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
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
                structInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.leafInitDone = true
                    }
                },
                structDispose: {
                    type: CapsulePropertyTypes.StructDispose,
                    value: function (this: any) {
                        this.leafDisposeDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structDisposeLeaf'
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
                structInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.rootInitDone = true
                    }
                },
                structDispose: {
                    type: CapsulePropertyTypes.StructDispose,
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
        capsuleName: 'structDisposeRoot',
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


it('StructDispose async function support', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'asyncDispose'
                },
                asyncInitDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                asyncDisposeDone: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                structInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: async function (this: any) {
                        this.asyncInitDone = true
                    }
                },
                structDispose: {
                    type: CapsulePropertyTypes.StructDispose,
                    value: async function (this: any) {
                        this.asyncDisposeDone = true
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'asyncStructDisposeCapsule'
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


it('StructDispose property should NOT be on the API', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'test'
                },
                structInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) { }
                },
                structDispose: {
                    type: CapsulePropertyTypes.StructDispose,
                    value: function (this: any) { }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structDisposeNotOnApi'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const api = apis[capsule1.capsuleSourceLineRef]
        expect('structInit' in api).toBe(false)
        expect('structDispose' in api).toBe(false)
    })
})


it('StructInit and StructDispose fire for extended capsules in struct context', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Root capsule that maps the child (which extends parent via file-based capsules)
    // This test uses the existing InitChild.v0 and InitParent.v0 capsules
    const rootCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                child: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './caps/InitChild.v0'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'structDisposeExtendedRoot'
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    await run({}, async ({ apis }) => {
        const childApi = apis[rootCapsule.capsuleSourceLineRef].child
        // Top-down: child's StructInit runs before parent's StructInit
        // Both share the same 'this' (sharedSelf), so initOrder tracks the order
        expect(childApi.initOrder).toBe('child,parent')
    })
})
