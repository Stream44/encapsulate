
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


for (const { label, Contract } of [
    { label: 'Static.v0', Contract: StaticCapsuleSpineContract },
    { label: 'Membrane.v0', Contract: CapsuleSpineContract },
]) {

    describe(label, function () {

        it('Explicit depends: options({ self }) receives resolved siblings and Capsule struct', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule that exposes a connection factory
            const connectionLib = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        ConnectionFactory: {
                            type: CapsulePropertyTypes.Literal,
                            value: {
                                fromJSON: (json: any) => ({ type: 'connection', ...json })
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'connectionLib',
            })

            // A capsule that receives config
            const configConsumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'configConsumer',
            })

            // The main capsule maps both, with the second depending on the first
            const mainCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        connLib: {
                            type: CapsulePropertyTypes.Mapping,
                            value: connectionLib,
                        },
                        consumer: {
                            type: CapsulePropertyTypes.Mapping,
                            value: configConsumer,
                            depends: ['connLib'],
                            options: function ({ self }: any) {
                                // self.connLib is the resolved sibling mapping
                                // self['#@stream44.studio/encapsulate/structs/Capsule'] is the capsule metadata
                                const capsuleStruct = self['#@stream44.studio/encapsulate/structs/Capsule']
                                return {
                                    '#': {
                                        config: self.connLib.ConnectionFactory.fromJSON({
                                            url: 'http://localhost:8080',
                                            ownerCapsule: capsuleStruct.capsuleName
                                        })
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'mainCapsule',
                ambientReferences: { connectionLib, configConsumer }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }) => {
                return apis[mainCapsule.capsuleSourceLineRef].consumer.getConfig()
            })

            // config was built using self.connLib (resolved sibling) and self['#@...structs/Capsule'].capsuleName
            expect(result).toEqual({
                type: 'connection',
                url: 'http://localhost:8080',
                ownerCapsule: 'mainCapsule'
            })
        })

        it('Capsule struct is always available in options({ self }) without depends', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule that receives config
            const configConsumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'configConsumer',
            })

            // Main capsule uses options({ self }) WITHOUT depends
            // self['#@stream44.studio/encapsulate/structs/Capsule'] should still be available
            const mainCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        consumer: {
                            type: CapsulePropertyTypes.Mapping,
                            value: configConsumer,
                            // NO depends declared
                            options: function ({ self }: any) {
                                const capsuleStruct = self['#@stream44.studio/encapsulate/structs/Capsule']
                                return {
                                    '#': {
                                        config: {
                                            ownerCapsule: capsuleStruct.capsuleName,
                                            moduleFilepath: capsuleStruct.moduleFilepath,
                                        }
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'mainCapsuleNoDeps',
                ambientReferences: { configConsumer }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }) => {
                return apis[mainCapsule.capsuleSourceLineRef].consumer.getConfig()
            })

            // config was built using self['#@...structs/Capsule'] without depends
            expect(result.ownerCapsule).toBe('mainCapsuleNoDeps')
            expect(result.moduleFilepath).toContain('depends.test')
        })

        it('Dynamic depends: static analyzer auto-detects self references in options() and injects depends', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            const connectionLib = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        ConnectionFactory: {
                            type: CapsulePropertyTypes.Literal,
                            value: {
                                fromJSON: (json: any) => ({ type: 'connection', ...json })
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'connectionLib',
            })

            const configConsumer = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        }
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'configConsumer',
            })

            // Same options function using { self } but NO explicit depends declaration
            // The static analyzer should detect self.connLib and auto-inject depends: ['connLib']
            const mainCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        connLib: {
                            type: CapsulePropertyTypes.Mapping,
                            value: connectionLib,
                        },
                        consumer: {
                            type: CapsulePropertyTypes.Mapping,
                            value: configConsumer,
                            options: function ({ self }: any) {
                                return {
                                    '#': {
                                        config: self.connLib.ConnectionFactory.fromJSON({
                                            url: 'http://localhost:9090',
                                        })
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'mainCapsuleDynamic',
                ambientReferences: { connectionLib, configConsumer }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }) => {
                return apis[mainCapsule.capsuleSourceLineRef].consumer.getConfig()
            })

            expect(result).toEqual({
                type: 'connection',
                url: 'http://localhost:9090',
            })
        })
    })
}
