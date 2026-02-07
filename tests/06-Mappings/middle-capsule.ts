
import { CapsulePropertyTypes } from "../../src/encapsulate"

export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
            '#': {
                api: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './inner-capsule'
                },
                list: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return 'middle.list()'
                    }
                },
                getInfo: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return 'middle.getInfo()'
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
capsule['#'] = '@test/middle-capsule'
