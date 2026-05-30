
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


for (const { label, Contract } of [
    { label: 'Static', Contract: StaticCapsuleSpineContract },
    { label: 'Membrane', Contract: CapsuleSpineContract },
]) {

    describe(`${label}: Struct delegate depends`, function () {

        it('struct delegate options function can access parent properties via depends', async function () {

            const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                staticAnalysisEnabled: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A struct with a configurable property
            const myStruct = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: {} as any,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'myStruct',
            })

            // A consumer that forwards its own property to the struct via depends
            const consumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#myStruct': {
                        as: '$config',
                        depends: ['configOverrides'],
                        options: function ({ self }: any) {
                            return {
                                '#': {
                                    config: self.configOverrides || {},
                                }
                            }
                        },
                    },
                    '#': {
                        configOverrides: {
                            type: CapsulePropertyTypes.Literal,
                            value: {} as any,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'consumer',
                ambientReferences: { myStruct }
            })

            await run({
                options: {
                    [consumer.capsuleSourceLineRef]: {
                        '#': {
                            configOverrides: { plugins: ['a', 'b'], port: 3000 },
                        }
                    }
                }
            }, async ({ apis }) => {
                const api = apis['consumer']
                // The struct should receive the config forwarded from the consumer's property
                expect(api.$config.config).toEqual({ plugins: ['a', 'b'], port: 3000 })
            })
        })

        it('struct delegate depends auto-detects referenced properties', async function () {

            const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                staticAnalysisEnabled: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const myStruct = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        label: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'default',
                        },
                        count: {
                            type: CapsulePropertyTypes.Literal,
                            value: 0,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'myStruct2',
            })

            // Consumer uses depends array to declare which properties are needed
            const consumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#myStruct2': {
                        as: '$info',
                        depends: ['myLabel', 'myCount'],
                        options: function ({ self }: any) {
                            return {
                                '#': {
                                    label: self.myLabel,
                                    count: self.myCount,
                                }
                            }
                        },
                    },
                    '#': {
                        myLabel: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'unset',
                        },
                        myCount: {
                            type: CapsulePropertyTypes.Literal,
                            value: -1,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'consumer2',
                ambientReferences: { myStruct2: myStruct }
            })

            await run({
                options: {
                    [consumer.capsuleSourceLineRef]: {
                        '#': {
                            myLabel: 'hello',
                            myCount: 42,
                        }
                    }
                }
            }, async ({ apis }) => {
                const api = apis['consumer2']
                expect(api.$info.label).toBe('hello')
                expect(api.$info.count).toBe(42)
            })
        })
    })
}
