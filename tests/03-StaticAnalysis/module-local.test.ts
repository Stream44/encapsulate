
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory, merge } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

describe('Module-local function detection', () => {

    it('should detect simple module-local function', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        function simpleHelper() {
            return 'helper result'
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return simpleHelper()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('simpleHelper')
        expect((capsule as any).cst.source.moduleLocalCode.simpleHelper).toContain('function simpleHelper()')
    })

    it('should detect async module-local function', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        async function asyncHelper() {
            return 'async result'
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<string> {
                            return await asyncHelper()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('asyncHelper')
        expect((capsule as any).cst.source.moduleLocalCode.asyncHelper).toContain('async function asyncHelper()')
    })

    it('should detect module-local function with nested function', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        function helperWithNested() {
            function nested() {
                return 'nested'
            }
            return nested()
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return helperWithNested()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('helperWithNested')
        expect((capsule as any).cst.source.moduleLocalCode.helperWithNested).toContain('function helperWithNested()')
        expect((capsule as any).cst.source.moduleLocalCode.helperWithNested).toContain('function nested()')
    })

    it('should detect module-local function with arrow function', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        function helperWithArrow() {
            const arrow = () => 'arrow'
            return arrow()
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return helperWithArrow()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('helperWithArrow')
        expect((capsule as any).cst.source.moduleLocalCode.helperWithArrow).toContain('function helperWithArrow()')
    })

    it('should detect module-local function with dependencies', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        function helperA() {
            return 'A'
        }

        function helperB() {
            return helperA() + 'B'
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return helperB()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('helperB')
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('helperA')
        expect((capsule as any).cst.source.moduleLocalCode.helperB).toContain('function helperB()')
        expect((capsule as any).cst.source.moduleLocalCode.helperA).toContain('function helperA()')
    })

    it('should detect complex async module-local function with nested async functions', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        async function loadConfigWithExtends(configPath: string): Promise<any> {
            const loadedConfigs: any[] = []
            const visited = new Set<string>()

            async function loadConfigRecursive(currentPath: string): Promise<void> {
                if (visited.has(currentPath)) {
                    throw new Error(`Circular extends detected: ${currentPath}`)
                }
                visited.add(currentPath)

                const config = { extends: [] }

                if (config.extends && Array.isArray(config.extends)) {
                    for (const extendPath of config.extends) {
                        await loadConfigRecursive(extendPath)
                    }
                }

                loadedConfigs.push(config)
            }

            await loadConfigRecursive(configPath)

            let mergedConfig = {}
            for (const config of loadedConfigs) {
                merge(mergedConfig, config)
            }

            return mergedConfig
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<any> {
                            return await loadConfigWithExtends('/test/path')
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('loadConfigWithExtends')
        expect((capsule as any).cst.source.moduleLocalCode.loadConfigWithExtends).toContain('async function loadConfigWithExtends(')
        expect((capsule as any).cst.source.moduleLocalCode.loadConfigWithExtends).toContain('async function loadConfigRecursive(')
    })

    it('should detect module-local function using built-in APIs', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        function helperWithBuiltins(data: any) {
            const str = JSON.stringify(data)
            const parsed = JSON.parse(str)
            console.log('Processing:', parsed)
            return Object.keys(parsed).length
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): number {
                            return helperWithBuiltins({ foo: 'bar' })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('helperWithBuiltins')
        expect((capsule as any).cst.source.moduleLocalCode.helperWithBuiltins).toContain('function helperWithBuiltins(')
    })

    it('should detect module-local function with parameters and local variables', async () => {
        function processData(input: string, multiplier: number) {
            const prefix = 'processed:'
            const result = prefix + input.repeat(multiplier)
            return result
        }

        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return processData('test', 2)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('processData')
        expect((capsule as any).cst.source.moduleLocalCode.processData).toContain('function processData(')
    })

    it('should handle module-local function with destructuring parameters', async () => {
        function processOptions({ name, value }: { name: string, value: number }) {
            return `${name}: ${value}`
        }

        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            return processOptions({ name: 'test', value: 42 })
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('processOptions')
        expect((capsule as any).cst.source.moduleLocalCode.processOptions).toContain('function processOptions(')
    })

    it('should handle import.meta.resolve in capsule function', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    test: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: function (this: any): string {
                            const resolved = import.meta.resolve('./some-module')
                            return resolved
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack()
        })

        expect(capsule).toBeDefined()
    })

    it('should detect path-based property names for mapping', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Create a source capsule
        const sourceCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    'test.property': {
                        type: CapsulePropertyTypes.String,
                        value: 'test value'
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'sourceCapsule'
        })

        // Create a mapping capsule with path-based property name
        const mappingCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    '/apps/web/src/components/TestComponent.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: sourceCapsule
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'mappingCapsule',
            ambientReferences: {
                sourceCapsule
            }
        })

        // Verify the mapping capsule CST has the path-based property
        const spineContract = (mappingCapsule as any).cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
        expect(spineContract).toBeDefined()
        expect(spineContract.propertyContracts['#']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/TestComponent.tsx']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/TestComponent.tsx'].type).toBe('CapsulePropertyTypes.Mapping')
    })

    it('should detect multiple path-based property names', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const capsule1 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    'prop1': {
                        type: CapsulePropertyTypes.String,
                        value: 'value1'
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'capsule1'
        })

        const capsule2 = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    'prop2': {
                        type: CapsulePropertyTypes.String,
                        value: 'value2'
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'capsule2'
        })

        // Create a mapping capsule with multiple path-based properties
        const mappingCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    '/apps/web/src/components/Component1.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: capsule1
                    },
                    '/apps/web/src/components/Component2.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: capsule2
                    },
                    '/apps/mobile/src/screens/Screen1.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: capsule1
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'mappingCapsule',
            ambientReferences: {
                capsule1,
                capsule2
            }
        })

        // Verify all path-based properties are detected
        const spineContract = (mappingCapsule as any).cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Component1.tsx']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Component2.tsx']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/mobile/src/screens/Screen1.tsx']).toBeDefined()

        // Verify they're all Mapping types
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Component1.tsx'].type).toBe('CapsulePropertyTypes.Mapping')
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Component2.tsx'].type).toBe('CapsulePropertyTypes.Mapping')
        expect(spineContract.propertyContracts['#'].properties['/apps/mobile/src/screens/Screen1.tsx'].type).toBe('CapsulePropertyTypes.Mapping')
    })

    it('should handle path-based properties with string literal spine contract URI', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract
            }
        })

        const sourceCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    'solidjs.com': {
                        type: CapsulePropertyTypes.Function,
                        value: function () { return 'component' }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'sourceCapsule'
        })

        // Use string literal for spine contract URI (not computed property name)
        const mappingCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    '/apps/web/src/components/Counter.tsx': {
                        type: CapsulePropertyTypes.Mapping,
                        value: sourceCapsule
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'mappingCapsule',
            ambientReferences: {
                sourceCapsule
            }
        })

        // Verify the spine contract was properly parsed with string literal
        const spineContract = (mappingCapsule as any).cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
        expect(spineContract).toBeDefined()
        expect(spineContract.propertyContracts['#@stream44.studio/encapsulate/structs/Capsule']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Counter.tsx']).toBeDefined()
        expect(spineContract.propertyContracts['#'].properties['/apps/web/src/components/Counter.tsx'].type).toBe('CapsulePropertyTypes.Mapping')
    })

    it('should detect literal ambient references like prefix in capsule functions', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract
            }
        })

        const prefix = 'test-prefix'

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    hello: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `[${prefix}] Hello: ${this.username}`
                        }
                    },
                    username: {
                        type: CapsulePropertyTypes.String,
                        value: 'World'
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'testCapsule',
            ambientReferences: {
                prefix
            }
        })

        // Verify that prefix is detected as a literal ambient reference in the CST
        expect((capsule as any).cst.source.ambientReferences).toHaveProperty('prefix')
        expect((capsule as any).cst.source.ambientReferences.prefix.type).toBe('literal')
        expect((capsule as any).cst.source.ambientReferences.prefix.value).toBe('test-prefix')
    })

    it('should not treat loop variables as ambient references', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract
            }
        })

        function getConfig() {
            return {
                commands: {
                    push: { description: 'Push command', options: { rc: { description: 'RC mode' } } },
                    deploy: { description: 'Deploy command', options: { force: { description: 'Force' } } }
                }
            }
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    runCli: {
                        type: CapsulePropertyTypes.GetterFunction,
                        value: async function (this: any): Promise<void> {
                            const config = getConfig()
                            for (const commandName in config.commands) {
                                const commandConfig = config.commands[commandName]
                                const commandOptions = commandConfig.options

                                if (commandOptions) {
                                    for (const optionName in commandOptions) {
                                        const optionConfig = commandOptions[optionName]
                                        console.log(`Option: ${optionName} - ${optionConfig.description}`)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'testCapsule'
        })

        // Verify that loop variables are NOT detected as ambient references
        // config is a local variable, commandConfig/commandOptions/optionConfig are loop variables
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('config')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('commandConfig')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('commandOptions')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('optionConfig')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('commandName')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('optionName')

        // getConfig should be detected as module-local
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('getConfig')
    })

    it('should detect module-local const that uses imports', async () => {
        // This test verifies that when a capsule function references a module-level const
        // that was initialized using imports, the static analyzer should:
        // 1. Recognize the const as a module-local variable
        // 2. Walk its initializer to collect the imports it depends on
        // 3. Include both the const and its import dependencies in the CST
        //
        // Pattern being tested (from WorkspaceKey.v0.ts):
        //   import { join } from 'path'
        //   import { homedir } from 'os'
        //   const WORKSPACE_KEYS_DIR = join(homedir(), '.o/workspace.foundation/workspace-keys')
        //   ...
        //   function (this: any) { return join(WORKSPACE_KEYS_DIR, 'key.json') }

        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Import the test capsule that has a module-level const using imports
        const { capsule: testCapsuleFn } = await import('./const-with-import.cap.js')

        // Create the capsule - this should work without needing to pass KEYS_DIR in ambientReferences
        // because the static analyzer should detect it as a module-local variable
        const capsule = await testCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // Verify that KEYS_DIR is detected as a module-local variable
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('KEYS_DIR')

        // Verify that join is detected as an import
        expect((capsule as any).cst.source.ambientReferences).toHaveProperty('join')
        expect((capsule as any).cst.source.ambientReferences.join.type).toBe('import')

        // Verify that homedir is also detected as an import (dependency of KEYS_DIR)
        expect((capsule as any).cst.source.ambientReferences).toHaveProperty('homedir')
        expect((capsule as any).cst.source.ambientReferences.homedir.type).toBe('import')
    })

    it('should allow Bun as a native ambient reference', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    compareVersions: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, version: string, range: string): boolean {
                            return Bun.semver.satisfies(version, range)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'testCapsule'
        })

        // Verify that Bun is allowed as a module-global builtin
        // The main test is that no ambient reference error was thrown during encapsulation
        // If we reach this point, Bun was successfully allowed as a MODULE_GLOBAL_BUILTIN
        expect(capsule).toBeDefined()

        // Verify the CST was created (proves encapsulation succeeded)
        expect((capsule as any).cst).toBeDefined()
        expect((capsule as any).cst.source).toBeDefined()
    })

    it('should not treat interface declarations inside function bodies as ambient references', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': CapsuleSpineContract
            }
        })

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    process: {
                        type: CapsulePropertyTypes.Function,
                        value: async function (this: any): Promise<void> {
                            interface Entry { name: string; value: number }
                            type Mapping = Record<string, Entry>
                            const items: Entry[] = [{ name: 'a', value: 1 }]
                            const map: Mapping = {}
                            for (const item of items) {
                                map[item.name] = item
                            }
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'testCapsule'
        })

        // Interface and type alias declarations should NOT be treated as ambient references
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('Entry')
        expect((capsule as any).cst.source.ambientReferences).not.toHaveProperty('Mapping')
    })

    it('should detect module-local function that references module-local variables as self-contained', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const PORTS = { mozilla: 33101, chrome: 33102 } as const

        function resolvePorts(target?: string): number[] {
            if (!target) return [PORTS.mozilla, PORTS.chrome]
            return [PORTS[target as keyof typeof PORTS]]
        }

        const capsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    broadcast: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, target?: string): number[] {
                            return resolvePorts(target)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'testCapsule'
        })

        // resolvePorts should be detected as module-local (self-contained)
        // because it only references PORTS which is also a module-local variable
        expect((capsule as any).cst.source.ambientReferences.resolvePorts).toBeDefined()
        expect((capsule as any).cst.source.ambientReferences.resolvePorts.type).toBe('module-local')

        // PORTS should also be captured as a module-local dependency
        expect((capsule as any).cst.source.ambientReferences.PORTS).toBeDefined()
        expect((capsule as any).cst.source.ambientReferences.PORTS.type).toBe('module-local')

        // Both should appear in moduleLocalCode
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('resolvePorts')
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('PORTS')
    })

    it('should preserve export keyword on exported module-local const in moduleLocalCode', async () => {
        const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Import the test capsule that has an exported const
        const { capsule: testCapsuleFn } = await import('./exported-const.cap.js')

        const capsule = await testCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        // Verify that MODEL_NAME is detected as a module-local variable
        expect((capsule as any).cst.source.moduleLocalCode).toHaveProperty('MODEL_NAME')

        // The moduleLocalCode should preserve the 'export' keyword from the source
        expect((capsule as any).cst.source.moduleLocalCode.MODEL_NAME).toStartWith('export ')
    })
})
