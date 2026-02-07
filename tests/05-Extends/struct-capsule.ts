export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                schemaValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                getSchema: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): any {
                        return this.schemaValue
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/structCapsule'
    })
}
capsule['#'] = '@test/structCapsule'
