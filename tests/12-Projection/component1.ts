
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#@stream44.studio/encapsulate/tests/12-Projection/test-projector': {
                as: '/.~projected/Component1.ts',
                options: {
                    '#': {
                        component: function (this: any): Function {
                            return function Greeting(name: string) {
                                return `Hello, ${name}!`
                            }
                        }
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'component1',
    })
}
capsule['#'] = 'component1'
