
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


it('importCapsule dynamically loads and initializes a capsule by URI', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<string> {

                        // Dynamically import a capsule by URI - not pre-declared as a Mapping
                        const { capsule, api } = await this.self.importCapsule({
                            uri: './imported-capsule'
                        })

                        // Use the dynamically loaded capsule's API
                        const result = await api.validateSource({
                            sourceDir: '/some/path',
                            config: { license: 'MIT' }
                        })

                        return result
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule',
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        return apis[parentCapsule.capsuleSourceLineRef].run()
    })

    expect(result).toBe('validated:/some/path:{"license":"MIT"}')
})


it('importCapsule does not map the imported capsule onto the parent API', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {

                        const { api } = await this.self.importCapsule({
                            uri: './imported-capsule'
                        })

                        return {
                            // The imported capsule should NOT be accessible on this
                            hasImportedOnSelf: typeof this.validateSource !== 'undefined',
                            // But should be accessible via the returned api
                            hasValidateOnApi: typeof api.validateSource === 'function'
                        }
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule2',
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        return apis[parentCapsule.capsuleSourceLineRef].run()
    })

    expect(result.hasImportedOnSelf).toBe(false)
    expect(result.hasValidateOnApi).toBe(true)
})


it('importCapsule passes options to the imported capsule', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const parentCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {

                        const { api } = await this.self.importCapsule({
                            uri: './imported-capsule',
                            options: {
                                '#': {
                                    config: { key: 'injected-value' }
                                }
                            }
                        })

                        return {
                            config: api.config
                        }
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'parentCapsule3',
    })

    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        return apis[parentCapsule.capsuleSourceLineRef].run()
    })

    expect(result.config).toEqual({ key: 'injected-value' })
})
