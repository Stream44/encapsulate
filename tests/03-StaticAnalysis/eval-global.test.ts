
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"

describe('eval global builtin in capsule property functions', () => {

    it('should allow eval as a module-global builtin', async () => {
        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    evalExpression: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, expression: string): any {
                            return eval(expression)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
        })

        expect(capsule1).toBeDefined()

        // Verify eval is recorded as module-global in the property's ambient references
        const cst = (capsule1 as any).cst
        const propDef = cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'].propertyContracts['#'].properties.evalExpression
        expect(propDef.ambientReferences).toBeDefined()
        expect(propDef.ambientReferences.eval).toBeDefined()
        expect(propDef.ambientReferences.eval.type).toBe('module-global')

        // Verify it works at runtime
        const result = await run({}, async ({ apis }) => {
            return apis[capsule1.capsuleSourceLineRef].evalExpression('1 + 2')
        })
        expect(result).toBe(3)
    })
})
