
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"
import { CapsuleSpineContract as StaticCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


for (const { label, Contract } of [
    { label: 'Static', Contract: StaticCapsuleSpineContract },
    { label: 'Membrane', Contract: CapsuleSpineContract },
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

        it('moduleFilepath in options({ self }) is stable across freeze/run and points to source file', async function () {

            const spineRoot = join(import.meta.dir, '../../../../..')

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: spineRoot,
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule that receives and exposes a config
            const pathReceiver = await encapsulate({
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
                capsuleName: 'pathReceiver',
            })

            // Main capsule uses options({ self }) to capture moduleFilepath
            const pathCapture = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        receiver: {
                            type: CapsulePropertyTypes.Mapping,
                            value: pathReceiver,
                            options: function ({ self }: any) {
                                const capsuleStruct = self['#@stream44.studio/encapsulate/structs/Capsule']
                                return {
                                    '#': {
                                        config: {
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
                capsuleName: 'pathCapture',
                ambientReferences: { pathReceiver }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[pathCapture.capsuleSourceLineRef].receiver.getConfig()
            })

            // moduleFilepath must always be the original source path, not a projected path
            // Check it ends with the expected relative path (works in both native and Linux VM environments)
            expect(result.moduleFilepath).toEndWith('tests/06-Mappings/depends.test.ts')
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

        it('Constant values from mapped capsule are available in options({ constants })', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule with a Constant property
            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        mode: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'production',
                        },
                        port: {
                            type: CapsulePropertyTypes.Literal,
                            value: 3000,
                        },
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'constantsChild',
            })

            // Parent maps child and uses constants.mode (Constant type) in options
            const parentCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        child: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: function ({ constants }: any) {
                                return {
                                    '#': {
                                        config: {
                                            mode: constants.mode,
                                            port: constants.port,
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
                capsuleName: 'constantsParent',
                ambientReferences: { childCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[parentCapsule.capsuleSourceLineRef].child.getConfig()
            })

            // constants should include both Literal (port) and Constant (mode) values
            expect(result).toEqual({
                mode: 'production',
                port: 3000,
            })
        })

        it('Constant properties on self are available before Mapping options run', async function () {

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
                capsuleName: 'selfConstantConsumer',
            })

            // Main capsule has a Constant and a Mapping that reads it via self
            const mainCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        appMode: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'staging',
                        },
                        consumer: {
                            type: CapsulePropertyTypes.Mapping,
                            value: configConsumer,
                            depends: ['appMode'],
                            options: function ({ self }: any) {
                                return {
                                    '#': {
                                        config: { mode: self.appMode }
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'selfConstantMain',
                ambientReferences: { configConsumer }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[mainCapsule.capsuleSourceLineRef].consumer.getConfig()
            })

            expect(result).toEqual({ mode: 'staging' })
        })

        it('ConstantGetterFunction values from mapped capsule are available in options({ constants })', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule with a ConstantGetterFunction
            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        prefix: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'env',
                        },
                        label: {
                            type: CapsulePropertyTypes.ConstantGetterFunction,
                            value: function ({ constants }: any): string {
                                return `${constants.prefix}:computed`
                            }
                        },
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'cgetterConstantsChild',
            })

            // Parent maps child and accesses constants.label (ConstantGetterFunction)
            const parentCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        child: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: function ({ constants }: any) {
                                return {
                                    '#': {
                                        config: {
                                            prefix: constants.prefix,
                                            label: constants.label,
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
                capsuleName: 'cgetterConstantsParent',
                ambientReferences: { childCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[parentCapsule.capsuleSourceLineRef].child.getConfig()
            })

            expect(result).toEqual({
                prefix: 'env',
                label: 'env:computed',
            })
        })

        it('ConstantGetterFunction in extractConstants receives capsule metadata with rootCapsule', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A capsule whose ConstantGetterFunction accesses rootCapsule metadata.
            // At extraction time (in the parent's options callback), rootCapsule
            // should point to the top-level spine capsule, not to the child itself.
            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        derivedFromRoot: {
                            type: CapsulePropertyTypes.ConstantGetterFunction,
                            value: function ({ constants }: any): string {
                                const meta = constants['#@stream44.studio/encapsulate/structs/Capsule']
                                return `root:${meta.rootCapsule.capsuleName}|self:${meta.capsuleName}`
                            }
                        },
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'rootMetaChild',
            })

            // Parent uses constants.derivedFromRoot — the ConstantGetterFunction
            // should have had access to rootCapsule during extractConstants.
            const parentCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        child: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: function ({ constants }: any) {
                                return {
                                    '#': {
                                        config: { derived: constants.derivedFromRoot }
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'rootMetaParent',
                ambientReferences: { childCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[parentCapsule.capsuleSourceLineRef].child.getConfig()
            })

            // derivedFromRoot should show rootMetaParent as root (the top-level
            // capsule) and rootMetaChild as self (the mapped capsule)
            expect(result).toEqual({
                derived: 'root:rootMetaParent|self:rootMetaChild'
            })
        })

        it('Mapping properties in extractConstants are resolved to nested constants', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
            })

            // A "lib" capsule exposing only Constants
            const libCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        greet: {
                            type: CapsulePropertyTypes.Constant,
                            value: (name: string) => `hello ${name}`,
                        },
                        version: {
                            type: CapsulePropertyTypes.Constant,
                            value: 42,
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'nestedLib',
            })

            // A capsule that maps the lib and has a ConstantGetterFunction
            // that uses constants.lib.greet (from the mapped capsule)
            const childCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        lib: {
                            type: CapsulePropertyTypes.Mapping,
                            value: libCapsule,
                        },
                        greeting: {
                            type: CapsulePropertyTypes.ConstantGetterFunction,
                            value: function ({ constants }: any): string {
                                return constants.lib.greet('world')
                            }
                        },
                        config: {
                            type: CapsulePropertyTypes.Literal,
                            value: undefined,
                        },
                        getConfig: {
                            type: CapsulePropertyTypes.Function,
                            value: function (this: any) {
                                return this.config
                            }
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'nestedMappingChild',
                ambientReferences: { libCapsule }
            })

            // Parent maps child and accesses constants.greeting (which used
            // constants.lib.greet from the nested Mapping)
            const parentCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        child: {
                            type: CapsulePropertyTypes.Mapping,
                            value: childCapsule,
                            options: function ({ constants }: any) {
                                return {
                                    '#': {
                                        config: {
                                            greeting: constants.greeting,
                                            version: constants.lib.version,
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
                capsuleName: 'nestedMappingParent',
                ambientReferences: { childCapsule }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[parentCapsule.capsuleSourceLineRef].child.getConfig()
            })

            expect(result).toEqual({
                greeting: 'hello world',
                version: 42,
            })
        })

        it('ConstantGetterFunction values on self are available to subsequent Mapping options', async function () {

            const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
                spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
                capsuleModuleProjectionRoot: import.meta.dir,
                spineContracts: {
                    ['#' + Contract['#']]: Contract
                }
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
                capsuleName: 'cgetterConsumer',
            })

            // Main capsule has a ConstantGetterFunction that computes from
            // Capsule metadata (always available) and a Constant (also early).
            // A subsequent Mapping reads the computed value via self.
            const mainCapsule = await encapsulate({
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                    '#': {
                        prefix: {
                            type: CapsulePropertyTypes.Constant,
                            value: 'app',
                        },
                        computedName: {
                            type: CapsulePropertyTypes.ConstantGetterFunction,
                            value: function ({ constants }: any): string {
                                const capsuleName = constants['#@stream44.studio/encapsulate/structs/Capsule'].capsuleName
                                return `${constants.prefix}:${capsuleName}`
                            }
                        },
                        consumer: {
                            type: CapsulePropertyTypes.Mapping,
                            value: configConsumer,
                            depends: ['computedName'],
                            options: function ({ self }: any) {
                                return {
                                    '#': {
                                        config: { name: self.computedName }
                                    }
                                }
                            },
                        },
                    }
                }
            }, {
                importMeta: import.meta,
                importStack: makeImportStack(),
                capsuleName: 'cgetterMain',
                ambientReferences: { configConsumer }
            })

            const { run } = await hoistSnapshot({
                snapshot: await freeze()
            })

            const result = await run({}, async ({ apis }: any) => {
                return apis[mainCapsule.capsuleSourceLineRef].consumer.getConfig()
            })

            expect(result).toEqual({ name: 'app:cgetterMain' })
        })
    })
}
