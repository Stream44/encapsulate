/**
 * Test column capsule — declares struct dependency on TestSchema with literal options
 * including a parentColumn relative reference.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#./TestSchema': {
                options: {
                    '#': {
                        label: 'Column B',
                        parentColumn: './ColumnA',
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/ColumnB'
