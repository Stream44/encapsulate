
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                capsuleName: {
                    type: CapsulePropertyTypes.Literal,
                    value: capsule['#']
                },
                structBOnly: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'only-in-B'
                },
                testOption: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                }
            }
        }
    }, {
        extendsCapsule: '../caps/ParentConfig.v0',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@test/08-PropertyStructs/structs/StructB.v0'
