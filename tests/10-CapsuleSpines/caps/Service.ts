export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                apiKey: {
                    type: CapsulePropertyTypes.String,
                    value: ''
                },
                serviceName: {
                    type: CapsulePropertyTypes.String,
                    value: 'base-service'
                },
                invoke: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, action: string): string {
                        return `[${this.serviceName}] ${action} (key:${this.apiKey})`
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
capsule['#'] = '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/Service'
