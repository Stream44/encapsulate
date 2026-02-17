import { describe, it, expect, beforeAll } from 'bun:test'
import { SpineRuntime } from '../../src/encapsulate'
import { CapsuleSpineContract } from '../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0'
import { CapsuleSpineFactory } from '../../src/spine-factories/CapsuleSpineFactory.v0'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

describe('Minimal Capsule Projection and Runtime', () => {
    const testOutputDir = join(import.meta.dir, '.~projected')
    const projectedFilePath = join(testOutputDir, 'standalone.ts')

    beforeAll(async () => {
        // Clean up test output directory
        if (existsSync(testOutputDir)) {
            await rm(testOutputDir, { recursive: true })
        }
        await mkdir(testOutputDir, { recursive: true })

        // Ensure node_modules/@caps symlink exists
        const nodeModulesDir = join(import.meta.dir, 'node_modules')
        const capsSymlink = join(nodeModulesDir, '@caps')
        const capsTarget = join(import.meta.dir, '.~o/encapsulate.dev/caps')

        await mkdir(nodeModulesDir, { recursive: true })

        // Remove existing symlink if it exists
        try {
            await rm(capsSymlink, { recursive: true, force: true })
        } catch (e) {
            // Ignore if doesn't exist
        }

        // Create symlink
        const { symlink } = await import('fs/promises')
        await symlink(capsTarget, capsSymlink, 'dir')
    })

    it('should project and run a capsule with encapsulate.dev/standalone property', async () => {
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: import.meta.dir,
            capsuleModuleProjectionRoot: import.meta.dir,
            capsuleModuleProjectionPackage: '@caps',
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const standaloneModule = await import('./standalone')
        const standalone = await standaloneModule.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const solidjsModule = await import('./solidjs-component.tsx')
        const solidjs = await solidjsModule.capsule({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const parent = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    '/.~projected/standalone.ts': {
                        type: CapsulePropertyTypes.Mapping,
                        value: './standalone.ts'
                    },
                    '/.~projected/solidjs-component.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: './solidjs-component.tsx'
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'parent'
        })

        const snapshot = await freeze()

        expect(existsSync(projectedFilePath)).toBe(true)

        const { commonSpineContractOpts, loadCapsule } = await CapsuleSpineFactory({
            spineFilesystemRoot: import.meta.dir,
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const { run } = await SpineRuntime({
            snapshot,
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract(commonSpineContractOpts)
            },
            loadCapsule
        })

        const capturedEvents: any[] = []
        const result = await run({}, async ({ apis }) => {
            const projectedCapsule = await import(projectedFilePath)

            const standaloneResult = await projectedCapsule.default({
                onMembraneEvent: (event: any) => {
                    capturedEvents.push(event)
                }
            })

            return standaloneResult
        })

        expect(result).toBe('Hello from minimal capsule')

        expect(capturedEvents.length).toBeGreaterThan(0)

        const callEvent = capturedEvents.find(e => e.event === 'call')
        expect(callEvent).toBeDefined()
        expect(callEvent?.target?.prop).toBe('encapsulate.dev/standalone')

        const solidjsFilePath = join(testOutputDir, 'solidjs-component.tsx')
        expect(existsSync(solidjsFilePath)).toBe(true)

        const projectedComponent = await import(solidjsFilePath)

        const componentFactory = await projectedComponent.default()

        expect(typeof componentFactory).toBe('function')
    })
})
