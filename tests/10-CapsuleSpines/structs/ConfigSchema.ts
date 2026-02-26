export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                schemaVersion: {
                    type: CapsulePropertyTypes.String,
                    value: 'v1'
                },
                validateConfig: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, key: string): string {
                        return `validated:${this.getConfig(key)}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: '../caps/ConfigStore',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/tests/10-CapsuleSpines/structs/ConfigSchema'
