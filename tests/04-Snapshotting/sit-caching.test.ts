
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { stat, readFile, rm } from 'node:fs/promises'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"


const spineFilesystemRoot = join(import.meta.dir, '../../../../..')

async function makeFactory() {
    return CapsuleSpineFactory({
        spineFilesystemRoot,
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: { ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract }
    })
}

// Load file-based root capsule into a factory — avoids inline encapsulate() calls
// so the CST cache key stays stable across factory instances
async function loadRootCapsule(factory: any) {
    const mod = await import('./sit-test-root')
    return mod.capsule({
        encapsulate: factory.encapsulate,
        CapsulePropertyTypes: factory.CapsulePropertyTypes,
        makeImportStack: factory.makeImportStack,
    })
}


describe('SIT file caching', () => {

    const sitDir = join(import.meta.dir, '.~o/encapsulate.dev/spine-instances')
    const sitFilePath = join(sitDir, '@test~sit-test-root/root-capsule.sit.json')

    it('skips SIT regeneration when CSTs are unchanged (second freeze)', async () => {

        // First factory — parses capsule files, writes SIT
        const factory1 = await makeFactory()
        await loadRootCapsule(factory1)
        await factory1.freeze()

        const firstMtime = (await stat(sitFilePath)).mtimeMs
        await new Promise(r => setTimeout(r, 50))

        // Second factory — CSTs should be cached on disk (same source files)
        const factory2 = await makeFactory()
        await loadRootCapsule(factory2)

        // Static analyzer should report all cache hits
        expect(factory2.staticAnalyzer?.hasCacheMisses()).toBe(false)

        await factory2.freeze()

        // SIT file mtime should NOT have changed — skip logic worked
        expect((await stat(sitFilePath)).mtimeMs).toBe(firstMtime)
    })

    it('writes SIT even when CSTs cached if SIT file is missing', async () => {

        try { await rm(sitFilePath) } catch {}

        const factory = await makeFactory()
        await loadRootCapsule(factory)
        await factory.freeze()

        const sitData = JSON.parse(await readFile(sitFilePath, 'utf-8'))
        expect(sitData.rootCapsule).toBeDefined()
        expect(sitData.capsules['@test/sit-test-root']).toBeDefined()
        expect(sitData.capsules['@test/sit-test-capsule']).toBeDefined()
    })

    it('SIT contains correct instance tree structure', async () => {

        const factory = await makeFactory()
        await loadRootCapsule(factory)
        await factory.freeze()

        const sitData = JSON.parse(await readFile(sitFilePath, 'utf-8'))

        expect(sitData.rootCapsule.capsuleSourceUriLineRef).toContain('sit-test-root')
        expect(sitData.rootCapsule.capsuleSourceUriLineRefInstanceId).toBeDefined()
        expect(Object.keys(sitData.capsuleInstances).length).toBeGreaterThan(1)

        const instanceNames = Object.values(sitData.capsuleInstances).map((i: any) => i.capsuleName)
        expect(instanceNames).toContain('@test/sit-test-root')
        expect(instanceNames).toContain('@test/sit-test-capsule')
    })

    it('compare-before-write: identical content does not rewrite file', async () => {

        const factory = await makeFactory()
        await loadRootCapsule(factory)
        await factory.freeze()

        const mtime1 = (await stat(sitFilePath)).mtimeMs
        await new Promise(r => setTimeout(r, 50))

        // Freeze again — CSTs may have been parsed (cache miss for this factory's
        // analyzer instance), but the SIT content is identical so compare-before-write
        // should skip the disk write
        await factory.freeze()

        expect((await stat(sitFilePath)).mtimeMs).toBe(mtime1)
    })
})
