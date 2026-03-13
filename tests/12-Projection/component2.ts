
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#@stream44.studio/encapsulate/tests/12-Projection/test-projector': {
                options: {
                    '#': {
                        component: function (this: any): Function {
                            return function Farewell(name: string) {
                                return `Goodbye, ${name}!`
                            }
                        }
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'component2',
    })
}
capsule['#'] = 'component2'
