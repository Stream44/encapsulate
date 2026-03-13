
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                // The parent capsule's full CST (source, spineContracts, ambient references, etc.)
                parentCapsuleCst: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // The parent capsule's capsuleSourceLineRef
                parentCapsuleSourceLineRef: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // Package prefix for projected capsule imports (e.g. '~caps')
                capsuleModuleProjectionPackage: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // Store for writing projected files
                projectionStore: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // All capsule snapshots for dependency resolution
                capsuleSnapshots: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // The property contract delegate alias (e.g. '/apps/web/src/components/Counter1.tsx')
                projectionPath: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                // Spine contract URI
                spineContractUri: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/structs/CapsuleProjectionContext'
