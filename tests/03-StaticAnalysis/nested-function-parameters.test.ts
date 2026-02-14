
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


it('should recognize parameters from nested function declarations', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // This pattern tests nested function declarations with parameters
    // The static analyzer should recognize that parameters like 'obj' and 'root'
    // in the nested resolveRefs function are local identifiers, not ambient references
    async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
        return encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    validate: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any, definitionName: string, data: any): Promise<void> {
                            const schema = { $ref: '#/components/schemas/Test' }
                            const openApiSpec = { components: { schemas: { Test: { type: 'object' } } } }
                            
                            // Nested function declaration with parameters
                            function resolveRefs(obj: any, root: any): any {
                                if (typeof obj !== 'object' || obj === null) return obj
                                if (obj.$ref) {
                                    const refPath = obj.$ref.replace(/^#\//, '').split('/')
                                    let resolved = root
                                    for (const part of refPath) {
                                        const decodedPart = part.replace(/~1/g, '/').replace(/~0/g, '~')
                                        resolved = resolved[decodedPart]
                                    }
                                    return resolveRefs(resolved, root)
                                }
                                const result: any = Array.isArray(obj) ? [] : {}
                                for (const key in obj) {
                                    result[key] = resolveRefs(obj[key], root)
                                }
                                return result
                            }

                            const resolvedSchema = resolveRefs(schema, openApiSpec)
                            return resolvedSchema
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: capsule['#'],
        })
    }
    capsule['#'] = '@test/nested-function-parameters.v0'

    // This should not throw an error about 'obj' or 'root' being ambient references
    const result = await capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

    expect(result).toBeDefined()
    expect(result.capsuleSourceLineRef).toBeDefined()
})
