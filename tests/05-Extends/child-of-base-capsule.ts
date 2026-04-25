export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                childProperty: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'child-value'
                },
                childFunction: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Child: ${this.baseProperty} + ${this.childProperty}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/child-of-base-capsule',
        extendsCapsule: './base-capsule',
    })
}
capsule['#'] = '@test/child-of-base-capsule'
