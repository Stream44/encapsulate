
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

        it('Nested options are forwarded to child capsules by capsule name', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                enableCallerStackInference: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const context = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        contextVar: {
                            type: CapsulePropertyTypes.String,
                            value: undefined,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'context',
            })

            const image = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        Config: {
                            type: CapsulePropertyTypes.Mapping,
                            value: context,
                            options: {},    // Hint that a new instance is required. This is meanigful. Keep the declaration.
                        },
                        imageVar: {
                            type: CapsulePropertyTypes.String,
                            value: undefined,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'image',
                ambientReferences: { context }
            })

            const project = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        Config: {
                            type: CapsulePropertyTypes.Mapping,
                            value: image,
                            options: async () => ({
                                '#': {
                                    imageVar: 'imageVarValue'
                                },
                                'context': {
                                    '#': {
                                        contextVar: 'contextVarValue'
                                    }
                                }
                            })
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'project',
                ambientReferences: { image }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            await run({}, async ({ apis }) => {
                const api = apis[project.capsuleSourceLineRef]
                // The image capsule's imageVar should be set via '#' options
                expect(api.Config.imageVar).toBe('imageVarValue')
                // The context capsule (nested inside image) should have contextVar set
                // via the 'context' nested options forwarded by capsule name
                expect(api.Config.Config.contextVar).toBe('contextVarValue')
            })
        })
    })
}
