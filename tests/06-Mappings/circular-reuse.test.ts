
import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


it('Reuse existing capsule instance when mapping has no options', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack, spineContractInstances } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // Get the instance registry from the encapsulation spine contract
    const instanceRegistry = spineContractInstances.encapsulation['#' + CapsuleSpineContract['#']].instanceRegistry

    // CapsuleA maps to CapsuleB without options
    // CapsuleB maps to CapsuleA without options
    // This would normally cause a circular dependency deadlock
    // But with instance reuse, CapsuleB should reuse the existing CapsuleA instance

    const capsuleA = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'CapsuleA'
                },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Hello from ${this.name}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/capsuleA',
    })

    const capsuleB = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'CapsuleB'
                },
                CapsuleA: {
                    type: CapsulePropertyTypes.Mapping,
                    value: capsuleA
                    // No options - should reuse existing instance
                },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Hello from ${this.name}`
                    }
                },
                greetA: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `${this.name} says: ${this.CapsuleA.greet()}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/capsuleB',
    })

    // Create instances - capsuleA first, then capsuleB
    // When capsuleB creates its instance, it should reuse the existing capsuleA instance
    const instanceA = await capsuleA.makeInstance()
    const instanceB = await capsuleB.makeInstance()

    // Verify the instances work correctly
    expect(instanceA.api.greet()).toBe('Hello from CapsuleA')
    expect(instanceB.api.greet()).toBe('Hello from CapsuleB')
    expect(instanceB.api.greetA()).toBe('CapsuleB says: Hello from CapsuleA')

    // Verify that the CapsuleA instance inside CapsuleB is the same as the standalone instanceA
    // This proves instance reuse is working
    expect(instanceRegistry.has('@test/capsuleA')).toBe(true)
    expect(instanceRegistry.get('@test/capsuleA')).toBe(instanceA)
})


it('Create new instance when mapping has options', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack, spineContractInstances } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    const baseConfig = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                realm: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'default'
                },
                getRealm: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return this.realm
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/baseConfig',
    })

    const appA = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                Config: {
                    type: CapsulePropertyTypes.Mapping,
                    value: baseConfig,
                    options: async () => ({
                        '#': {
                            realm: 'appA-realm'
                        }
                    })
                },
                describe: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `AppA in ${this.Config.getRealm()}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/appA',
    })

    const appB = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                Config: {
                    type: CapsulePropertyTypes.Mapping,
                    value: baseConfig,
                    options: async () => ({
                        '#': {
                            realm: 'appB-realm'
                        }
                    })
                },
                describe: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `AppB in ${this.Config.getRealm()}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@test/appB',
    })

    // Create instances
    const instanceBase = await baseConfig.makeInstance()
    const instanceA = await appA.makeInstance()
    const instanceB = await appB.makeInstance()

    // Each app should have its own Config instance with different realm
    // baseConfig should still have 'default' realm
    expect(instanceBase.api.getRealm()).toBe('default')
    expect(instanceA.api.describe()).toBe('AppA in appA-realm')
    expect(instanceB.api.describe()).toBe('AppB in appB-realm')

    // Get the instance registry from the encapsulation spine contract
    const instanceRegistry = spineContractInstances.encapsulation['#' + CapsuleSpineContract['#']].instanceRegistry

    // baseConfig IS in the registry because it was mapped by appA and appB (with options).
    // The last mapping with options registers its instance.
    // Each app still gets its own instance because mappings with options always create new instances.
    expect(instanceRegistry.has('@test/baseConfig')).toBe(true)
})


it('Parallel executions have isolated registries', async function () {

    // Create two separate CapsuleSpineFactory instances in parallel
    // Each should have its own isolated instanceRegistry

    const [factory1, factory2] = await Promise.all([
        CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        }),
        CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            capsuleModuleProjectionRoot: import.meta.dir,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })
    ])

    // Get the instance registries from each factory
    const registry1 = factory1.spineContractInstances.encapsulation['#' + CapsuleSpineContract['#']].instanceRegistry
    const registry2 = factory2.spineContractInstances.encapsulation['#' + CapsuleSpineContract['#']].instanceRegistry

    // Verify they are different Map instances - this proves isolation
    expect(registry1).not.toBe(registry2)

    // Both registries start empty
    expect(registry1.size).toBe(0)
    expect(registry2.size).toBe(0)

    // Manually add entries to verify they don't interfere
    registry1.set('@test/capsuleA', { name: 'Factory1-Instance' })
    registry2.set('@test/capsuleA', { name: 'Factory2-Instance' })

    // Verify each registry has its own independent entry
    expect(registry1.get('@test/capsuleA').name).toBe('Factory1-Instance')
    expect(registry2.get('@test/capsuleA').name).toBe('Factory2-Instance')

    // Verify they are truly independent
    expect(registry1.get('@test/capsuleA')).not.toBe(registry2.get('@test/capsuleA'))
})
