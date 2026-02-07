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
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'CapsuleB'
                },
                CapsuleA: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './circular-capsuleA'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/circularB',
    })
}
capsule['#'] = '@test/circularB'
