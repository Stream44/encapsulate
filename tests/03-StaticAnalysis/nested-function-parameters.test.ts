
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


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

it('should recognize function declarations used before their definition (hoisting) inside property functions', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // This pattern tests function declarations that are called before they appear in source order.
    // JavaScript hoists function declarations, so this is valid code.
    // The static analyzer must pre-collect all function declarations before checking for ambient refs.
    async function capsule2({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
        return encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    helpers: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any) {
                            // Call functions before their declarations (hoisting)
                            const result = addTimestamps({ name: 'test' })
                            const merged = deepMerge({ a: 1 }, { b: 2 })

                            function addTimestamps(config: any): any {
                                if (!config || typeof config !== 'object') return config
                                config.createdAt = new Date().toISOString()
                                return config
                            }

                            function deepMerge(target: any, source: any): any {
                                const result = { ...target }
                                for (const key in source) {
                                    result[key] = source[key]
                                }
                                return result
                            }

                            return { addTimestamps, deepMerge, result, merged }
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: capsule2['#'],
        })
    }
    capsule2['#'] = '@test/hoisted-function-declarations.v0'

    const capsuleResult = await capsule2({ encapsulate, CapsulePropertyTypes, makeImportStack })
    expect(capsuleResult).toBeDefined()

    // Verify at runtime
    const result = await run({}, async ({ apis }: any) => {
        return apis[capsuleResult.capsuleSourceLineRef].helpers
    })
    expect(result.result.name).toBe('test')
    expect(result.result.createdAt).toBeDefined()
    expect(result.merged).toEqual({ a: 1, b: 2 })
})
