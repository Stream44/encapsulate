
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


describe('Enclosing scope variable inlining', () => {

    it('should inline a simple enclosing-scope variable used in encapsulate options', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // This variable is in the enclosing scope (not module-level, not a parameter)
        const appDir = '/tmp/test-app'

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    config: {
                        type: CapsulePropertyTypes.Literal,
                        value: appDir,
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: '@test/enclosing-scope-simple',
        })

        // appDir should be recognized as a module-local variable and tracked
        const ambientRefs = (capsule as any).cst.source.ambientReferences
        expect(ambientRefs.appDir).toBeDefined()
        expect(ambientRefs.appDir.type).toBe('module-local')

        // The module-local code should contain the variable declaration
        const moduleLocalCode = (capsule as any).cst.source.moduleLocalCode
        expect(moduleLocalCode.appDir).toBeDefined()
        expect(moduleLocalCode.appDir).toContain("const appDir = '/tmp/test-app'")
    })

    it('should inline an enclosing-scope variable that uses string concatenation', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const appDir = '/tmp/base/my-app'
        const buildDir = appDir + '/.build'

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    config: {
                        type: CapsulePropertyTypes.Literal,
                        value: buildDir,
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: '@test/enclosing-scope-with-concat',
        })

        const ambientRefs = (capsule as any).cst.source.ambientReferences
        // buildDir should be tracked as module-local
        expect(ambientRefs.buildDir).toBeDefined()
        expect(ambientRefs.buildDir.type).toBe('module-local')

        // The module-local code should contain the variable declaration
        const moduleLocalCode = (capsule as any).cst.source.moduleLocalCode
        expect(moduleLocalCode.buildDir).toBeDefined()
        expect(moduleLocalCode.buildDir).toContain('buildDir')
    })

    it('should inline an enclosing-scope function and its variable dependencies', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const appDir = '/tmp/test-app'

        async function createSampleApp(baseDir: string): Promise<void> {
            await mkdir(baseDir, { recursive: true })
            await writeFile(join(baseDir, 'index.ts'), 'console.log("hello")')
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    setup: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any): Promise<void> {
                            await createSampleApp(appDir)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: '@test/enclosing-scope-function',
        })

        const ambientRefs = (capsule as any).cst.source.ambientReferences
        // createSampleApp should be detected (it's in enclosing scope, treated as module-local)
        expect(ambientRefs.createSampleApp).toBeDefined()
        // appDir should also be detected
        expect(ambientRefs.appDir).toBeDefined()
        expect(ambientRefs.appDir.type).toBe('module-local')
    })

    it('should inline enclosing-scope variable used in encapsulate call expression (not just property values)', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const appDir = '/tmp/test-inline'

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    path: {
                        type: CapsulePropertyTypes.Literal,
                        value: appDir,
                    },
                    buildPath: {
                        type: CapsulePropertyTypes.Literal,
                        value: join(appDir, '.build'),
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: '@test/enclosing-scope-call-expr',
        })

        const ambientRefs = (capsule as any).cst.source.ambientReferences
        expect(ambientRefs.appDir).toBeDefined()
        expect(ambientRefs.appDir.type).toBe('module-local')
        expect(ambientRefs.join).toBeDefined()
        expect(ambientRefs.join.type).toBe('import')
    })
})
