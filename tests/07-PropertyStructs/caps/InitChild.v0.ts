
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                role: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child'
                },
                childInit: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initOrder = this.initOrder ? this.initOrder + ',child' : 'child'
                    }
                }
            }
        }
    }, {
        extendsCapsule: '../caps/InitParent.v0',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@test/08-PropertyStructs/caps/InitChild.v0'
