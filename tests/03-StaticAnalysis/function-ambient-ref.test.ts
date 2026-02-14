
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

// This function uses an import (readFile) so it has external dependencies
// and cannot be classified as module-local by the static analyzer.
// It must be passed as an ambient reference.
async function loadDataFromFile(filePath: string): Promise<any> {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
}

describe('Function ambient references', () => {

    it('should allow functions with external dependencies as ambient references', async () => {
        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    loadData: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, path: string): Promise<any> {
                            return loadDataFromFile(path)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()
        expect(capsule1.capsuleSourceLineRef).toBeDefined()

        // Verify the function is auto-detected as module-local
        const ambientRefs = (capsule1 as any).cst?.source?.ambientReferences
        expect(ambientRefs).toBeDefined()
        expect(ambientRefs.loadDataFromFile).toBeDefined()
        expect(ambientRefs.loadDataFromFile.type).toBe('module-local')

        // Verify the function's import dependency (readFile) is propagated
        expect(ambientRefs.readFile).toBeDefined()
        expect(ambientRefs.readFile.type).toBe('import')
        expect(ambientRefs.readFile.moduleUri).toBe('fs/promises')

        // Verify it actually works at runtime
        const result = await run({}, async ({ apis }) => {
            return apis[capsule1.capsuleSourceLineRef].loadData(join(import.meta.dir, '../../package.json'))
        })

        expect(result).toBeDefined()
        expect(result.name).toBe('@stream44.studio/encapsulate')
    })

    it('should include module-local function source in moduleLocalCode', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    loadData: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, path: string): Promise<any> {
                            return loadDataFromFile(path)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        // Verify the module-local function is captured in moduleLocalCode
        const cst = capsule1 as any
        const moduleLocalCode = cst.cst?.source?.moduleLocalCode
        expect(moduleLocalCode).toBeDefined()
        expect(moduleLocalCode.loadDataFromFile).toBeDefined()
        expect(moduleLocalCode.loadDataFromFile).toContain('readFile')
    })
})
