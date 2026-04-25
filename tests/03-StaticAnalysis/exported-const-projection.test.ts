
import { describe, it, expect } from 'bun:test'
import { CapsuleSpineFactory } from '../../src/spine-factories/CapsuleSpineFactory'
import { CapsuleSpineContract } from '../../src/spine-contracts/CapsuleSpineContract.v0/Static'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

describe('Exported const projection', () => {

    const spineRoot = join(import.meta.dir, '../../../../..')

    it('should preserve export keyword on module-local const in projected caps file', async () => {
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: spineRoot,
            capsuleModuleProjectionRoot: spineRoot,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const { capsule: testCapsuleFn } = await import('./exported-const.cap.js')
        const capsule = await testCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('MODEL_NAME')
        expect((capsule as any).cst.source.moduleLocalCode.MODEL_NAME).toStartWith('export ')

        await freeze()

        const capsFilePath = join(spineRoot, '.~o/encapsulate.dev/caps/test/exported-const-capsule.ts')

        expect(existsSync(capsFilePath)).toBe(true)

        const capsContent = await readFile(capsFilePath, 'utf-8')

        expect(capsContent).toContain('export const MODEL_NAME')
    })

    it('should rewrite relative import paths in projected caps file to resolve back to source directory', async () => {
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: spineRoot,
            capsuleModuleProjectionRoot: spineRoot,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const { capsule: testCapsuleFn } = await import('./relative-import.cap.js')
        const capsule = await testCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // Verify SHARED_NAME is tracked as an import ambient reference
        const ambientRefs = (capsule as any).cst.source.ambientReferences
        expect(ambientRefs.SHARED_NAME).toBeDefined()
        expect(ambientRefs.SHARED_NAME.type).toBe('import')
        expect(ambientRefs.SHARED_NAME.moduleUri).toBe('./helpers/shared-const')

        await freeze()

        const capsFilePath = join(spineRoot, '.~o/encapsulate.dev/caps/test/shared-const-value.ts')

        expect(existsSync(capsFilePath)).toBe(true)

        const capsContent = await readFile(capsFilePath, 'utf-8')

        // The import path must NOT be the original './helpers/shared-const'
        // because the caps file is in a different directory. It should be
        // rewritten to a path that resolves from the caps dir back to the
        // original source's helpers/shared-const.
        expect(capsContent).not.toContain("from './helpers/shared-const'")
        // It should contain a rewritten relative path that traverses back
        expect(capsContent).toContain('shared-const')
        expect(capsContent).toContain('SHARED_NAME')
    })
})
