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
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                user: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './User',
                },
                runModel: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any) {
                        return this.user.login('user@example.com', 'validPassword123')
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/tests/09-Membranes/caps/Root'
