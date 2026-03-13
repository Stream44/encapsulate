
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#@stream44.studio/encapsulate/structs/CapsuleProjectionContext': {},
            '#': {
                // The component function (passed via options from the parent capsule)
                component: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },

                // OnFreeze: generates the projected standalone module at build time
                ProjectFile: {
                    type: CapsulePropertyTypes.OnFreeze,
                    value: async function (this: any) {
                        const projector = this['#@stream44.studio/encapsulate/structs/CapsuleProjectionContext']
                        if (!projector || !projector.projectionStore) return

                        // Resolve output path: prefer injected projectionPath (from caller's property name),
                        // fall back to 'as:' from the projector's own property contract in the parent CST
                        let outputPath = projector.projectionPath
                        if (!outputPath) {
                            const parentCst = projector.parentCapsuleCst
                            const scUri = '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'
                            const contractUri = '#@stream44.studio/encapsulate/tests/12-Projection/test-projector'
                            outputPath = parentCst?.spineContracts?.[scUri]?.propertyContracts?.[contractUri]?.as
                        }
                        if (!outputPath) return

                        // Get component source from CST (preserved original source)
                        const parentCst = projector.parentCapsuleCst
                        const scUri = '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0'
                        const contractUri = '#@stream44.studio/encapsulate/tests/12-Projection/test-projector'
                        const cstSource = parentCst?.spineContracts?.[scUri]?.propertyContracts?.[contractUri]?.options?.['#']?.component

                        let fnSource: string
                        if (cstSource) {
                            fnSource = cstSource
                        } else {
                            // Fallback to runtime toString
                            const componentFn = this.component
                            if (!componentFn || typeof componentFn !== 'function') {
                                throw new Error('test-projector: component option is required and must be a function')
                            }
                            fnSource = componentFn.toString()
                        }

                        // Extract the inner returned function
                        const match = fnSource.match(/return\s+(function\s+\w*\s*\([^)]*\)\s*\{[\s\S]*)\s*\}\s*$/)
                        if (!match) {
                            throw new Error('test-projector: component must contain a return statement with a named function')
                        }

                        let componentSource = match[1].trim()
                        if (!componentSource.endsWith('}')) {
                            componentSource += '\n}'
                        }

                        // Remove leading indentation
                        const lines = componentSource.split('\n')
                        const bodyLines = lines.slice(1)
                        const minIndent = bodyLines
                            .filter((line: string) => line.trim().length > 0)
                            .map((line: string) => (line.match(/^(\s*)/)?.[1].length || 0))
                            .reduce((min: number, indent: number) => Math.min(min, indent), Number.MAX_SAFE_INTEGER)
                        if (minIndent > 0 && minIndent !== Number.MAX_SAFE_INTEGER) {
                            componentSource = [lines[0], ...bodyLines.map((line: string) => line.substring(minIndent))].join('\n')
                        }

                        // Extract component name
                        const nameMatch = componentSource.match(/^function\s+(\w+)/)
                        const componentName = nameMatch ? nameMatch[1] : 'Component'

                        // Generate a simple standalone module
                        const fileContent = `// Projected by test-projector
export ${componentSource}

export default ${componentName}
`

                        await projector.projectionStore.writeFile(outputPath, fileContent)
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/encapsulate/tests/12-Projection/test-projector'
