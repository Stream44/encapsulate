export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                configKey: {
                    type: CapsulePropertyTypes.String,
                    value: 'config'
                },
                getConfig: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, key: string): string {
                        return this.get(`${this.configKey}:${key}`)
                    }
                }
            }
        }
    }, {
        extendsCapsule: './Storage',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/ConfigStore'
