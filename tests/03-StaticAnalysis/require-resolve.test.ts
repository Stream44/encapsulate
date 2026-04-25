
import { describe, it, expect } from 'bun:test'
import { join, dirname } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"

describe('require.resolve in capsule functions', () => {

    it('should not flag require.resolve as an ambient reference', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // This should NOT throw - require is a runtime global like Bun, process, console
        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    findPackage: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, packageName: string): Promise<string> {
                            const pkgPath = dirname(require.resolve(packageName + '/package.json'))
                            return pkgPath
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

        // Verify require is detected as a module-global builtin, not an ambient reference error
        const ambientRefs = (capsule1 as any).cst?.source?.ambientReferences
        expect(ambientRefs).toBeDefined()

        // dirname is an import
        expect(ambientRefs.dirname).toBeDefined()
        expect(ambientRefs.dirname.type).toBe('import')

        // require should be a module-global, not cause an error
        if (ambientRefs.require) {
            expect(ambientRefs.require.type).toBe('module-global')
        }
    })

    it('should not flag Bun.spawn as an ambient reference (existing behavior)', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Bun.spawn should work fine since Bun is already in MODULE_GLOBAL_BUILTINS
        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    runCommand: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, cmd: string[]): Promise<number> {
                            const proc = Bun.spawn(cmd, {
                                stdin: 'inherit',
                                stdout: 'inherit',
                                stderr: 'inherit'
                            })
                            return await proc.exited
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
        expect(ambientRefs).toBeDefined()
        if (ambientRefs.Bun) {
            expect(ambientRefs.Bun.type).toBe('module-global')
        }
    })
})
