
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                sourceDir: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                config: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                validateSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { sourceDir, config }: { sourceDir: string, config: any }): Promise<string> {
                        return `validated:${sourceDir}:${JSON.stringify(config)}`
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
capsule['#'] = '@test/imported-capsule'
