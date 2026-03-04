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
                loginForm: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './LoginForm',
                },
                login: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, email: string, password: string) {
                        this.loginForm.setEmail(email)
                        this.loginForm.setPassword(password)
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
capsule['#'] = '@stream44.studio/encapsulate/tests/09-Membranes/caps/User'
