
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


it('should recognize outer function parameters in nested getter functions', async function () {

    const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // This pattern is used in capsule files where the outer function parameter
    // is referenced inside a nested getter function. The static analyzer should
    // recognize that 'capsule' is a parameter of the outer function, not an
    // ambient reference that needs to be provided.
    async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
        return encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    schema: {
                        type: CapsulePropertyTypes.Literal,
                        value: {}
                    },
                    config: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function () {
                            // This references 'capsule' from the outer function scope
                            // It should NOT be flagged as an ambient reference
                            return this.getCapsuleConfig(capsule['#'])
                        }
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: capsule['#'],
        })
    }
    capsule['#'] = '@test/outer-scope-parameter.v0'

    // This should not throw an error about 'capsule' being an ambient reference
    const result = await capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

    expect(result).toBeDefined()
    expect(result.capsuleSourceLineRef).toBeDefined()
})
