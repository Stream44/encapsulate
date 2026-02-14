
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


it('Extend another capsule', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        staticAnalysisEnabled: false,
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
        capsuleName: 'capsule2'
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
        staticAnalysisEnabled: false,
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'capsule4'
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'childCapsule'
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'configCapsule'
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'childCapsule'
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
        staticAnalysisEnabled: false,
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'childCapsule'
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
        staticAnalysisEnabled: false,
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
        capsuleName: 'childCapsule'
    })

    const result = await run({}, async ({ apis }) => {
        return {
            configFromSelf: apis['childCapsule'].getConfigFromSelf,
            configFromThis: apis['childCapsule'].getConfigFromThis
        }
    })

    // this.self.config should call parent's own config getter
    // this.config also calls parent's config getter (since we're in parent's context)
    // Both see child's baseValue because this.baseValue resolves through shared self
    expect(result as any).toEqual({
        configFromSelf: { source: 'parent', baseValue: 'child-base' },
        configFromThis: { source: 'parent', baseValue: 'child-base' }
    })
})
