
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#': {
                // --------------------------------------------------------
                // _instances — internal store for keyed instances
                // --------------------------------------------------------
                _instances: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function () {
                        return new Map<string, any>();
                    },
                    memoize: true,
                },

                // --------------------------------------------------------
                // _defaults — override in extending structs to provide
                // default config for each new instance
                // --------------------------------------------------------
                _defaults: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function () {
                        return {};
                    },
                    memoize: true,
                },

                // --------------------------------------------------------
                // config — user-provided overrides applied to all instances
                // --------------------------------------------------------
                config: {
                    type: CapsulePropertyTypes.Literal,
                    value: {} as any,
                },

                // --------------------------------------------------------
                // forInstance — get-or-create a config instance by key
                // Pass an object whose keys together form a composite key.
                // Returns a merged config (defaults + factory config + instance overrides).
                // --------------------------------------------------------
                forInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, keyObj: Record<string, any>, instanceConfig?: Record<string, any>) {
                        const serializedKey = JSON.stringify(
                            Object.keys(keyObj).sort().reduce((acc: any, k: string) => {
                                acc[k] = keyObj[k];
                                return acc;
                            }, {} as any)
                        );

                        if (!instanceConfig && this._instances.has(serializedKey)) {
                            return this._instances.get(serializedKey);
                        }

                        const merged = {
                            ...this._defaults,
                            ...this.config,
                            ...keyObj,
                            ...(instanceConfig || {}),
                            ...(this._instances.get(serializedKey) || {}),
                        };

                        this._instances.set(serializedKey, merged);
                        return merged;
                    },
                },

                // --------------------------------------------------------
                // getInstances — return all tracked instances
                // --------------------------------------------------------
                getInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any) {
                        return Array.from(this._instances.values());
                    },
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/structs/StructFactory'
