
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import * as path from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

describe('Web API globals in capsule property functions', () => {

    it('should allow AbortSignal as a module-global builtin', async () => {
        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    fetchWithTimeout: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, url: string, timeoutMs: number): Promise<boolean> {
                            try {
                                await fetch(url, {
                                    signal: AbortSignal.timeout(timeoutMs)
                                })
                                return true
                            } catch {
                                return false
                            }
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        // Verify AbortSignal is recorded as module-global in the property's ambient references
        const cst = (capsule1 as any).cst
        const propDef = cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'].properties['#'].properties.fetchWithTimeout
        expect(propDef.ambientReferences).toBeDefined()
        expect(propDef.ambientReferences.AbortSignal).toBeDefined()
        expect(propDef.ambientReferences.AbortSignal.type).toBe('module-global')

        // Verify it works at runtime
        const result = await run({}, async ({ apis }) => {
            return apis[capsule1.capsuleSourceLineRef].fetchWithTimeout('http://0.0.0.0:1', 100)
        })
        expect(result).toBe(false)
    })

    it('should allow ReadableStream as a module-global builtin', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    makeStream: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): any {
                            return new ReadableStream({
                                start(controller) {
                                    controller.enqueue('hello')
                                    controller.close()
                                }
                            })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        const cst = (capsule1 as any).cst
        const propDef = cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'].properties['#'].properties.makeStream
        expect(propDef.ambientReferences).toBeDefined()
        expect(propDef.ambientReferences.ReadableStream).toBeDefined()
        expect(propDef.ambientReferences.ReadableStream.type).toBe('module-global')
    })

    it('should allow module-level imports used directly in property functions', async () => {
        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    joinPaths: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, a: string, b: string): string {
                            return path.join(a, b)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        // Verify path is recorded as an import ambient reference
        const ambientRefs = (capsule1 as any).cst?.source?.ambientReferences
        expect(ambientRefs).toBeDefined()
        expect(ambientRefs.path).toBeDefined()
        expect(ambientRefs.path.type).toBe('import')
        expect(ambientRefs.path.moduleUri).toBe('path')

        // Verify it works at runtime
        const result = await run({}, async ({ apis }) => {
            return apis[capsule1.capsuleSourceLineRef].joinPaths('/foo', 'bar')
        })
        expect(result).toBe('/foo/bar')
    })
})
