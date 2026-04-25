
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                sibling: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../cross-package-sibling/sibling-capsule'
                },
                run: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return this.sibling.greet()
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
capsule['#'] = '@test/cross-package-consumer/root-capsule'
