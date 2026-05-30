
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


for (const { label, Contract } of [
    { label: 'Static', Contract: StaticCapsuleSpineContract },
    { label: 'Membrane', Contract: CapsuleSpineContract },
]) {

    describe(label, function () {

        it('Property struct delegate with function options calls the function', async function () {

            const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                staticAnalysisEnabled: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // Struct capsule with configurable properties
            const myStruct = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        workspaceDir: {
                            type: CapsulePropertyTypes.Literal,
                            value: '' as string,
                        },
                        label: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'default-label',
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'myStruct',
            })

            // Consumer uses the struct as a property contract delegate
            // with a FUNCTION for options (like Server.ts does for BuildConfig)
            const consumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#myStruct': {
                        as: '$config',
                        options: function ({ self }: any) {
                            // This function should be called and its result applied
                            return {
                                '#': {
                                    workspaceDir: '/test/workspace',
                                    label: 'from-function',
                                }
                            }
                        },
                    },
                    '#': {
                        name: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'consumer',
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'consumer',
                ambientReferences: { myStruct }
            })

            await run({}, async ({ apis }) => {
                const api = apis['consumer']
                // The struct should have the values from the function options
                expect(api.$config.workspaceDir).toBe('/test/workspace')
                expect(api.$config.label).toBe('from-function')
            })
        })
    })
}
