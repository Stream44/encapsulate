export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                baseProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'base-value'
                },
                baseFunction: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Base: ${this.baseProperty}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/base-capsule'
    })
}
