
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
            '#': {
                capsuleName: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'parent-default'
                },
                sharedValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'shared-from-parent'
                },
                getCapsuleName: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return this.capsuleName
                    }
                },
                getConfigForCapsule: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        // This simulates capsuleConfig getter that uses this.capsuleName
                        return `config-for-${this.capsuleName}`
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
capsule['#'] = '@test/08-PropertyStructs/caps/ParentConfig.v0'
