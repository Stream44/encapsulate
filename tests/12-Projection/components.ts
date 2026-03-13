
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack,
    component1,
    component2
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                // component1 has explicit as: path on its projector declaration
                Component1: {
                    type: CapsulePropertyTypes.Mapping,
                    value: component1
                },
                // component2 has no as: — the property name here becomes the projection path
                '/.~projected/Component2.ts': {
                    type: CapsulePropertyTypes.Mapping,
                    value: component2
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'components',
        ambientReferences: {
            component1,
            component2,
        }
    })
}
capsule['#'] = 'components'
