
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                _internalId: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                realm: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                group: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'Admin'
                },
                username: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                hello: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {

                        return `[${this.realm}] Hello (capsule2): ${this.username}`
                    }
                },
                helloGetter1: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {

                        return `[${this.realm}] Hello (capsule2): ${this.username}`
                    }
                },
                helloGetter2: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: async function (this: any): Promise<string> {

                        return `[${this.realm}] Hello (capsule2): ${this.username}`
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
capsule['#'] = 'capsule2'
