import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

// Import the capsule that has circular dependency
import { capsule as capsuleAModule } from './circular-capsuleA'

it('Handle circular dependencies during freeze phase', async function () {

    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        },
    })

    // Import capsuleA which has a mapping to capsuleB, which maps back to capsuleA
    const capsuleA = await capsuleAModule({ encapsulate, CapsulePropertyTypes, makeImportStack })

    console.log('CapsuleA encapsulated, now freezing...')

    // This should not hang - the freeze should handle the circular reference
    const snapshot = await freeze()

    console.log('Freeze complete!')
    // console.log('Snapshot:', JSON.stringify(snapshot, null, 2))

    expect(snapshot).toBeDefined()
    expect(snapshot.capsules).toBeDefined()
})
