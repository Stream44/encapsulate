
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                leaf: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './leaf-capsule'
                },
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'sibling'
                },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `${this.name}:${this.leaf.tag()}`
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
capsule['#'] = '@test/cross-package-sibling/sibling-capsule'
