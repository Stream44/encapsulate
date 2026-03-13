import { describe, it, expect, beforeAll } from 'bun:test'
import { CapsuleSpineContract } from '../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0'
import { CapsuleSpineFactory } from '../../src/spine-factories/CapsuleSpineFactory.v0'
import { rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

describe('Standalone Projector', () => {
    const testDir = import.meta.dir
    const projectedDir = join(testDir, '.~projected')
    const component1Path = join(projectedDir, 'Component1.ts')
    const component2Path = join(projectedDir, 'Component2.ts')

    let snapshot: any

    beforeAll(async () => {
        // Clean up projected output
        if (existsSync(projectedDir)) {
            await rm(projectedDir, { recursive: true })
        }

        // Set up factory with projection enabled
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: testDir,
            capsuleModuleProjectionRoot: testDir,
            capsuleModuleProjectionPackage: '@caps',
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Load the test projector capsule so the spine can resolve it as a property contract delegate
        const testProjectorModule = await import('./test-projector')
        const testProjector = await testProjectorModule.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // component1: explicit as: path
        const component1Module = await import('./component1')
        const component1 = await component1Module.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // component2: no as: — path comes from caller property name
        const component2Module = await import('./component2')
        const component2 = await component2Module.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // Parent capsule that maps both components
        const componentsModule = await import('./components')
        await componentsModule.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack, component1, component2 })

        snapshot = await freeze()
    })

    it('should project Component1 via explicit as: path', () => {
        expect(existsSync(component1Path)).toBe(true)
    })

    it('should project Component2 via caller property name path', () => {
        expect(existsSync(component2Path)).toBe(true)
    })

    it('projected Component1 should export a working function', async () => {
        const mod = await import(component1Path)
        expect(typeof mod.Greeting).toBe('function')
        expect(mod.Greeting('World')).toBe('Hello, World!')
        expect(mod.default).toBe(mod.Greeting)
    })

    it('projected Component2 should export a working function', async () => {
        const mod = await import(component2Path)
        expect(typeof mod.Farewell).toBe('function')
        expect(mod.Farewell('World')).toBe('Goodbye, World!')
        expect(mod.default).toBe(mod.Farewell)
    })

    it('projected files should contain the expected comment header', async () => {
        const { readFile } = await import('fs/promises')
        const content1 = await readFile(component1Path, 'utf-8')
        const content2 = await readFile(component2Path, 'utf-8')

        expect(content1).toContain('// Projected by test-projector')
        expect(content2).toContain('// Projected by test-projector')
    })

    it('freeze snapshot should be produced', () => {
        expect(snapshot).toBeDefined()
        expect(snapshot.capsules).toBeDefined()
    })

    it('projected files can be imported and called directly', async () => {
        // Import the projected standalone modules
        const comp1 = await import(component1Path)
        const comp2 = await import(component2Path)

        // Call the exported functions
        expect(comp1.Greeting('World')).toBe('Hello, World!')
        expect(comp2.Farewell('World')).toBe('Goodbye, World!')
    })
})
