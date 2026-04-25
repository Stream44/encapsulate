
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, readdir } from 'fs/promises'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Membrane"


describe('CapsuleSpine Linking Features', () => {

    it('Comprehensive linking test: extendsCapsule, mapping, and struct mapping with extendsCapsule', async function () {

        const membraneEvents: any[] = []

        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            enableCallerStackInference: true,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            },
            onMembraneEvent: (event: any) => membraneEvents.push(event)
        })

        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#./structs/ConfigSchema': {
                    as: 'config',
                },
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'comprehensive-linking'
                    },
                    service1: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service1',
                    },
                    service2: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service2',
                    },
                    serviceApi: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service',
                        options: {
                            '#': {
                                apiKey: 'secret-key'
                            }
                        }
                    },
                    storageApi: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Storage',
                        options: {
                            '#': {
                                prefix: 'app_'
                            }
                        }
                    },
                    parentInfo: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return `child-override:${this.parentLabel}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: './caps/ParentCapsule',
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: '@stream44.studio/encapsulate/tests/10-CapsuleSpines/comprehensiveLinking'
        })

        const { run } = await hoistSnapshot({
            snapshot: await freeze()
        })

        await run({}, async ({ apis }) => {
            const api = apis[spine.capsuleSourceLineRef]

            expect(api.alias).toBe('comprehensive-linking')
            expect(api.parentLabel).toBe('parent')
            expect(api.parentInfo).toBe('child-override:parent')

            expect(api.service1.serviceName).toBe('service-1')
            expect(api.service1.invoke('test')).toBe('[service-1] test (key:)')

            expect(api.service2.serviceName).toBe('service-2')
            expect(api.service2.invoke('action')).toBe('[service-2] action (key:)')

            expect(api.serviceApi.serviceName).toBe('base-service')
            expect(api.serviceApi.apiKey).toBe('secret-key')
            expect(api.serviceApi.invoke('execute')).toBe('[base-service] execute (key:secret-key)')

            expect(api.storageApi.prefix).toBe('app_')
            expect(api.storageApi.get('data')).toBe('app_data')
            expect(api.storageApi.set('key', 'value')).toBe('stored:app_key=value')

            expect(api.config.schemaVersion).toBe('v1')
            expect(api.config.configKey).toBe('config')
            expect(api.config.prefix).toBe('')
            expect(api.config.getConfig('setting')).toBe('config:setting')
            expect(api.config.validateConfig('setting')).toBe('validated:config:setting')
        })


        // Read the .sit.json file
        const rootCapsuleName = '@stream44.studio/encapsulate/tests/10-CapsuleSpines/comprehensiveLinking'
        const dirName = rootCapsuleName.replace(/\//g, '~')
        const sitFilePath = join(
            import.meta.dir,
            '.~o/encapsulate.dev/spine-instances',
            dirName,
            `root-capsule.sit.json`
        )

        const sitContent = JSON.parse(await readFile(sitFilePath, 'utf-8'))

        // Verify rootCapsule
        expect(sitContent.rootCapsule).toBeDefined()
        expect(sitContent.rootCapsule.capsuleSourceUriLineRef).toMatch(/^@stream44\.studio\/encapsulate\/tests\/10-CapsuleSpines\/main\.test:\d+$/)

        // Verify capsules map contains all capsules in the spine
        expect(sitContent.capsules).toBeDefined()

        const expectedCapsules = [
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/comprehensiveLinking',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/Service1',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/Service2',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/Service',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/Storage',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/ParentCapsule',
            '@stream44.studio/encapsulate/structs/Capsule',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/structs/ConfigSchema',
            '@stream44.studio/encapsulate/tests/10-CapsuleSpines/caps/ConfigStore',
        ]

        for (const capsuleName of expectedCapsules) {
            expect(sitContent.capsules[capsuleName]).toBeDefined()
            expect(sitContent.capsules[capsuleName].capsuleSourceUriLineRef).toBeDefined()
            expect(typeof sitContent.capsules[capsuleName].capsuleSourceUriLineRef).toBe('string')
        }

        // Verify specific capsuleSourceUriLineRef values
        expect(sitContent.capsules['@stream44.studio/encapsulate/tests/10-CapsuleSpines/comprehensiveLinking'].capsuleSourceUriLineRef)
            .toMatch(/^@stream44\.studio\/encapsulate\/tests\/10-CapsuleSpines\/main\.test:\d+$/)
        expect(sitContent.capsules['@stream44.studio/encapsulate/structs/Capsule'].capsuleSourceUriLineRef)
            .toBe('@stream44.studio/encapsulate/structs/Capsule:18')

        // Verify rootCapsule has capsuleSourceUriLineRefInstanceId
        expect(sitContent.rootCapsule.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)

        // Verify capsuleInstances
        expect(sitContent.capsuleInstances).toBeDefined()
        const instanceEntries = Object.entries(sitContent.capsuleInstances)

        // Each instance key should be a 64-char hex SHA256 hash
        for (const [instanceId, entry] of instanceEntries) {
            expect(instanceId).toMatch(/^[0-9a-f]{64}$/)
            expect((entry as any).capsuleName).toBeDefined()
            expect((entry as any).capsuleSourceUriLineRef).toBeDefined()
            expect((entry as any).parentCapsuleSourceUriLineRefInstanceId).toBeDefined()
        }

        // Root instance should have empty parentCapsuleSourceUriLineRefInstanceId
        const rootInstanceId = sitContent.rootCapsule.capsuleSourceUriLineRefInstanceId
        expect(sitContent.capsuleInstances[rootInstanceId].parentCapsuleSourceUriLineRefInstanceId).toBe('')

        // Non-root instances should have a non-empty parentCapsuleSourceUriLineRefInstanceId
        for (const [instanceId, entry] of instanceEntries) {
            if (instanceId !== rootInstanceId) {
                expect((entry as any).parentCapsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)
            }
        }

        // All expected capsules should appear as instances
        const instanceCapsuleNames = new Set(instanceEntries.map(([, e]) => (e as any).capsuleName))
        for (const capsuleName of expectedCapsules) {
            expect(instanceCapsuleNames.has(capsuleName)).toBe(true)
        }

        // Instance IDs must be unique
        const instanceIds = instanceEntries.map(([id]) => id)
        expect(new Set(instanceIds).size).toBe(instanceIds.length)

        // Capsules with options (serviceApi, storageApi) should produce separate instances
        // from capsules without options (service1, service2 reuse Service)
        expect(instanceIds.length).toBeGreaterThanOrEqual(expectedCapsules.length)

        // Every capsule instance that declares structs/Capsule should get its own
        // structs/Capsule instance (just like a property contract mapping).
        // The structs/Capsule instance should NOT be shared across parents.
        const structsCapsuleInstances = instanceEntries.filter(
            ([, e]) => (e as any).capsuleName === '@stream44.studio/encapsulate/structs/Capsule'
        )
        // Count non-structs/Capsule instances — each one declares structs/Capsule,
        // so there should be one structs/Capsule instance per parent capsule instance
        const nonStructInstances = instanceEntries.filter(
            ([, e]) => (e as any).capsuleName !== '@stream44.studio/encapsulate/structs/Capsule'
        )
        expect(structsCapsuleInstances.length).toBe(nonStructInstances.length)

        // Each structs/Capsule instance must have a unique parent
        const structsCapsuleParents = structsCapsuleInstances.map(
            ([, e]) => (e as any).parentCapsuleSourceUriLineRefInstanceId
        )
        expect(new Set(structsCapsuleParents).size).toBe(structsCapsuleParents.length)

        // Verify membrane events contain expected properties
        expect(membraneEvents.length).toBeGreaterThan(0)

        // All events (except call-result) should have a caller — either capsule-identified or stack-inferred
        const eventsWithTargetProp = membraneEvents.filter((e: any) => e.event === 'call' || e.event === 'get' || e.event === 'set')
        for (const event of eventsWithTargetProp) {
            expect(event.target).toBeDefined()
            expect(event.target.capsuleSourceLineRef).toBeDefined()
            expect(event.target.spineContractCapsuleInstanceId).toBeDefined()
            expect(event.target.prop).toBeDefined()

            // Every event should have a caller
            expect(event.caller).toBeDefined()
            if (event.caller.capsuleSourceLineRef) {
                // Caller is a known capsule instance
                expect(event.caller.spineContractCapsuleInstanceId).toBeDefined()
                expect(event.caller.capsuleSourceUriLineRefInstanceId).toBeDefined()
                expect(event.caller.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)
                if (event.caller.capsuleSourceNameRef) {
                    expect(event.caller.capsuleSourceNameRefHash).toBeDefined()
                    expect(event.caller.capsuleSourceNameRefHash).toMatch(/^[0-9a-f]{64}$/)
                }
            } else {
                // Caller is stack-inferred (e.g., framework init calls)
                expect(event.caller.fileUri).toBeDefined()
            }
        }

        // Verify call events have target instance IDs and capsuleSourceNameRefHash
        const callEvents = membraneEvents.filter((e: any) => e.event === 'call')
        expect(callEvents.length).toBeGreaterThan(0)
        for (const event of callEvents) {
            expect(event.args).toBeDefined()
            expect(event.target.capsuleSourceUriLineRefInstanceId).toBeDefined()
            expect(event.target.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)
            if (event.target.capsuleSourceNameRef) {
                expect(event.target.capsuleSourceNameRefHash).toMatch(/^[0-9a-f]{64}$/)
            }
        }

        // Verify call-result events
        const resultEvents = membraneEvents.filter((e: any) => e.event === 'call-result')
        expect(resultEvents.length).toBeGreaterThan(0)
        for (const event of resultEvents) {
            expect(event.event).toBe('call-result')
            expect(event.eventIndex).toBeGreaterThanOrEqual(0)
            expect(event.callEventIndex).toBeGreaterThanOrEqual(0)
            expect(event.target).toBeDefined()
            expect(event.target.spineContractCapsuleInstanceId).toBeDefined()
        }

        // Verify internal caller tracking: when a function calls another capsule's function,
        // the caller.prop should reflect the calling function's name
        // ConfigSchema.validateConfig → ConfigStore.getConfig → Storage.get
        const storageGetFromGetConfig = membraneEvents.find((e: any) =>
            e.event === 'call' && e.target.prop === 'get'
            && e.caller?.prop === 'getConfig'
            && e.caller?.capsuleSourceLineRef?.includes('ConfigStore')
        )
        expect(storageGetFromGetConfig).toBeDefined()
        expect(storageGetFromGetConfig.caller.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)

        const configStoreGetConfigFromValidate = membraneEvents.find((e: any) =>
            e.event === 'call' && e.target.prop === 'getConfig'
            && e.caller?.prop === 'validateConfig'
            && e.caller?.capsuleSourceLineRef?.includes('ConfigSchema')
        )
        expect(configStoreGetConfigFromValidate).toBeDefined()
        expect(configStoreGetConfigFromValidate.caller.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)

        // Verify that direct API calls from root capsule (via mapping proxy) have caller without prop
        // since the root capsule's test handler is not a named function property
        const directApiCall = membraneEvents.find((e: any) =>
            e.event === 'call' && e.target.prop === 'invoke'
            && e.caller?.capsuleSourceLineRef?.includes('main.test')
            && !e.caller?.prop
        )
        expect(directApiCall).toBeDefined()
        expect(directApiCall.caller.capsuleSourceUriLineRefInstanceId).toMatch(/^[0-9a-f]{64}$/)
    })

    it('structs/Capsule generates a CST file like any user-declared capsule', async () => {
        const staticAnalysisDir = join(import.meta.dir, '.~o/encapsulate.dev/static-analysis')

        // Find the structs/Capsule CST file — it should exist somewhere under static-analysis
        const findCstFile = async (dir: string): Promise<string | null> => {
            const entries = await readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const full = join(dir, entry.name)
                if (entry.isDirectory()) {
                    const found = await findCstFile(full)
                    if (found) return found
                } else if (entry.name.includes('Capsule') && entry.name.endsWith('.csts.json')) {
                    const content = JSON.parse(await readFile(full, 'utf-8'))
                    const firstKey = Object.keys(content)[0]
                    if (content[firstKey]?.source?.capsuleName === '@stream44.studio/encapsulate/structs/Capsule') {
                        return full
                    }
                }
            }
            return null
        }

        const cstFilePath = await findCstFile(staticAnalysisDir)
        expect(cstFilePath).not.toBeNull()

        // Verify CST content is well-formed
        const cstContent = JSON.parse(await readFile(cstFilePath!, 'utf-8'))
        const cstKey = Object.keys(cstContent)[0]
        const cst = cstContent[cstKey]

        expect(cst.capsuleSourceUriLineRef).toBe('@stream44.studio/encapsulate/structs/Capsule:18')
        expect(cst.source.capsuleName).toBe('@stream44.studio/encapsulate/structs/Capsule')
        expect(cst.source.moduleFilepath).toContain('structs/Capsule.ts')
        expect(cst.spineContracts).toBeDefined()
        expect(cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']).toBeDefined()

        // Verify a corresponding CRT file also exists
        const crtFilePath = cstFilePath!.replace('.csts.json', '.crts.json')
        expect(existsSync(crtFilePath)).toBe(true)
    })

})
