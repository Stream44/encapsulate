
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                role: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent'
                },
                initOrder: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                parentInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initOrder = this.initOrder ? this.initOrder + ',parent' : 'parent'
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
capsule['#'] = '@test/08-PropertyStructs/caps/InitParent.v0'
