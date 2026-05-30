
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

        it('Transitive overrides propagate through extends chain', async function () {

            const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                staticAnalysisEnabled: true,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // Config struct — like BuildConfig in inks
            const configStruct = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        setting: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'default',
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'configStruct',
            })

            // Base capsule — like Server in inks (has a struct delegate for configStruct)
            const baseCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#configStruct': {
                        as: 'config',
                        options: function ({ self }: any) {
                            return { '#': { /* base provides no setting override */ } }
                        },
                    },
                    '#': {
                        baseValue: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'base',
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'baseCapsule',
                ambientReferences: { configStruct }
            })

            // Child capsule — like DockerServer extending Server
            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        childValue: {
                            type: CapsulePropertyTypes.Literal,
                            value: 'child',
                        },
                    }
                }
            }, {
                extendsCapsule: baseCapsule,
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'childCapsule',
                ambientReferences: { baseCapsule }
            })

            // Consumer — maps childCapsule with transitive options targeting configStruct
            const consumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#': {
                        server: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: async () => ({
                                '#': {
                                    childValue: 'overridden-child',
                                },
                                'configStruct': {
                                    '#': {
                                        setting: 'from-consumer',
                                    }
                                }
                            })
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'consumer',
                ambientReferences: { childCapsule }
            })

            await run({}, async ({ apis }) => {
                const api = apis['consumer']
                // childValue should be set via '#' options
                expect(api.server.childValue).toBe('overridden-child')
                // configStruct setting should be set via transitive override through extends
                expect(api.server.config.setting).toBe('from-consumer')
            })
        })
    })
}
