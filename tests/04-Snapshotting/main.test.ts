
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"

import { SpineRuntime } from "../../src/encapsulate"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"
import { CapsuleSpineContract as MembraneCapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"


describe('Snapshot construction & execution with capsule projection', async function () {

    const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

    let snapshot: any

    it('Freeze snapshot', async () => {

        // ##################################################
        // # Fixed Declared Structural Definitions -> Versioned Code Snapshots
        // ##################################################
        // The structure of the system is defined in source files and this
        // structure is frozen into exectuable snapshots.

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot,
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const prefix = 'capsule'

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    PREFIX: {
                        type: CapsulePropertyTypes.Constant,
                        value: '[SNAP]'
                    },
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
                    getCapsuleMeta: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            return this['#@stream44.studio/encapsulate/structs/Capsule']
                        }
                    },
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.PREFIX}[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                        }
                    },
                    helloGetter1: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {

                            return `${this.PREFIX}[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                        }
                    },
                    helloGetter2: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<string> {

                            return `${this.PREFIX}[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'capsule1',
            ambientReferences: {
                prefix
            }
        })

        const capsule2 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    PREFIX: {
                        type: CapsulePropertyTypes.Constant,
                        value: '[SNAP2]'
                    },
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
                    getCapsuleMeta: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            return this['#@stream44.studio/encapsulate/structs/Capsule']
                        }
                    },
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            const mappedCapsuleResponse = this.mappedCapsule.hello()

                            return `${this.PREFIX}[${prefix}] Hello (capsule2): ${this.username} [mappedCapsule.hello: ${mappedCapsuleResponse}]`
                        }
                    },
                    helloGetter1: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {

                            return `${this.PREFIX}[${prefix}] Hello (capsule2): ${this.username}`
                        }
                    },
                    helloGetter2: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<string> {

                            return `${this.PREFIX}[${prefix}] Hello (capsule2): ${this.username}`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'capsule2',
            ambientReferences: {
                prefix,
                capsule1
            }
        })

        snapshot = await freeze()
        // console.log('SNAPSHOT', JSON.stringify(snapshot, null, 4))
    })

    it('Load & execute from snapshot', async () => {

        // Simulate persistence
        snapshot = JSON.parse(JSON.stringify(snapshot))

        // ##################################################
        // # Runtime Context with Imperative Binding Code
        // ##################################################
        // Snapshots are loaded into runtimes to load and initialize
        // capsules and establish an execution environment.
        // Capsules in the spine are then invoked to cause
        // work to be done.
        // Snapshots allow spines to run without needing the capsule
        // source code in its original form. Capsules can be loaded
        // as static assets from remote locations.

        const { commonSpineContractOpts, loadCapsule } = await CapsuleSpineFactory({
            spineFilesystemRoot,
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const { run } = await SpineRuntime({
            snapshot,
            spineFilesystemRoot,
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract(commonSpineContractOpts)
            },
            loadCapsule
        })

        // Establish execution context
        const result = await run({
            // SpineRunOptions

            overrides: {
                ['capsule1']: {
                    '#': {
                        realm: 'global',
                        username: 'World'
                    }
                },
                ['capsule2']: {
                    '#': {
                        username: 'Sun'
                    }
                }
            }

        }, async ({ apis }) => {
            // The execution context is passed to the capsules invoked in this callback
            // as long as they run in the same turn of the event loop.

            // Assert capsule metadata for capsule1
            const capsule1Meta = apis['capsule1'].getCapsuleMeta()
            expect(capsule1Meta).toBeDefined()
            expect(capsule1Meta.capsuleName).toBe('capsule1')
            expect(capsule1Meta.capsuleSourceLineRef).toMatch(/\/tests\/04-Snapshotting\/main\.test:\d+$/)
            expect(capsule1Meta.moduleFilepath).toMatch(/\/tests\/04-Snapshotting\/main\.test\.ts$/)
            // capsule1 has no extends, so it is its own root
            // Note: paths may be relative when loaded from snapshot without spineFilesystemRoot
            expect(capsule1Meta.rootCapsule.capsuleName).toBe('capsule1')
            expect(capsule1Meta.rootCapsule.capsuleSourceLineRef).toMatch(/\/tests\/04-Snapshotting\/main\.test:\d+$/)
            expect(capsule1Meta.rootCapsule.moduleFilepath).toMatch(/\/tests\/04-Snapshotting\/main\.test\.ts$/)

            // Assert capsule metadata for capsule2
            const capsule2Meta = apis['capsule2'].getCapsuleMeta()
            expect(capsule2Meta).toBeDefined()
            expect(capsule2Meta.capsuleName).toBe('capsule2')
            expect(capsule2Meta.capsuleSourceLineRef).toMatch(/\/tests\/04-Snapshotting\/main\.test:\d+$/)
            expect(capsule2Meta.moduleFilepath).toMatch(/\/tests\/04-Snapshotting\/main\.test\.ts$/)
            // capsule2 has no extends, so it is its own root
            // Note: paths may be relative when loaded from snapshot without spineFilesystemRoot
            expect(capsule2Meta.rootCapsule.capsuleName).toBe('capsule2')
            expect(capsule2Meta.rootCapsule.capsuleSourceLineRef).toMatch(/\/tests\/04-Snapshotting\/main\.test:\d+$/)
            expect(capsule2Meta.rootCapsule.moduleFilepath).toMatch(/\/tests\/04-Snapshotting\/main\.test\.ts$/)

            // Assert that capsule2's mapped capsule (capsule1) has correct root metadata
            const mappedCapsuleMeta = apis['capsule2'].mappedCapsule.getCapsuleMeta()
            expect(mappedCapsuleMeta).toBeDefined()
            expect(mappedCapsuleMeta.capsuleName).toBe('capsule1')
            // The mapped capsule should see capsule2 as its root (capsule2 initiated the mapping)
            // Note: paths may be relative when loaded from snapshot without spineFilesystemRoot
            expect(mappedCapsuleMeta.rootCapsule.capsuleName).toBe('capsule2')
            expect(mappedCapsuleMeta.rootCapsule.capsuleSourceLineRef).toMatch(/\/tests\/04-Snapshotting\/main\.test:\d+$/)
            expect(mappedCapsuleMeta.rootCapsule.moduleFilepath).toMatch(/\/tests\/04-Snapshotting\/main\.test\.ts$/)

            // Run Capsule DAG on Spine
            return Promise.all([
                apis['capsule1'].hello(),
                apis['capsule1'].helloGetter1,
                apis['capsule1'].helloGetter2,
                apis['capsule2'].hello(),
                apis['capsule2'].helloGetter1,
                apis['capsule2'].helloGetter2,
                apis['capsule2'].mappedCapsule.hello(),
                apis['capsule2'].mappedCapsule.helloGetter1,
                apis['capsule2'].mappedCapsule.helloGetter2
            ])
        })

        expect(result as any).toEqual([
            '[SNAP][capsule][global] Hello (capsule1): World',
            '[SNAP][capsule][global] Hello (capsule1): World',
            '[SNAP][capsule][global] Hello (capsule1): World',
            '[SNAP2][capsule] Hello (capsule2): Sun [mappedCapsule.hello: [SNAP][capsule][realm:Admin] Hello (capsule1): World]',
            '[SNAP2][capsule] Hello (capsule2): Sun',
            '[SNAP2][capsule] Hello (capsule2): Sun',
            '[SNAP][capsule][realm:Admin] Hello (capsule1): World',
            '[SNAP][capsule][realm:Admin] Hello (capsule1): World',
            '[SNAP][capsule][realm:Admin] Hello (capsule1): World'
        ])
    })

})


describe('Capsule metadata struct with Membrane spine contract', async function () {

    const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

    it('Capsule metadata should be accessible via this["#@stream44.studio/encapsulate/structs/Capsule"]', async () => {

        const { encapsulate, CapsulePropertyTypes, makeImportStack, commonSpineContractOpts } = await CapsuleSpineFactory({
            spineFilesystemRoot,
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + MembraneCapsuleSpineContract['#']]: MembraneCapsuleSpineContract
            }
        })

        const prefix = 'membrane'

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    PREFIX: {
                        type: CapsulePropertyTypes.Constant,
                        value: '[MEM]'
                    },
                    realm: {
                        type: CapsulePropertyTypes.Literal,
                        value: 'global'
                    },
                    username: {
                        type: CapsulePropertyTypes.String,
                        value: 'TestUser'
                    },
                    getCapsuleMeta: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            return this['#@stream44.studio/encapsulate/structs/Capsule']
                        }
                    },
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `${this.PREFIX}[${prefix}][${this.realm}] Hello: ${this.username}`
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'membraneCapsule1',
            ambientReferences: {
                prefix
            }
        })

        const { run } = await SpineRuntime({
            spineFilesystemRoot,
            capsules: {
                'membraneCapsule1': capsule1
            },
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': MembraneCapsuleSpineContract(commonSpineContractOpts)
            }
        })

        const result = await run({}, async ({ apis }) => {
            // Assert capsule metadata
            const capsuleMeta = apis['membraneCapsule1'].getCapsuleMeta()
            expect(capsuleMeta).toBeDefined()
            expect(capsuleMeta.capsuleName).toBe('membraneCapsule1')
            expect(capsuleMeta.capsuleSourceLineRef).toMatch(/^\/.*\/tests\/04-Snapshotting\/main\.test\.ts:\d+$/)
            expect(capsuleMeta.moduleFilepath).toMatch(/^\/.*\/tests\/04-Snapshotting\/main\.test\.ts$/)

            return apis['membraneCapsule1'].hello()
        })

        expect(result).toBe('[MEM][membrane][global] Hello: TestUser')
    })

})
