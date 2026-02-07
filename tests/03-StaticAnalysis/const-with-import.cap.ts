import { join } from 'path'
import { homedir } from 'os'

// Module-level const that uses imports - this pattern should be detected
// and the const + its import dependencies should be included in the CST
const KEYS_DIR = join(homedir(), '.test/keys')

export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
            '#': {
                getKeyPath: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, keyName: string): string {
                        // Uses the module-level const KEYS_DIR
                        return join(KEYS_DIR, `${keyName}.json`)
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
capsule['#'] = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/const-with-import.cap'
