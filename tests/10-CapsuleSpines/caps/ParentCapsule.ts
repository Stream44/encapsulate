export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                parentLabel: {
                    type: CapsulePropertyTypes.String,
                    value: 'parent'
                },
                parentInfo: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `parent:${this.parentLabel}`
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
capsule['#'] = '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/ParentCapsule'
