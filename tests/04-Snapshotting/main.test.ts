
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"

import { SpineRuntime } from "../../src/encapsulate"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


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
                '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
                '#': {
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
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {

                            return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                        }
                    },
                    helloGetter1: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {

                            return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
                        }
                    },
                    helloGetter2: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<string> {

                            return `[${prefix}][${this.realm}] Hello (capsule1): ${this.username}`
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
                '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
                '#': {
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
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {

                            const mappedCapsuleResponse = this.mappedCapsule.hello()

                            return `[${prefix}] Hello (capsule2): ${this.username} [mappedCapsule.hello: ${mappedCapsuleResponse}]`
                        }
                    },
                    helloGetter1: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {

                            return `[${prefix}] Hello (capsule2): ${this.username}`
                        }
                    },
                    helloGetter2: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<string> {

                            return `[${prefix}] Hello (capsule2): ${this.username}`
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
            '[capsule][global] Hello (capsule1): World',
            '[capsule][global] Hello (capsule1): World',
            '[capsule][global] Hello (capsule1): World',
            '[capsule] Hello (capsule2): Sun [mappedCapsule.hello: [capsule][realm:Admin] Hello (capsule1): World]',
            '[capsule] Hello (capsule2): Sun',
            '[capsule] Hello (capsule2): Sun',
            '[capsule][realm:Admin] Hello (capsule1): World',
            '[capsule][realm:Admin] Hello (capsule1): World',
            '[capsule][realm:Admin] Hello (capsule1): World'
        ])
    })

})
