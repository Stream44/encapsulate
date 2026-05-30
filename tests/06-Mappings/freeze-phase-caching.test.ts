
import { it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


it('freeze-phase makeInstance shares cache with bare makeInstance (freezePhase must not be in cache key)', async function () {

    // When freeze() calls makeInstance({ freezePhase: true }), the resulting
    // instance must be reusable by a later bare makeInstance() call (same
    // cache key).  If freezePhase leaks into the cache key the two calls
    // produce separate instances, which doubles the number of options-callback
    // invocations and changes the instance tree that downstream consumers
    // (snapshot projection, .sit.json) observe.

    let optionsCallCount = 0

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const child = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                value: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'default'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'freezeCacheChild',
    })

    const parent = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                mapped: {
                    type: CapsulePropertyTypes.Mapping,
                    value: child,
                    options: async () => {
                        optionsCallCount++
                        return {
                            '#': { value: 'from-options' }
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'freezeCacheParent',
        ambientReferences: { child }
    })

    // freeze() internally calls parent.makeInstance({ freezePhase: true })
    await freeze()

    // The freeze-phase call skips the function options callback, but the
    // instance is cached.  Record how many times the callback fired so far.
    const callsAfterFreeze = optionsCallCount

    // A bare makeInstance() — used by wrappedFreeze for .sit.json — must
    // hit the same cache entry (freezePhase is NOT part of the key).
    const instance = await parent.makeInstance()

    // If the cache was shared, optionsCallCount stays the same (no new
    // callback invocation).  If freezePhase polluted the cache key, a
    // fresh instance is created and the callback fires again.
    expect(optionsCallCount).toBe(callsAfterFreeze)

    // Sanity: the returned instance is usable
    expect(instance).toBeDefined()
    expect(instance.api).toBeDefined()
})
