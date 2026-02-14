
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { Spine, SpineRuntime, CapsulePropertyTypes, makeImportStack } from "../../src/encapsulate"


it('Minimal construction & execution', async function () {

    function CapsuleSpineContract() {

        return {
            makeContractCapsuleInstance: ({ self, encapsulatedApi }: { self: any, encapsulatedApi: Record<string, any> }) => {

                return {
                    mapProperty: ({ property }: { property: any }) => {

                        if (property.definition.type === CapsulePropertyTypes.String) {

                            if (typeof self[property.name] !== 'undefined') {
                                encapsulatedApi[property.name] = self[property.name]
                            } else {
                                encapsulatedApi[property.name] = property.definition.value
                            }

                        } else if (property.definition.type === CapsulePropertyTypes.Function) {

                            encapsulatedApi[property.name] = property.definition.value.bind(self)

                        } else if (property.definition.type === CapsulePropertyTypes.GetterFunction) {

                            encapsulatedApi[property.name] = property.definition.value.call(self)
                        }
                    }
                }
            }
        }
    }

    const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

    let { encapsulate } = await Spine({
        spineFilesystemRoot,
        spineContracts: {
            '$spineContract1': CapsuleSpineContract()
        },
    })


    // ##################################################
    // # Fixed Declared Structural Definitions
    // ##################################################
    // The structure of the system is defined in source files.

    const capsule = await encapsulate({
        '$spineContract1': {
            '#': {
                // CapsuleDefinition
                /*
                "<PropertyName>": {
                    // CapsulePropertyDefinition
     
                    type: '', // CapsulePropertyPrimitive
                    kind: '', // SpineContractPrimitive
                    value: '',
                    projections: {},
                    tags: {},
                }
                */

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
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `Hello: ${this.username}`
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack()
    })


    // ##################################################
    // # Runtime Context with Imperative Binding Code
    // ##################################################

    let { run } = await SpineRuntime({
        spineFilesystemRoot,
        spineContracts: {
            '$spineContract1': CapsuleSpineContract()
        },
        capsules: {
            [capsule.capsuleSourceLineRef]: capsule
        }
    })

    const result = await run({
        overrides: {
            [capsule.capsuleSourceLineRef]: {
                '#': {
                    username: 'World'
                }
            }
        }
    }, async ({ apis }) => {

        return await Promise.all([
            apis[capsule.capsuleSourceLineRef].hello(),
            apis[capsule.capsuleSourceLineRef].helloGetter1,
            apis[capsule.capsuleSourceLineRef].helloGetter2,
        ])
    })

    expect(result as any).toEqual([
        'Hello: World',
        'Hello: World',
        'Hello: World',
    ])
})
