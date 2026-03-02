
import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static.v0"

describe('3-level extends chain: parent function calls child function via this', () => {

    it('parent function can call child Function property via this (2-level)', async () => {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: false,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Parent: defines a public wrapper that delegates to this._impl()
        const parentCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    doWork: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, input: string): string {
                            // Parent calls this._doWorkImpl which is defined in child
                            return this._doWorkImpl(input)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'parentCapsule'
        })

        // Child: extends parent and provides _doWorkImpl
        const childCapsule = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    _doWorkImpl: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, input: string): string {
                            return `Processed: ${input}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: parentCapsule,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'childCapsule'
        })

        const result = await run({}, async ({ apis }) => {
            return apis['childCapsule'].doWork('hello')
        })

        expect(result).toBe('Processed: hello')
    })

    it('grandparent function can call grandchild Function property via this (3-level)', async () => {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: false,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Grandparent (Engine): public API delegates to _-prefixed methods
        const engine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    verbose: {
                        type: CapsulePropertyTypes.Literal,
                        value: false
                    },
                    mergeNode: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string, data: any): string {
                            return this._mergeNode(table, data)
                        }
                    },
                    listItems: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): any[] {
                            return this._listItems()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'engine'
        })

        // Middle child (QueryAPI): implements _-prefixed query methods
        const queryAPI = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    _store: {
                        type: CapsulePropertyTypes.Literal,
                        value: [] as any[]
                    },
                    _mergeNode: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string, data: any): string {
                            this._store.push({ table, ...data })
                            return `Merged into ${table}`
                        }
                    },
                    _listItems: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): any[] {
                            return this._store
                        }
                    }
                }
            }
        }, {
            extendsCapsule: engine,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'queryAPI'
        })

        // Leaf child (ImportAPI): uses public API from engine which delegates to queryAPI
        const importAPI = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    importData: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, items: any[]): string[] {
                            const results: string[] = []
                            for (const item of items) {
                                results.push(this.mergeNode(item.table, item.data))
                            }
                            return results
                        }
                    }
                }
            }
        }, {
            extendsCapsule: queryAPI,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'importAPI'
        })

        const result = await run({}, async ({ apis }) => {
            // Call importData on importAPI, which calls this.mergeNode (from engine),
            // which calls this._mergeNode (from queryAPI)
            const importResults = apis['importAPI'].importData([
                { table: 'Users', data: { name: 'Alice' } },
                { table: 'Users', data: { name: 'Bob' } }
            ])

            // Then query via the public API
            const items = apis['importAPI'].listItems()

            return { importResults, items }
        })

        expect(result).toEqual({
            importResults: ['Merged into Users', 'Merged into Users'],
            items: [
                { table: 'Users', name: 'Alice' },
                { table: 'Users', name: 'Bob' }
            ]
        })
    })

    it('middle capsule function can call child Function property via this (upward from middle)', async () => {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: false,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Top: public API
        const top = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    run: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return this._run()
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'top'
        })

        // Middle: implements _run, calls this._format from bottom
        const middle = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    _run: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any): string {
                            return `Result: ${this._format('data')}`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: top,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'middle'
        })

        // Bottom: implements _format
        const bottom = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    _format: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, input: string): string {
                            return `[${input}]`
                        }
                    }
                }
            }
        }, {
            extendsCapsule: middle,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'bottom'
        })

        const result = await run({}, async ({ apis }) => {
            return apis['bottom'].run()
        })

        expect(result).toBe('Result: [data]')
    })

    it('4-level extends chain: great-grandparent delegates through all levels (4-level)', async () => {

        const { encapsulate, run, CapsulePropertyTypes, makeImportStack } = await CapsuleSpineFactory({
            spineFilesystemRoot: join(import.meta.dir, '../../../../..'),
            staticAnalysisEnabled: false,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        // Level 1 (ModelQueryMethods): public API delegates to _-prefixed methods
        const modelQueryMethods = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    query: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string): any[] {
                            return this._query(table)
                        }
                    },
                    count: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string): number {
                            return this._count(table)
                        }
                    }
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'modelQueryMethods'
        })

        // Level 2 (Engine): extends ModelQueryMethods, adds mutation API
        const engine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    mergeNode: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string, data: any): string {
                            return this._mergeNode(table, data)
                        }
                    }
                }
            }
        }, {
            extendsCapsule: modelQueryMethods,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'engine'
        })

        // Level 3 (QueryAPI): extends Engine, implements _-prefixed query+mutation methods
        const queryAPI = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    _store: {
                        type: CapsulePropertyTypes.Literal,
                        value: [] as any[]
                    },
                    _mergeNode: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string, data: any): string {
                            this._store.push({ table, ...data })
                            return `Merged into ${table}`
                        }
                    },
                    _query: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string): any[] {
                            return this._store.filter((r: any) => r.table === table)
                        }
                    },
                    _count: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, table: string): number {
                            return this._store.filter((r: any) => r.table === table).length
                        }
                    }
                }
            }
        }, {
            extendsCapsule: engine,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'queryAPI'
        })

        // Level 4 (ImportAPI): extends QueryAPI, uses public API from all levels
        const importAPI = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#': {
                    importBatch: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, items: any[]): { merged: string[], count: number } {
                            const merged: string[] = []
                            for (const item of items) {
                                merged.push(this.mergeNode(item.table, item.data))
                            }
                            // Use query from level 1 (ModelQueryMethods)
                            const count = this.count(items[0]?.table || '')
                            return { merged, count }
                        }
                    }
                }
            }
        }, {
            extendsCapsule: queryAPI,
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: 'importAPI'
        })

        const result = await run({}, async ({ apis }) => {
            const batch = apis['importAPI'].importBatch([
                { table: 'Users', data: { name: 'Alice' } },
                { table: 'Users', data: { name: 'Bob' } },
                { table: 'Users', data: { name: 'Charlie' } }
            ])

            // Also verify query() works from level 1 through level 4
            const users = apis['importAPI'].query('Users')

            return { batch, users }
        })

        expect(result.batch).toEqual({
            merged: ['Merged into Users', 'Merged into Users', 'Merged into Users'],
            count: 3
        })
        expect(result.users).toEqual([
            { table: 'Users', name: 'Alice' },
            { table: 'Users', name: 'Bob' },
            { table: 'Users', name: 'Charlie' }
        ])
    })
})
