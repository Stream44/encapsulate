export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                'solidjs.com/standalone': {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any) {
                        return function Counter() {
                            return (
                                <div class="counter">
                                    <button onClick={() => console.log('clicked')}>
                                        Count: 0
                                    </button>
                                </div>
                            )
                        }
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
capsule['#'] = 'solidjsComponent'
