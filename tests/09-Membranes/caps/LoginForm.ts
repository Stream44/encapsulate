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
                _email: {
                    type: CapsulePropertyTypes.String,
                    value: '',
                },
                _password: {
                    type: CapsulePropertyTypes.String,
                    value: '',
                },
                setEmail: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, value: string) {
                        this._email = value
                    }
                },
                setPassword: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, value: string) {
                        this._password = value
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
capsule['#'] = '@stream44.studio/encapsulate/tests/09-Membranes/caps/LoginForm'
