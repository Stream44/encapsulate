
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


it('Extend another capsule', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })


    // ##################################################
    // # Fixed Declared Structural Definitions
    // ##################################################
    // The structure of the system is defined in source files.

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                username: {
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        return `Hello: ${this.username}`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `Hello: ${this.username}`
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
            '#': {
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `Hello: ${this.username}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: capsule1,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule2',
        ambientReferences: { capsule1 }
    })

    // ##################################################
    // # Runtime Context with Imperative Binding Code
    // ##################################################

    const result = await run({
        overrides: {
            ['capsule2']: {
                '#': {
                    username: 'World'
                }
            }
        }
    }, async ({ apis }) => {

        return await Promise.all([
            apis['capsule2'].hello(),
            apis['capsule2'].helloGetter1,
            apis['capsule2'].helloGetter2
        ])
    })

    expect(result as any).toEqual([
        'Hello: World',
        'Hello: World',
        'Hello: World'
    ])
})

it('Extend capsule using string URI (relative path)', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const capsule3 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                extendedFunction: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Extended: ${this.baseFunction()}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: './base-capsule',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule3'
    })

    const result = await run({
        overrides: {
            ['capsule3']: {
                '#': {
                    baseProperty: 'overridden-value'
                }
            }
        }
    }, async ({ apis }) => {
        return {
            base: apis['capsule3'].baseFunction(),
            extended: apis['capsule3'].extendedFunction()
        }
    })

    expect(result as any).toEqual({
        base: 'Base: overridden-value',
        extended: 'Extended: Base: overridden-value'
    })
})

it('Capsule that both extends and maps the same capsule', async function () {

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
                sharedValue: {
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                getShared: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Shared: ${this.sharedValue}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'baseCapsule'
    })

    const capsule4 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                mappedBase: {
                    type: CapsulePropertyTypes.Mapping,
                    value: baseCapsule
                },
                useExtended: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Extended: ${this.getShared()}`
                    }
                },
                useMapped: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Mapped: ${this.mappedBase.getShared()}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: baseCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule4',
        ambientReferences: { baseCapsule }
    })

    const result = await run({
        overrides: {
            ['capsule4']: {
                '#': {
                    sharedValue: 'test-value'
                }
            }
        }
    }, async ({ apis }) => {
        return {
            extended: apis['capsule4'].useExtended(),
            mapped: apis['capsule4'].useMapped(),
            directExtended: apis['capsule4'].getShared()
        }
    })

    // Extended capsule shares self with capsule4, so it sees the override
    // Mapped capsule is a separate instance, so it doesn't see the override
    expect(result as any).toEqual({
        extended: 'Extended: Shared: test-value',
        mapped: 'Mapped: Shared: undefined',
        directExtended: 'Shared: test-value'
    })
})

it('Extended capsule function should see child capsule properties in this context', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Parent capsule with a function that accesses this.childProperty
    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                parentProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent-value'
                },
                getChildProperty: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // This function in parent should be able to access child's property
                        return `Child property: ${this.childProperty}`
                    }
                },
                getCombined: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // This function should see both parent and child properties
                        return `Parent: ${this.parentProperty}, Child: ${this.childProperty}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule'
    })

    // Child capsule extends parent and adds childProperty
    const childCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                childProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-value'
                }
            }
        }
    }, {
        extendsCapsule: parentCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'childCapsule',
        ambientReferences: { parentCapsule }
    })

    const result = await run({}, async ({ apis }) => {
        return {
            childProperty: apis['childCapsule'].getChildProperty,
            combined: apis['childCapsule'].getCombined,
            parentProperty: apis['childCapsule'].parentProperty
        }
    })

    // The parent's functions should see the child's properties when called through child
    expect(result as any).toEqual({
        childProperty: 'Child property: child-value',
        combined: 'Parent: parent-value, Child: child-value',
        parentProperty: 'parent-value'
    })
})

it('Mapped capsule that extends another should have correct this context', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Base capsule (like WorkspaceConfig.v0)
    const baseCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                baseValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                getBaseValue: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // This function accesses baseValue which should be set by child
                        return `Base value: ${this.baseValue}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'baseCapsule'
    })

    // Config capsule extends base (like ProjectDeploymentConfig.v0 extends WorkspaceConfig.v0)
    const configCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                configProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'config-value'
                }
            }
        }
    }, {
        extendsCapsule: baseCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'configCapsule',
        ambientReferences: { baseCapsule }
    })

    // Main capsule maps the config capsule (like WorkspaceStatus.v0 maps ProjectDeploymentConfig.v0)
    const mainCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                $config: {
                    type: CapsulePropertyTypes.Mapping,
                    value: configCapsule
                },
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<string> {
                        // Access the mapped config's getter which relies on baseValue
                        return this.$config.getBaseValue
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'mainCapsule'
    })

    const result = await run({
        overrides: {
            ['configCapsule']: {
                '#': {
                    baseValue: 'overridden-base-value'
                }
            }
        }
    }, async ({ apis }) => {
        return {
            fromMain: await apis['mainCapsule'].run(),
            directFromConfig: apis['configCapsule'].getBaseValue
        }
    })

    // The base capsule's getBaseValue should see the overridden baseValue
    expect(result as any).toEqual({
        fromMain: 'Base value: overridden-base-value',
        directFromConfig: 'Base value: overridden-base-value'
    })
})

it('Override on parent capsule should be visible to child that extends it', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Parent capsule (like WorkspaceConfig.v0) with workspaceRootDir
    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                workspaceRootDir: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                config: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // This function accesses workspaceRootDir
                        return `Config from: ${this.workspaceRootDir}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule'
    })

    // Child capsule extends parent (like ProjectDeploymentConfig.v0 extends WorkspaceConfig.v0)
    const childCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                childProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-value'
                }
            }
        }
    }, {
        extendsCapsule: parentCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'childCapsule',
        ambientReferences: { parentCapsule }
    })

    // Main capsule maps the child capsule (like WorkspaceStatus.v0 maps ProjectDeploymentConfig.v0)
    const mainCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                $config: {
                    type: CapsulePropertyTypes.Mapping,
                    value: childCapsule
                },
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<string> {
                        // Access the mapped config's getter which relies on workspaceRootDir
                        return this.$config.config
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'mainCapsule'
    })

    // Override is set on PARENT capsule name, not child
    const result = await run({
        overrides: {
            ['parentCapsule']: {
                '#': {
                    workspaceRootDir: '/test/workspace/root'
                }
            }
        }
    }, async ({ apis }) => {
        return {
            fromMain: await apis['mainCapsule'].run(),
            directFromChild: apis['childCapsule'].config
        }
    })

    // The parent's config getter should see the overridden workspaceRootDir
    // even when called through the child capsule
    expect(result as any).toEqual({
        fromMain: 'Config from: /test/workspace/root',
        directFromChild: 'Config from: /test/workspace/root'
    })
})

it('Property contract delegate options should be passed to struct capsule', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Main capsule that uses the struct via property contract delegate with options
    // The struct capsule is defined in ./struct-capsule.ts
    const mainCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#./struct-capsule': {
                as: '$struct',
                options: {
                    '#': {
                        schemaValue: {
                            'my schema': 'here'
                        }
                    }
                }
            },
            '#': {
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {
                        return this.$struct.getSchema
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'mainCapsule'
    })

    const result = await run({}, async ({ apis }) => {
        return {
            fromMain: await apis['mainCapsule'].run()
        }
    })

    // The struct capsule should see the options passed via property contract delegate
    expect(result as any).toEqual({
        fromMain: { 'my schema': 'here' }
    })
})

it('this.self should access only own capsule properties, this should access all merged properties', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Parent capsule with a property that will be overridden by child
    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                sharedProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent-value'
                },
                parentOnlyProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent-only'
                },
                getFromThis: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // this.sharedProperty should see the child's override
                        return `this.sharedProperty: ${this.sharedProperty}`
                    }
                },
                getFromSelf: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // this.self.sharedProperty should see only parent's own value
                        return `this.self.sharedProperty: ${this.self.sharedProperty}`
                    }
                },
                getBoth: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): object {
                        return {
                            thisValue: this.sharedProperty,
                            selfValue: this.self.sharedProperty,
                            parentOnly: this.self.parentOnlyProperty
                        }
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule'
    })

    // Child capsule extends parent and overrides sharedProperty
    const childCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                sharedProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-value'
                },
                childOnlyProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-only'
                }
            }
        }
    }, {
        extendsCapsule: parentCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'childCapsule',
        ambientReferences: { parentCapsule }
    })

    const result = await run({}, async ({ apis }) => {
        return {
            fromThis: apis['childCapsule'].getFromThis,
            fromSelf: apis['childCapsule'].getFromSelf,
            both: apis['childCapsule'].getBoth
        }
    })

    // this.sharedProperty sees child's override (merged context)
    // this.self.sharedProperty sees parent's own value (own context)
    expect(result as any).toEqual({
        fromThis: 'this.sharedProperty: child-value',
        fromSelf: 'this.self.sharedProperty: parent-value',
        both: {
            thisValue: 'child-value',
            selfValue: 'parent-value',
            parentOnly: 'parent-only'
        }
    })
})

it('this.self should work with GetterFunction properties', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Parent capsule with a getter that will be overridden by child
    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                baseValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent-base'
                },
                config: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): object {
                        return { source: 'parent', baseValue: this.baseValue }
                    }
                },
                getConfigFromSelf: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): object {
                        // this.self.config should call parent's own config getter
                        return this.self.config
                    }
                },
                getConfigFromThis: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): object {
                        // this.config should call child's config getter (if overridden)
                        return this.config
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule'
    })

    // Child capsule extends parent and overrides config getter
    const childCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                baseValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-base'
                },
                config: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): object {
                        return { source: 'child', baseValue: this.baseValue }
                    }
                }
            }
        }
    }, {
        extendsCapsule: parentCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'childCapsule',
        ambientReferences: { parentCapsule }
    })

    const result = await run({}, async ({ apis }) => {
        return {
            configFromSelf: apis['childCapsule'].getConfigFromSelf,
            configFromThis: apis['childCapsule'].getConfigFromThis
        }
    })

    // this.self.config should call parent's own config getter
    // this.config calls child's config getter (virtual dispatch — child override takes precedence)
    // Both see child's baseValue because this.baseValue resolves through shared self
    expect(result as any).toEqual({
        configFromSelf: { source: 'parent', baseValue: 'child-base' },
        configFromThis: { source: 'child', baseValue: 'child-base' }
    })
})


it('extendsCapsule with relative string URI resolves from co-located spineFilesystemRoot', async function () {

    // Use import.meta.dir as spineFilesystemRoot (narrow scope — same as standalone-rt does)
    // This simulates the case where a test maps a capsule that uses extendsCapsule: './base-capsule'
    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: import.meta.dir,
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Import the child capsule file which uses extendsCapsule: './base-capsule'
    const childCapsuleModule = await import('./child-of-base-capsule')
    const childCapsule = await childCapsuleModule.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

    const result = await run({
        overrides: {
            ['@test/child-of-base-capsule']: {
                '#': {
                    baseProperty: 'overridden-base'
                }
            }
        }
    }, async ({ apis }: any) => {
        return {
            childFunction: apis['@test/child-of-base-capsule'].childFunction(),
            baseFunction: apis['@test/child-of-base-capsule'].baseFunction(),
        }
    })

    expect((result as any).childFunction).toBe('Child: overridden-base + child-value')
    expect((result as any).baseFunction).toBe('Base: overridden-base')
})


it('Child Function override should be called when parent Function uses this.method() (virtual dispatch)', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Parent capsule with a "hoist" function that calls this.startServer()
    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                startServer: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return 'parent-server'
                    }
                },
                hoist: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        // This should call child's startServer override
                        return `hoisted: ${this.startServer()}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule'
    })

    // Child capsule extends parent and overrides startServer
    const childCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                startServer: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return 'child-server'
                    }
                }
            }
        }
    }, {
        extendsCapsule: parentCapsule,
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'childCapsule',
        ambientReferences: { parentCapsule }
    })

    const result = await run({}, async ({ apis }) => {
        return {
            // Direct call should use child's override
            directStartServer: apis['childCapsule'].startServer(),
            // Parent's hoist calling this.startServer() should also use child's override
            hoist: apis['childCapsule'].hoist()
        }
    })

    // Like class inheritance: child override should be called in both cases
    expect(result as any).toEqual({
        directStartServer: 'child-server',
        hoist: 'hoisted: child-server'
    })
})


it('scoped package URI resolves via filesystem convention walk-up when spineRoot is narrow', async function () {

    // Use a NARROW spineFilesystemRoot (this test dir) — NOT the monorepo root.
    // This simulates standalone-rt where spineRoot = package.json dir of the test.
    //
    // The capsule defined here (in @stream44.studio/encapsulate) maps a capsule from
    // a DIFFERENT scope: @stream44.studio/encapsulate/tests/05-Extends/base-capsule
    // (same scope — resolves via package.json name walk-up).
    //
    // The base-capsule then has its moduleFilepath set correctly, so any further
    // resolutions from IT would use the fromPath walk-up.
    //
    // To truly test cross-scope resolution with narrow spineRoot, we verify that the
    // resolve function's fromPath walk-up checks the scope/packages/pkg filesystem
    // convention at each directory level (not just package.json name and node_modules).
    //
    // We use the commonSpineContractOpts.resolve function directly to test this.

    const factory = await CapsuleSpineFactory({
        spineFilesystemRoot: import.meta.dir,
        staticAnalysisEnabled: true,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const resolve = factory.commonSpineContractOpts.resolve

    // This file is at: genesis/encapsulate.dev/packages/encapsulate/tests/05-Extends/main.test.ts
    // With spineRoot = this dir, resolving a same-scope URI should work:
    const sameScope = await resolve(
        '@stream44.studio/encapsulate/tests/05-Extends/base-capsule',
        join(import.meta.dir, 'main.test.ts')
    )
    expect(sameScope).toContain('base-capsule')

    // Now test cross-scope: resolve @stream44.studio/t44-docker.com/caps/Container from this file.
    // spineRoot is narrow (this dir), so spineRoot/t44.sh/packages/t44-docker.com/ doesn't exist.
    // @stream44.studio/t44-docker.com is NOT in root node_modules either — it can only be found
    // via the scope/packages/pkg filesystem convention: genesis/t44.sh/packages/t44-docker.com/
    // The resolve must walk up from fromPath to find it using that convention.
    const crossScope = await resolve(
        '@stream44.studio/t44-docker.com/caps/Container',
        join(import.meta.dir, 'main.test.ts')
    )
    expect(crossScope).toContain('t44.sh/packages/t44-docker.com/caps/Container')
})
