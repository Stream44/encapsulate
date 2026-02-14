
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


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
        'Hello: World',
        'Hello: World',
        'Hello: World'
    ])
})
