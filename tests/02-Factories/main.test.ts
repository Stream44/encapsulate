
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"
import { CapsuleSpineContract as MembraneCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"


it('Minimal construction & execution', async function () {

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

    await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                PREFIX: {
                    type: CapsulePropertyTypes.Constant,
                    value: '[MSG]',
                },
                username: {
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        return `${this.PREFIX} Hello: ${this.username}`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `${this.PREFIX} Hello: ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `${this.PREFIX} Hello: ${this.username}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'capsule1'
    })


    // ##################################################
    // # Runtime Context with Imperative Binding Code
    // ##################################################

    const result = await run({
        overrides: {
            ['capsule1']: {
                '#': {
                    username: 'World'
                }
            }
        }
    }, async ({ apis }) => {

        return await Promise.all([
            apis['capsule1'].hello(),
            apis['capsule1'].helloGetter1,
            apis['capsule1'].helloGetter2
        ])
    })

    expect(result as any).toEqual([
        '[MSG] Hello: World',
        '[MSG] Hello: World',
        '[MSG] Hello: World'
    ])
})

describe('Membrane spine contract with Constant property', () => {

    it('Constant property works like Literal but throws on set', async function () {

        const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

        const { encapsulate, CapsulePropertyTypes, makeImportStack, commonSpineContractOpts } = await CapsuleSpineFactory({
            spineFilesystemRoot,
            staticAnalysisEnabled: false,
            spineContracts: {
                ['#' + MembraneCapsuleSpineContract['#']]: MembraneCapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    PREFIX: {
                        type: CapsulePropertyTypes.Constant,
                        value: '[CONST]',
                    },
                    username: {
                        type: CapsulePropertyTypes.String,
                        value: undefined
                    },
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.PREFIX} Hello: ${this.username}`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'membraneCapsule1'
        })

        const { run } = await import('../../src/encapsulate').then(m => m.SpineRuntime({
            spineFilesystemRoot,
            capsules: {
                'membraneCapsule1': capsule1
            },
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': MembraneCapsuleSpineContract(commonSpineContractOpts)
            }
        }))

        // Test that Constant property can be read
        const result = await run({
            overrides: {
                ['membraneCapsule1']: {
                    '#': {
                        username: 'TestUser'
                    }
                }
            }
        }, async ({ apis }) => {
            expect(apis['membraneCapsule1'].PREFIX).toBe('[CONST]')
            return apis['membraneCapsule1'].hello()
        })

        expect(result).toBe('[CONST] Hello: TestUser')

        // Test that trying to set Constant property throws
        await expect(async () => {
            await run({}, async ({ apis }) => {
                apis['membraneCapsule1'].PREFIX = 'NEW_VALUE'
            })
        }).toThrow("Cannot set constant property 'PREFIX'")
    })
})
