
import { describe, it, expect } from 'bun:test'
import * as path from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

describe('Destructured import alias in function body', () => {

    it('should not treat property names in destructured import aliases as ambient references', async () => {
        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: path.join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // This pattern: const { encryptString: encryptFn } = await import('../lib/crypto.js')
        // The static analyzer should recognize 'encryptString' as a property name in the
        // destructuring binding pattern, NOT as an ambient reference. Only 'encryptFn' is
        // the local variable binding.
        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    doWork: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, input: string): Promise<string> {
                            const { join: joinPath } = await import('path')
                            return joinPath('/tmp', input)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        // Verify 'join' is NOT in ambient references (it's a destructuring property name, not a reference)
        const ambientRefs = (capsule1 as any).cst?.source?.ambientReferences
        expect(ambientRefs?.join).toBeUndefined()

        // Verify it works at runtime
        const result = await run({}, async ({ apis }) => {
            return apis[capsule1.capsuleSourceLineRef].doWork('foo.txt')
        })

        expect(result).toBe('/tmp/foo.txt')
    })

    it('should handle multiple destructured aliases in a single binding pattern', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: path.join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    doWork: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any): Promise<string> {
                            const { join: joinPath, resolve: resolvePath } = await import('path')
                            return resolvePath(joinPath('/tmp', 'test'))
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        const ambientRefs = (capsule1 as any).cst?.source?.ambientReferences
        // Neither 'join' nor 'resolve' should appear as ambient references
        expect(ambientRefs?.join).toBeUndefined()
        expect(ambientRefs?.resolve).toBeUndefined()
    })
})
