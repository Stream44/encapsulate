
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


it('Construction & execution with mappings', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
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
        capsuleName: 'capsule1',
    })

    const capsule3 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                mappedCapsule1: {
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
                mappedCapsule2: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './capsule2',
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

                        const mappedCapsule1Response = this.mappedCapsule1.hello()
                        const mappedCapsule2Response = this.mappedCapsule2.hello()

                        return `Hello (capsule2): ${this.username} [mappedCapsule1.hello: ${mappedCapsule1Response}] [mappedCapsule2.hello: ${mappedCapsule2Response}]`
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
        capsuleName: 'capsule3',
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
                    realm: 'global1'
                }
            },
        },
        overrides: {
            [capsule1.capsuleSourceLineRef]: {
                '#': {
                    username: 'World1'
                }
            },
            ['capsule2']: {
                '#': {
                    username: 'Sun2'
                }
            }
        }
    }, async ({ apis }) => {

        // Run Capsule DAG on Spine
        return Promise.all([
            apis[capsule1.capsuleSourceLineRef].hello(),
            apis[capsule1.capsuleSourceLineRef].helloGetter1,
            apis[capsule1.capsuleSourceLineRef].helloGetter2,
            apis[capsule3.capsuleSourceLineRef].hello(),
            apis[capsule3.capsuleSourceLineRef].helloGetter1,
            apis[capsule3.capsuleSourceLineRef].helloGetter2,
            apis[capsule3.capsuleSourceLineRef].mappedCapsule1.hello(),
            apis[capsule3.capsuleSourceLineRef].mappedCapsule1.helloGetter1,
            apis[capsule3.capsuleSourceLineRef].mappedCapsule1.helloGetter2,
            apis[capsule3.capsuleSourceLineRef].mappedCapsule2.hello(),
            apis[capsule3.capsuleSourceLineRef].mappedCapsule2.helloGetter1,
            apis[capsule3.capsuleSourceLineRef].mappedCapsule2.helloGetter2
        ])
    })

    expect(result as any).toEqual([
        '[global1] Hello (capsule1): World1',
        '[global1] Hello (capsule1): World1',
        '[global1] Hello (capsule1): World1',
        'Hello (capsule2): undefined [mappedCapsule1.hello: [realm:Admin] Hello (capsule1): World1] [mappedCapsule2.hello: [realm:Admin] Hello (capsule2): Sun2]',
        'Hello (capsule2): undefined',
        'Hello (capsule2): undefined',
        '[realm:Admin] Hello (capsule1): World1',
        '[realm:Admin] Hello (capsule1): World1',
        '[realm:Admin] Hello (capsule1): World1',
        '[realm:Admin] Hello (capsule2): Sun2',
        '[realm:Admin] Hello (capsule2): Sun2',
        '[realm:Admin] Hello (capsule2): Sun2',
    ])
})


it('Mapping options as object (not function)', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const baseCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                config: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                getValue: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `config=${JSON.stringify(this.config)}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'baseCapsule',
    })

    const wrapperCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                mapped: {
                    type: CapsulePropertyTypes.Mapping,
                    value: baseCapsule,
                    options: {
                        '#': {
                            config: { key: 'value', nested: { a: 1 } }
                        }
                    }
                },
                getFromMapped: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return this.mapped.getValue()
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'wrapperCapsule',
        ambientReferences: {
            baseCapsule
        }
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        return apis[wrapperCapsule.capsuleSourceLineRef].getFromMapped()
    })

    expect(result).toBe('config={"key":"value","nested":{"a":1}}')
})


it('Capsule instance reuse preserves Literal property values from options', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const sharedCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                env: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                getEnvConfig: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        return this.env
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'sharedEnvCapsule',
    })

    const capsuleWithOptions = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                shared: {
                    type: CapsulePropertyTypes.Mapping,
                    value: sharedCapsule,
                    options: {
                        '#': {
                            env: {
                                API_TOKEN: { factReference: 'some/fact:token' }
                            }
                        }
                    }
                },
                getSharedEnv: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        return this.shared.getEnvConfig()
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsuleWithOptions',
        ambientReferences: {
            sharedCapsule
        }
    })

    const capsuleWithoutOptions = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                shared: {
                    type: CapsulePropertyTypes.Mapping,
                    value: sharedCapsule
                },
                getSharedEnv: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        return this.shared.getEnvConfig()
                    }
                },
                getSharedEnvDirect: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): any {
                        return this.shared.env
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsuleWithoutOptions',
        ambientReferences: {
            sharedCapsule
        }
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        return {
            fromWithOptions: apis[capsuleWithOptions.capsuleSourceLineRef].getSharedEnv(),
            fromWithoutOptions: apis[capsuleWithoutOptions.capsuleSourceLineRef].getSharedEnv(),
            directAccess: apis[capsuleWithoutOptions.capsuleSourceLineRef].getSharedEnvDirect
        }
    })

    expect(result.fromWithOptions).toEqual({ API_TOKEN: { factReference: 'some/fact:token' } })
    expect(result.fromWithoutOptions).toEqual({ API_TOKEN: { factReference: 'some/fact:token' } })
    expect(result.directAccess).toEqual({ API_TOKEN: { factReference: 'some/fact:token' } })
})
