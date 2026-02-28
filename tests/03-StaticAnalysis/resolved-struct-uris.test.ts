
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"


it('Property contract URIs are resolved to full npm URIs in CST', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // A capsule that declares a struct dependency using a relative path
    const capsuleWithStruct = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#./caps/TestSchema': {
                options: {
                    '#': {
                        label: 'Test Column',
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'testCapsuleWithStruct'
    })

    const spineContracts = capsuleWithStruct.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
    const propertyContracts = spineContracts.propertyContracts

    // The property contract key should be resolved to a full npm URI, not a relative path
    const resolvedSchemaUri = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/TestSchema'
    const resolvedKey = '#' + resolvedSchemaUri

    expect(propertyContracts[resolvedKey]).toBeDefined()
    expect(propertyContracts[resolvedKey].propertyContractUri).toBe(resolvedSchemaUri)

    // The relative key should NOT exist
    expect(propertyContracts['#./caps/TestSchema']).toBeUndefined()

    // The dynamic mapping in '#' contract should also use resolved URIs
    const defaultContract = propertyContracts['#']
    expect(defaultContract.properties[resolvedKey]).toBeDefined()
    expect(defaultContract.properties[resolvedKey].mappedModuleUri).toBe(resolvedSchemaUri)
    expect(defaultContract.properties[resolvedKey].propertyContractDelegate).toBe(resolvedKey)
    expect(defaultContract.properties[resolvedKey].valueExpression).toBe(`"${resolvedSchemaUri}"`)

    // The relative key should NOT exist in dynamic mappings either
    expect(defaultContract.properties['#./caps/TestSchema']).toBeUndefined()
})


it('Literal options objects are stored in CST', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // A capsule with literal options on a struct dependency
    const capsuleWithOptions = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#./caps/TestSchema': {
                options: {
                    '#': {
                        label: 'My Label',
                        count: 42,
                        active: true,
                        tags: ['alpha', 'beta'],
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'testCapsuleWithOptions'
    })

    const spineContracts = capsuleWithOptions.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
    const resolvedSchemaUri = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/TestSchema'
    const resolvedKey = '#' + resolvedSchemaUri
    const schemaContract = spineContracts.propertyContracts[resolvedKey]

    // The 'options' should be stored directly on the property contract entry
    expect(schemaContract.options).toBeDefined()
    expect(schemaContract.options['#']).toBeDefined()
    expect(schemaContract.options['#'].label).toBe('My Label')
    expect(schemaContract.options['#'].count).toBe(42)
    expect(schemaContract.options['#'].active).toBe(true)
    expect(schemaContract.options['#'].tags).toEqual(['alpha', 'beta'])
})


it('Relative paths inside literal options are resolved to npm URIs', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // A capsule with a relative path inside literal options (like parentColumn)
    const capsuleWithRelativeOption = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#./caps/TestSchema': {
                options: {
                    '#': {
                        label: 'Child Column',
                        parentColumn: './caps/ColumnA',
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'testCapsuleWithRelativeOption'
    })

    const spineContracts = capsuleWithRelativeOption.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
    const resolvedSchemaUri = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/TestSchema'
    const resolvedKey = '#' + resolvedSchemaUri
    const schemaContract = spineContracts.propertyContracts[resolvedKey]

    expect(schemaContract.options['#'].label).toBe('Child Column')

    // The relative parentColumn path should be resolved to a full npm URI
    expect(schemaContract.options['#'].parentColumn).toBe(
        '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/ColumnA'
    )
})


it('Element capsule struct dependency on column is resolved in CST', async function () {

    const { encapsulate, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
        spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        }
    })

    // An element capsule that tags a column via struct dependency
    const elementCapsule = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#./caps/ColumnA': {},
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 'testElementCapsule'
    })

    const spineContracts = elementCapsule.cst.spineContracts['#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0']
    const propertyContracts = spineContracts.propertyContracts
    const resolvedColumnUri = '@stream44.studio/encapsulate/tests/03-StaticAnalysis/caps/ColumnA'
    const resolvedKey = '#' + resolvedColumnUri

    // Property contract key and URI should be resolved
    expect(propertyContracts[resolvedKey]).toBeDefined()
    expect(propertyContracts[resolvedKey].propertyContractUri).toBe(resolvedColumnUri)

    // Dynamic mapping should also be resolved
    const defaultContract = propertyContracts['#']
    expect(defaultContract.properties[resolvedKey]).toBeDefined()
    expect(defaultContract.properties[resolvedKey].mappedModuleUri).toBe(resolvedColumnUri)
    expect(defaultContract.properties[resolvedKey].propertyContractDelegate).toBe(resolvedKey)
})
