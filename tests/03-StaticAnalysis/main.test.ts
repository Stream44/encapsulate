
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


it('Capsule source analysis', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // ##################################################
    // # Fixed Declared Structural Definitions
    // ##################################################
    // The structure of the system is defined in source files and this
    // structure is frozen into exectuable snapshots.
    // Source code is statically analyzed in order to obtain complete
    // information about permanent structural relationships that make up
    // the binding spine of the system. These relationships must be defined
    // using universally resolvable URI references.

    const prefix = 'capsule'

    const capsule1 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
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
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        ambientReferences: {
            prefix
        }
    })

    const capsule2 = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
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

                        return `[${prefix}] Hello (capsule2): ${this.username} [mappedCapsule.hello: ${mappedCapsuleResponse}]`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `[${prefix}] Hello (capsule2): ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `[${prefix}] Hello (capsule2): ${this.username}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        ambientReferences: {
            prefix,
            capsule1
        }
    })

    // ##################################################
    // # Runtime Context with Imperative Binding Code
    // ##################################################

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
            apis[capsule1.capsuleSourceLineRef].hello(),
            apis[capsule1.capsuleSourceLineRef].helloGetter1,
            apis[capsule1.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].hello(),
            apis[capsule2.capsuleSourceLineRef].helloGetter1,
            apis[capsule2.capsuleSourceLineRef].helloGetter2,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.hello(),
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter1,
            apis[capsule2.capsuleSourceLineRef].mappedCapsule.helloGetter2
        ])
    })

    expect(result as any).toEqual([
        '[capsule][global] Hello (capsule1): World',
        '[capsule][global] Hello (capsule1): World',
        '[capsule][global] Hello (capsule1): World',
        '[capsule] Hello (capsule2): Sun [mappedCapsule.hello: [capsule][realm:Admin] Hello (capsule1): World]',
        '[capsule] Hello (capsule2): Sun',
        '[capsule] Hello (capsule2): Sun',
        '[capsule][realm:Admin] Hello (capsule1): World',
        '[capsule][realm:Admin] Hello (capsule1): World',
        '[capsule][realm:Admin] Hello (capsule1): World',
    ])

    expect(capsule1.capsuleSourceLineRef).toMatch(/main\.test:69$/)
    expect(capsule1.cst.cacheBustVersion).toBeNumber()
    expect(capsule1.cst.capsuleSourceLineRef).toMatch(/main\.test:69$/)
    expect(capsule1.cst.source.declarationLine).toBe(29)
    expect(capsule1.cst.source.definitionStartLine).toBe(29)
    expect(capsule1.cst.source.definitionEndLine).toBe(67)
    expect(capsule1.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].group.type).toBe('Literal')
    expect(capsule1.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].group.value).toBe('Admin')
    expect(capsule1.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].hello.type).toBe('Function')
    expect(capsule1.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].username.type).toBe('String')

    expect(capsule2.capsuleSourceLineRef).toMatch(/main\.test:120$/)
    expect(capsule2.cst.cacheBustVersion).toBeNumber()
    expect(capsule2.cst.capsuleSourceLineRef).toMatch(/main\.test:120$/)
    expect(capsule2.cst.source.declarationLine).toBe(75)
    expect(capsule2.cst.source.definitionStartLine).toBe(75)
    expect(capsule2.cst.source.definitionEndLine).toBe(118)
    expect(capsule2.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].mappedCapsule.type).toBe('Mapping')
    expect(capsule2.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].mappedCapsule.value.capsuleSourceLineRef).toMatch(/main\.test:69$/)
    expect(capsule2.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].hello.type).toBe('Function')
    expect(capsule2.definition['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']['#'].username.type).toBe('String')
})
