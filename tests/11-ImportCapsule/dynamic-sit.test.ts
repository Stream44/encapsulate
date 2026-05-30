
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


describe('Dynamic SIT files', () => {

    const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

    it('writeDynamicSit captures capsules loaded via importCapsule at runtime', async () => {

        const { encapsulate, freeze, hoistSnapshot, writeDynamicSit, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot,
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
                            const { api } = await this.self.importCapsule({
                                uri: './imported-capsule'
                            })
                            return api.validateSource({ sourceDir: '/test', config: {} })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'dynamicSitParent',
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        // Run triggers the dynamic import
        await run({}, async ({ apis }: any) => {
            await apis[parentCapsule.capsuleSourceLineRef].run()
        })

        // Write the dynamic SIT
        await writeDynamicSit()

        // Verify dynamic SIT file was created with hash in filename
        const sitDir = join(import.meta.dir, '.~o/encapsulate.dev/spine-instances')
        const files = await readdir(sitDir)
        const dynamicSitFiles = files.filter((f: string) => f.startsWith('dynamic-imports.') && f.endsWith('.sit.json'))

        expect(dynamicSitFiles.length).toBeGreaterThan(0)

        // Read and verify the content
        const dynamicSitContent = JSON.parse(await readFile(join(sitDir, dynamicSitFiles[0]), 'utf-8'))
        expect(dynamicSitContent.dynamicCapsules).toBeDefined()

        // The imported capsule should be in the dynamic SIT
        const refs = Object.values(dynamicSitContent.dynamicCapsules) as any[]
        const importedEntry = refs.find((entry: any) =>
            entry.capsuleName === '@test/imported-capsule'
        )
        expect(importedEntry).toBeDefined()
    })

    it('writeDynamicSit is idempotent — same hash means no rewrite', async () => {

        const { encapsulate, freeze, hoistSnapshot, writeDynamicSit, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot,
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
                            const { api } = await this.self.importCapsule({
                                uri: './imported-capsule'
                            })
                            return api.validateSource({ sourceDir: '/test', config: {} })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'dynamicSitIdempotent',
        })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }: any) => {
            await apis[parentCapsule.capsuleSourceLineRef].run()
        })

        // Write dynamic SIT twice — second call should be a no-op
        await writeDynamicSit()
        await writeDynamicSit()

        const sitDir = join(import.meta.dir, '.~o/encapsulate.dev/spine-instances')
        const files = await readdir(sitDir)
        const dynamicSitFiles = files.filter((f: string) => f.startsWith('dynamic-imports.') && f.endsWith('.sit.json'))
        expect(dynamicSitFiles.length).toBeGreaterThanOrEqual(1)
    })

    it('writeDynamicSit does nothing when no dynamic imports occurred', async () => {

        const { encapsulate, freeze, hoistSnapshot, writeDynamicSit, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot,
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    value: {
                        type: CapsulePropertyTypes.Literal,
                        value: 'no-dynamic-imports',
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'noDynamicImports',
        })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }: any) => {
            expect(apis['noDynamicImports'].value).toBe('no-dynamic-imports')
        })

        // writeDynamicSit should be a no-op — no dynamic imports
        await writeDynamicSit()
    })

    it('dynamic imports generate CST/CRT cache files', async () => {

        const { encapsulate, freeze, hoistSnapshot, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot,
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
                            const { api } = await this.self.importCapsule({
                                uri: './imported-capsule'
                            })
                            return api.validateSource({ sourceDir: '/test', config: {} })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'cstCrtVerify',
        })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })

        await run({}, async ({ apis }: any) => {
            await apis[parentCapsule.capsuleSourceLineRef].run()
        })

        // Verify CST/CRT files exist for the dynamically imported capsule
        const cacheDir = join(spineFilesystemRoot, '.~o/encapsulate.dev/static-analysis')
        const cstPath = join(cacheDir, '@stream44.studio/encapsulate/tests/11-ImportCapsule/imported-capsule:29.csts.json')
        const crtPath = join(cacheDir, '@stream44.studio/encapsulate/tests/11-ImportCapsule/imported-capsule:29.crts.json')

        const cstContent = JSON.parse(await readFile(cstPath, 'utf-8'))
        const crtContent = JSON.parse(await readFile(crtPath, 'utf-8'))

        const capsuleRef = Object.keys(cstContent)[0]
        expect(capsuleRef).toContain('imported-capsule')
        expect(cstContent[capsuleRef].source.capsuleName).toBe('@test/imported-capsule')
        expect(crtContent).toBeDefined()
    })
})
