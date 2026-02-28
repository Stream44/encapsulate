
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#../structs/StructA.v0': {
                as: '$configA'
            },
            '#../structs/StructB.v0': {
                as: '$configB',
                options: {
                    '#': {
                        testOption: 'testValue'
                    }
                }
            },
            '#': {
                getConfigA: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return this.$configA.getConfigForCapsule
                    }
                },
                getConfigB: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return this.$configB.getConfigForCapsule
                    }
                },
                getCapsuleNameA: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return this.$configA.getCapsuleName
                    }
                },
                getCapsuleNameB: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return this.$configB.getCapsuleName
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
capsule['#'] = '@test/08-PropertyStructs/caps/Consumer.v0'
