
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"


it('Runtime mapping should expose mapped capsule API correctly', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Outer capsule - maps to middle-capsule.ts which maps to inner-capsule.ts
    const outerCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule.v0': {},
            '#': {
                domains: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './middle-capsule'
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'outerCapsule',
    })

    // Freeze and run
    const { run } = await hoistSnapshot({
        snapshot: await freeze()
    })

    const result = await run({}, async ({ apis }) => {
        const api = apis[outerCapsule.capsuleSourceLineRef]

        // api.domains should expose middleCapsule's API (list, getInfo)
        // NOT innerCapsule's API (call)
        return {
            hasDomains: 'domains' in api,
            domainsList: typeof api.domains?.list,
            domainsGetInfo: typeof api.domains?.getInfo,
            domainsApi: typeof api.domains?.api,
            // These should be functions from middleCapsule
            listResult: api.domains?.list?.(),
            getInfoResult: api.domains?.getInfo?.(),
        }
    })

    expect(result.hasDomains).toBe(true)
    expect(result.domainsList).toBe('function')
    expect(result.domainsGetInfo).toBe('function')
    expect(result.listResult).toBe('middle.list()')
    expect(result.getInfoResult).toBe('middle.getInfo()')
})
