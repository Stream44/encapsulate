
import { join, normalize, dirname, resolve, relative } from 'path'
import { readFile, stat } from 'fs/promises'
import * as ts from 'typescript'
import { createHash } from 'crypto'

// Known exports from @stream44.studio/encapsulate/encapsulate that can be imported
const ENCAPSULATE_MODULE_EXPORTS = new Set([
    'CapsulePropertyTypes',
    'makeImportStack',
    'Spine',
    'SpineRuntime',
    'join',
])

/**
 * Finds the nearest package.json and constructs an npm URI for the given filepath
 * @param absoluteFilepath - The absolute path to the file
 * @param spineRoot - The spine filesystem root
 * @returns The npm URI (e.g., '@scope/package/path/to/file.ts') or null if not found
 */
async function constructNpmUri(absoluteFilepath: string, spineRoot: string): Promise<string | null> {
    let currentDir = dirname(absoluteFilepath)
    const maxDepth = 20 // Prevent infinite loops

    for (let i = 0; i < maxDepth; i++) {
        const packageJsonPath = join(currentDir, 'package.json')

        try {
            await stat(packageJsonPath)
            // Found package.json, read it
            const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
            const packageName = packageJson.name

            if (!packageName) {
                // No name in package.json, continue searching
                currentDir = dirname(currentDir)
                continue
            }

            // Get the relative path from the package root to the file
            const relativeFromPackage = relative(currentDir, absoluteFilepath)

            // Construct npm URI: packageName/relativePath
            return `${packageName}/${relativeFromPackage}`
        } catch (error) {
            // package.json not found or not readable, go up one directory
            const parentDir = dirname(currentDir)
            if (parentDir === currentDir) {
                // Reached filesystem root
                break
            }
            currentDir = parentDir
        }
    }

    return null
}

// Native JavaScript APIs that don't require explicit ambient reference declaration
// These are module-global builtins available in all JavaScript runtimes
const MODULE_GLOBAL_BUILTINS = new Set([

    'process',

    // Bun runtime
    'Bun',

    // Node.js Buffer
    'Buffer',

    // Console API
    'console',

    // Timers
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'setImmediate',
    'clearImmediate',

    // Encoding/Decoding
    'atob',
    'btoa',
    'TextEncoder',
    'TextDecoder',

    // URL APIs
    'URL',
    'URLSearchParams',

    // Fetch API
    'fetch',
    'Request',
    'Response',
    'Headers',

    // Crypto
    'crypto',
    'Crypto',
    'SubtleCrypto',

    // Structured Clone
    'structuredClone',

    // Error types
    'Error',
    'TypeError',
    'RangeError',
    'SyntaxError',
    'ReferenceError',
    'EvalError',
    'URIError',
    'AggregateError',

    // Collections
    'Array',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Record',

    // Typed Arrays
    'ArrayBuffer',
    'SharedArrayBuffer',
    'DataView',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',

    // Other standard builtins
    'Object',
    'Function',
    'Boolean',
    'Symbol',
    'Number',
    'BigInt',
    'Math',
    'Date',
    'String',
    'RegExp',
    'JSON',
    'Promise',
    'Proxy',
    'Reflect',
    'Intl',
    'WebAssembly',

    // Global functions
    'isNaN',
    'isFinite',
    'parseInt',
    'parseFloat',
    'encodeURI',
    'encodeURIComponent',
    'decodeURI',
    'decodeURIComponent',
    'escape',
    'unescape',
])

export function StaticAnalyzer({
    timing,
    cacheStore,
    spineStore
}: {
    timing?: { record: (step: string) => void, chalk?: any },
    cacheStore?: {
        writeFile?: (filepath: string, content: string) => Promise<void>,
        readFile?: (filepath: string) => Promise<string | undefined>,
        getStats?: (filepath: string) => Promise<{ mtime: Date } | null>
    },
    spineStore?: {
        getStats?: (filepath: string) => Promise<{ mtime: Date } | null>
    }
} = {}) {

    timing?.record('StaticAnalyzer: Initialized')

    return {

        parseModule: async ({ spineOptions, encapsulateOptions }: { spineOptions: any, encapsulateOptions: any }) => {

            const moduleFilepath = join(spineOptions.spineFilesystemRoot, encapsulateOptions.moduleFilepath)

            // Determine the cache file path based on whether the module is external or internal
            let cacheFilePath: string
            if (encapsulateOptions.moduleFilepath.startsWith('../')) {
                // External module - construct npm URI
                const npmUri = await constructNpmUri(moduleFilepath, spineOptions.spineFilesystemRoot)
                if (npmUri) {
                    cacheFilePath = npmUri
                } else {
                    // Fallback to normalized path if npm URI construction fails
                    cacheFilePath = normalize(encapsulateOptions.moduleFilepath).replace(/^\.\.\//, '').replace(/\.\.\//g, '')
                }
            } else {
                // Internal module - use relative path as-is
                cacheFilePath = encapsulateOptions.moduleFilepath
            }

            const capsuleSourceLineRef = `${cacheFilePath}:${encapsulateOptions.importStackLine}`

            // Try to load from cache first
            if (cacheStore?.readFile && cacheStore?.getStats && spineStore?.getStats) {
                try {
                    // Check if cache files exist and are newer than source file
                    const [cstsStats, crtsStats, sourceStats] = await Promise.all([
                        cacheStore.getStats(`${capsuleSourceLineRef}.csts.json`),
                        cacheStore.getStats(`${capsuleSourceLineRef}.crts.json`),
                        spineStore.getStats(encapsulateOptions.moduleFilepath)
                    ])

                    // Use cache if both cache files exist and are newer than source file
                    if (cstsStats && crtsStats && sourceStats &&
                        cstsStats.mtime >= sourceStats.mtime &&
                        crtsStats.mtime >= sourceStats.mtime) {

                        const [cstsContent, crtsContent] = await Promise.all([
                            cacheStore.readFile(`${capsuleSourceLineRef}.csts.json`),
                            cacheStore.readFile(`${capsuleSourceLineRef}.crts.json`)
                        ])

                        if (cstsContent && crtsContent) {
                            timing?.record(`StaticAnalyzer: Cache HIT for ${encapsulateOptions.moduleFilepath}`)
                            return {
                                csts: JSON.parse(cstsContent),
                                crts: JSON.parse(crtsContent)
                            }
                        }
                    }
                    timing?.record(timing?.chalk?.red?.(`StaticAnalyzer: Cache MISS for ${encapsulateOptions.moduleFilepath}`))
                } catch (error) {
                    // Cache miss or error, continue with normal parsing
                    timing?.record(timing?.chalk?.red?.(`StaticAnalyzer: Cache error for ${encapsulateOptions.moduleFilepath}`))
                }
            }

            timing?.record(`StaticAnalyzer: Reading source file ${encapsulateOptions.moduleFilepath}`)

            const csts: Record<string, any> = {}
            const crts = {}

            try {
                // Read source file
                timing?.record(`StaticAnalyzer: About to read file ${encapsulateOptions.moduleFilepath}`)
                const readStart = Date.now()
                const sourceCode = await readFile(moduleFilepath, 'utf-8')
                const readDuration = Date.now() - readStart
                timing?.record(`StaticAnalyzer: Read file took ${readDuration}ms for ${encapsulateOptions.moduleFilepath}`)

                // Parse with TypeScript
                timing?.record(`StaticAnalyzer: About to parse with TypeScript ${encapsulateOptions.moduleFilepath}`)
                const parseStart = Date.now()
                const sourceFile = ts.createSourceFile(
                    moduleFilepath,
                    sourceCode,
                    ts.ScriptTarget.Latest,
                    true
                )
                const parseDuration = Date.now() - parseStart
                timing?.record(`StaticAnalyzer: TypeScript parse took ${parseDuration}ms for ${encapsulateOptions.moduleFilepath}`)

                // Build import map for the file
                const importMap = buildImportMap(sourceFile)

                // Build assignment map for variables assigned from imported functions
                const assignmentMap = buildAssignmentMap(sourceFile, importMap)

                // Find all encapsulate() calls
                const encapsulateCalls = findEncapsulateCalls(sourceFile)

                // Process each encapsulate call
                for (const call of encapsulateCalls) {
                    const declarationLine = sourceFile.getLineAndCharacterOfPosition(call.pos).line + 1

                    // Check if this call contains a makeImportStack() call on the importStackLine
                    let hasMatchingImportStack = false
                    if (call.arguments.length > 1 && ts.isObjectLiteralExpression(call.arguments[1])) {
                        const optionsObject = call.arguments[1]
                        for (const prop of optionsObject.properties) {
                            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'importStack') {
                                if (ts.isCallExpression(prop.initializer) && ts.isIdentifier(prop.initializer.expression) && prop.initializer.expression.text === 'makeImportStack') {
                                    const importStackCallLine = sourceFile.getLineAndCharacterOfPosition(prop.initializer.pos).line + 1
                                    if (importStackCallLine === encapsulateOptions.importStackLine) {
                                        hasMatchingImportStack = true
                                        break
                                    }
                                }
                            }
                        }
                    }

                    // Only process calls that match the importStackLine
                    if (!hasMatchingImportStack) {
                        continue
                    }

                    const capsuleSourceLineRef = `${encapsulateOptions.moduleFilepath}:${encapsulateOptions.importStackLine}`
                    const capsuleSourceNameRef = encapsulateOptions.capsuleName && `${encapsulateOptions.moduleFilepath}:${encapsulateOptions.capsuleName}`
                    const capsuleSourceNameRefHash = capsuleSourceNameRef && createHash('md5').update(capsuleSourceNameRef).digest('hex')

                    // Construct npm URI for the module - try for all modules
                    let moduleUri: string | null = await constructNpmUri(moduleFilepath, spineOptions.spineFilesystemRoot)

                    // If npm URI construction failed, fall back to moduleFilepath
                    if (!moduleUri) {
                        moduleUri = encapsulateOptions.moduleFilepath
                    }

                    // Strip file extension from URI
                    const moduleUriWithoutExt = moduleUri.replace(/\.(ts|tsx|js|jsx)$/, '')
                    const capsuleSourceUriLineRef = `${moduleUriWithoutExt}:${encapsulateOptions.importStackLine}`

                    // Store moduleUri without extension
                    moduleUri = moduleUriWithoutExt

                    // Extract the capsule expression text from the source
                    const capsuleExpression = call.getText(sourceFile)

                    const ambientReferences = extractCapsuleAmbientReferences(
                        call,
                        sourceFile,
                        encapsulateOptions.ambientReferences,
                        importMap,
                        assignmentMap
                    )

                    const cst: any = {
                        capsuleSourceLineRef,
                        capsuleSourceNameRef,
                        capsuleSourceNameRefHash,
                        capsuleSourceUriLineRef,
                        source: {
                            moduleFilepath: encapsulateOptions.moduleFilepath,
                            moduleUri,
                            capsuleName: encapsulateOptions.capsuleName,
                            declarationLine,
                            importStackLine: encapsulateOptions.importStackLine,
                            capsuleExpression,
                            ambientReferences,
                            moduleLocalCode: extractModuleLocalCode(
                                ambientReferences,
                                sourceFile,
                                importMap,
                                assignmentMap,
                                call
                            )
                        },
                        spineContracts: {}
                    }

                    // Parse the first argument (capsule definition object)
                    if (call.arguments.length > 0 && ts.isObjectLiteralExpression(call.arguments[0])) {
                        const definitionObject = call.arguments[0]

                        // Get start and end line numbers for the definition object
                        const defStartPos = sourceFile.getLineAndCharacterOfPosition(definitionObject.getStart(sourceFile))
                        const defEndPos = sourceFile.getLineAndCharacterOfPosition(definitionObject.getEnd())
                        cst.source.definitionStartLine = defStartPos.line + 1
                        cst.source.definitionEndLine = defEndPos.line + 1

                        // Parse the second argument (options object) if present
                        if (call.arguments.length > 1 && ts.isObjectLiteralExpression(call.arguments[1])) {
                            const optionsObject = call.arguments[1]
                            const optionsStartPos = sourceFile.getLineAndCharacterOfPosition(optionsObject.getStart(sourceFile))
                            const optionsEndPos = sourceFile.getLineAndCharacterOfPosition(optionsObject.getEnd())
                            cst.source.optionsStartLine = optionsStartPos.line + 1
                            cst.source.optionsEndLine = optionsEndPos.line + 1

                            // Extract extendsCapsule option if present
                            for (const prop of optionsObject.properties) {
                                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'extendsCapsule') {
                                    // Check if it's a string literal (relative path or npm URI)
                                    if (ts.isStringLiteral(prop.initializer)) {
                                        cst.source.extendsCapsule = prop.initializer.text
                                    }
                                    // Check if it's an identifier (capsule variable reference)
                                    else if (ts.isIdentifier(prop.initializer)) {
                                        cst.source.extendsCapsule = prop.initializer.text
                                    }
                                    break
                                }
                            }
                        }

                        // Parse spineContract definitions (e.g., '$spineContract1': { ... })
                        for (const spineContractProp of definitionObject.properties) {
                            let spineContractName: string | null = null

                            // Handle string literal property names
                            if (ts.isPropertyAssignment(spineContractProp) && ts.isStringLiteral(spineContractProp.name)) {
                                spineContractName = spineContractProp.name.text
                            }
                            // Handle computed property names like ['#' + CapsuleSpineContract['#']]
                            else if (ts.isPropertyAssignment(spineContractProp) && ts.isComputedPropertyName(spineContractProp.name)) {
                                const computedName = spineContractProp.name.expression
                                // Try to resolve the computed name from ambient references
                                const computedText = computedName.getText(sourceFile)
                                // Check if it matches pattern like "'#' + SomeVar['#']" or '"#" + SomeVar["#"]'
                                const match = computedText.match(/['"]#['"] \+ (\w+)\[['"]#['"]\]/)
                                if (match && ambientReferences[match[1]]) {
                                    const refValue = ambientReferences[match[1]].value
                                    if (refValue && refValue['#']) {
                                        spineContractName = '#' + refValue['#']
                                    }
                                }
                            }

                            if (spineContractName && ts.isPropertyAssignment(spineContractProp)) {
                                const spineContractValue = spineContractProp.initializer

                                if (ts.isObjectLiteralExpression(spineContractValue)) {
                                    const spineContractDef: any = {
                                        properties: {}
                                    }

                                    // Parse properties within the spineContract
                                    for (const prop of spineContractValue.properties) {
                                        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
                                            const propName = ts.isIdentifier(prop.name) ? prop.name.text : (prop.name as ts.StringLiteral).text
                                            const propValue = prop.initializer

                                            // Check if this is a property contract key (starts with '#')
                                            if (propName.startsWith('#')) {
                                                const propertyContractUri = propName.substring(1) // Remove the '#' prefix

                                                if (ts.isObjectLiteralExpression(propValue)) {
                                                    // Create property contract entry
                                                    if (!spineContractDef.properties[propName]) {
                                                        spineContractDef.properties[propName] = {
                                                            propertyContractUri,
                                                            properties: {}
                                                        }
                                                    }

                                                    // Check for 'as' property at the property contract level
                                                    for (const contractProp of propValue.properties) {
                                                        if (ts.isPropertyAssignment(contractProp) && ts.isIdentifier(contractProp.name) && contractProp.name.text === 'as') {
                                                            if (ts.isStringLiteral(contractProp.initializer)) {
                                                                spineContractDef.properties[propName].as = contractProp.initializer.text
                                                            }
                                                        }
                                                    }

                                                    // Parse properties within the property contract
                                                    for (const contractProp of propValue.properties) {
                                                        if (ts.isPropertyAssignment(contractProp) && (ts.isIdentifier(contractProp.name) || ts.isStringLiteral(contractProp.name))) {
                                                            const contractPropName = ts.isIdentifier(contractProp.name) ? contractProp.name.text : (contractProp.name as ts.StringLiteral).text
                                                            const contractPropValue = contractProp.initializer

                                                            if (ts.isObjectLiteralExpression(contractPropValue)) {
                                                                const propDef: any = {}

                                                                // Get line numbers for the property
                                                                const propDeclarationPos = sourceFile.getLineAndCharacterOfPosition(contractProp.name.getStart(sourceFile))
                                                                propDef.declarationLine = propDeclarationPos.line + 1

                                                                const propDefStartPos = sourceFile.getLineAndCharacterOfPosition(contractPropValue.getStart(sourceFile))
                                                                const propDefEndPos = sourceFile.getLineAndCharacterOfPosition(contractPropValue.getEnd())
                                                                propDef.definitionStartLine = propDefStartPos.line + 1
                                                                propDef.definitionEndLine = propDefEndPos.line + 1

                                                                // Extract property definition fields
                                                                for (const field of contractPropValue.properties) {
                                                                    if (ts.isPropertyAssignment(field) && ts.isIdentifier(field.name)) {
                                                                        const fieldName = field.name.text
                                                                        const fieldValue = field.initializer

                                                                        if (fieldName === 'type') {
                                                                            // Extract type value
                                                                            if (ts.isPropertyAccessExpression(fieldValue)) {
                                                                                propDef.type = fieldValue.getText(sourceFile)
                                                                            }
                                                                        } else if (fieldName === 'value') {
                                                                            // Capture the TS type of the value
                                                                            const valueType = extractValueType(fieldValue, sourceFile)
                                                                            propDef.valueType = valueType

                                                                            // Store the value expression as text
                                                                            propDef.valueExpression = fieldValue.getText(sourceFile)

                                                                            // Extract ambient references if it's a function
                                                                            if (ts.isFunctionExpression(fieldValue) || ts.isArrowFunction(fieldValue)) {
                                                                                propDef.ambientReferences = extractAndValidateAmbientReferences(
                                                                                    fieldValue,
                                                                                    sourceFile,
                                                                                    encapsulateOptions.ambientReferences,
                                                                                    contractPropName,
                                                                                    spineContractName,
                                                                                    importMap,
                                                                                    assignmentMap
                                                                                )

                                                                                // Extract module-local code for property functions
                                                                                propDef.moduleLocalCode = extractModuleLocalCode(
                                                                                    propDef.ambientReferences,
                                                                                    sourceFile,
                                                                                    importMap,
                                                                                    assignmentMap
                                                                                )
                                                                            }
                                                                        } else if (fieldName === 'kind') {
                                                                            propDef.kind = fieldValue.getText(sourceFile)
                                                                        } else if (fieldName === 'projections') {
                                                                            propDef.projections = fieldValue.getText(sourceFile)
                                                                        } else if (fieldName === 'tags') {
                                                                            propDef.tags = fieldValue.getText(sourceFile)
                                                                        }
                                                                    }
                                                                }

                                                                spineContractDef.properties[propName].properties[contractPropName] = propDef
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    cst.spineContracts[spineContractName] = spineContractDef
                                }
                            }
                        }
                    }

                    // Add dynamic property contract mappings to the CST
                    // For each non-default property contract, create a mapping in the '#' contract
                    for (const [spineContractName, spineContractDef] of Object.entries(cst.spineContracts)) {
                        const spineContract = spineContractDef as any
                        if (spineContract.properties) {
                            // Find all non-default property contracts
                            const nonDefaultContracts: string[] = []
                            for (const propName of Object.keys(spineContract.properties)) {
                                if (propName.startsWith('#') && propName !== '#') {
                                    nonDefaultContracts.push(propName)
                                }
                            }

                            // Add dynamic mappings to the '#' contract
                            if (nonDefaultContracts.length > 0) {
                                // Ensure '#' contract exists
                                if (!spineContract.properties['#']) {
                                    spineContract.properties['#'] = {
                                        propertyContractUri: '',
                                        properties: {}
                                    }
                                }
                                if (!spineContract.properties['#'].properties) {
                                    spineContract.properties['#'].properties = {}
                                }

                                // Add a dynamic mapping for each non-default property contract
                                for (const propContractUri of nonDefaultContracts) {
                                    // Check if 'as' alias is defined for this property contract
                                    const aliasName = spineContract.properties[propContractUri]?.as
                                    const contractKey = aliasName || ('#' + propContractUri.substring(1))
                                    spineContract.properties['#'].properties[contractKey] = {
                                        declarationLine: -1,
                                        definitionStartLine: -1,
                                        definitionEndLine: -1,
                                        type: 'CapsulePropertyTypes.Mapping',
                                        valueType: 'string',
                                        valueExpression: `"${propContractUri.substring(1)}"`,
                                        propertyContractDelegate: propContractUri,
                                        as: aliasName
                                    }
                                }
                            }
                        }
                    }

                    csts[capsuleSourceLineRef] = cst
                }

            } catch (error) {
                console.error(`Error parsing module '${moduleFilepath}':`, error)
                throw error
            }

            timing?.record(`StaticAnalyzer: Parsing complete for ${encapsulateOptions.moduleFilepath}`)

            // Save to cache
            if (cacheStore?.writeFile) {
                try {
                    timing?.record(`StaticAnalyzer: Writing cache for ${encapsulateOptions.moduleFilepath}`)
                    await Promise.all([
                        cacheStore.writeFile(`${capsuleSourceLineRef}.csts.json`, JSON.stringify(csts, null, 2)),
                        cacheStore.writeFile(`${capsuleSourceLineRef}.crts.json`, JSON.stringify(crts, null, 2))
                    ])
                } catch (error) {
                    // Cache write error, continue without failing
                    console.warn(`Warning: Failed to write to cache for ${capsuleSourceLineRef}:`, error)
                }
            }

            return {
                csts,
                crts,
            }
        }
    }
}

// Build a map of imported identifiers
function buildImportMap(sourceFile: ts.SourceFile): Map<string, { importSpecifier: string, moduleUri: string }> {
    const importMap = new Map<string, { importSpecifier: string, moduleUri: string }>()

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text
            const importClause = statement.importClause

            if (importClause) {
                // Handle named imports: import { foo, bar } from 'module'
                if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
                    const elements = importClause.namedBindings.elements

                    for (const element of elements) {
                        const importedName = element.name.text
                        const originalName = element.propertyName ? element.propertyName.text : importedName

                        const importSpecifier = element.propertyName
                            ? `{ ${originalName} as ${importedName} }`
                            : `{ ${importedName} }`

                        importMap.set(importedName, {
                            importSpecifier,
                            moduleUri: moduleSpecifier
                        })
                    }
                }

                // Handle default imports: import foo from 'module'
                if (importClause.name) {
                    const defaultName = importClause.name.text
                    importMap.set(defaultName, {
                        importSpecifier: defaultName,
                        moduleUri: moduleSpecifier
                    })
                }

                // Handle namespace imports: import * as foo from 'module'
                if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
                    const namespaceName = importClause.namedBindings.name.text
                    importMap.set(namespaceName, {
                        importSpecifier: `* as ${namespaceName}`,
                        moduleUri: moduleSpecifier
                    })
                }
            }
        }
    }

    return importMap
}

// Build a map of variables assigned from imported function calls
function buildAssignmentMap(
    sourceFile: ts.SourceFile,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>
): Map<string, { importSpecifier: string, moduleUri: string }> {
    const assignmentMap = new Map<string, { importSpecifier: string, moduleUri: string }>()

    function visit(node: ts.Node) {
        // Look for variable declarations with destructuring from function calls
        // e.g., const { foo, bar } = importedFunction() or const { foo, bar } = await importedFunction()
        if (ts.isVariableDeclaration(node)) {
            let callExpr: ts.CallExpression | undefined

            // Check if it has an initializer that is a call expression or await expression
            if (node.initializer) {
                if (ts.isCallExpression(node.initializer)) {
                    callExpr = node.initializer
                } else if (ts.isAwaitExpression(node.initializer) && ts.isCallExpression(node.initializer.expression)) {
                    callExpr = node.initializer.expression
                }
            }

            if (callExpr) {
                // Check if the function being called is an imported identifier
                if (ts.isIdentifier(callExpr.expression)) {
                    const functionName = callExpr.expression.text
                    const importInfo = importMap.get(functionName)

                    if (importInfo) {
                        // This is a call to an imported function
                        // Track all destructured variables
                        if (ts.isObjectBindingPattern(node.name)) {
                            for (const element of node.name.elements) {
                                if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                                    const varName = element.name.text
                                    assignmentMap.set(varName, {
                                        importSpecifier: importInfo.importSpecifier,
                                        moduleUri: importInfo.moduleUri
                                    })
                                }
                            }
                        }
                    }
                }
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return assignmentMap
}

// Find all encapsulate() call expressions in the source file
function findEncapsulateCalls(sourceFile: ts.SourceFile): ts.CallExpression[] {
    const calls: ts.CallExpression[] = []

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            // Check if it's a call to encapsulate
            if (ts.isIdentifier(node.expression) && node.expression.text === 'encapsulate') {
                calls.push(node)
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return calls
}

// Extract the TypeScript type of a value expression
function extractValueType(valueNode: ts.Expression, sourceFile: ts.SourceFile): string {
    // Check for function expressions
    if (ts.isFunctionExpression(valueNode) || ts.isArrowFunction(valueNode)) {
        return extractFunctionSignature(valueNode, sourceFile)
    }

    // Check for undefined
    if (valueNode.kind === ts.SyntaxKind.UndefinedKeyword) {
        return 'undefined'
    }

    // Check for null
    if (valueNode.kind === ts.SyntaxKind.NullKeyword) {
        return 'null'
    }

    // Check for string literals
    if (ts.isStringLiteral(valueNode)) {
        return 'string'
    }

    // Check for numeric literals
    if (ts.isNumericLiteral(valueNode)) {
        return 'number'
    }

    // Check for boolean literals
    if (valueNode.kind === ts.SyntaxKind.TrueKeyword || valueNode.kind === ts.SyntaxKind.FalseKeyword) {
        return 'boolean'
    }

    // Check for object literals
    if (ts.isObjectLiteralExpression(valueNode)) {
        return 'object'
    }

    // Check for array literals
    if (ts.isArrayLiteralExpression(valueNode)) {
        return 'array'
    }

    // Default to any
    return 'any'
}

// Extract function signature from AST
function extractFunctionSignature(fn: ts.FunctionExpression | ts.ArrowFunction, sourceFile: ts.SourceFile): string {
    const params: string[] = []

    for (const param of fn.parameters) {
        let paramStr = param.dotDotDotToken ? '...' : ''
        paramStr += param.name.getText(sourceFile)
        if (param.type) {
            paramStr += `: ${param.type.getText(sourceFile)}`
        } else {
            paramStr += ': any'
        }
        if (param.questionToken) {
            paramStr = paramStr.replace(':', '?:')
        }
        params.push(paramStr)
    }

    let returnType = 'any'
    if (fn.type) {
        returnType = fn.type.getText(sourceFile)
    }

    return `(${params.join(', ')}) => ${returnType}`
}

// Extract module-local functions and variables that are self-contained
function extractModuleLocalCode(
    ambientReferences: Record<string, any>,
    sourceFile: ts.SourceFile,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    assignmentMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    callNode?: ts.Node
): Record<string, string> {
    const moduleLocalCode: Record<string, string> = {}
    const moduleLocalFunctions = new Map<string, ts.FunctionDeclaration>()
    const moduleLocalVariables = new Map<string, ts.VariableDeclaration>()

    // First, collect all top-level function declarations and variable declarations in the module
    for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name) {
            moduleLocalFunctions.set(statement.name.text, statement)
        }
        // Collect module-level variable declarations
        if (ts.isVariableStatement(statement)) {
            for (const decl of statement.declarationList.declarations) {
                if (ts.isIdentifier(decl.name)) {
                    moduleLocalVariables.set(decl.name.text, decl)
                }
            }
        }
    }

    // Also collect functions from the local scope around the call node
    if (callNode) {
        let currentNode: ts.Node | undefined = callNode
        while (currentNode) {
            if (ts.isFunctionExpression(currentNode) || ts.isArrowFunction(currentNode) || ts.isFunctionDeclaration(currentNode)) {
                if (currentNode.body && ts.isBlock(currentNode.body)) {
                    for (const statement of currentNode.body.statements) {
                        if (ts.isFunctionDeclaration(statement) && statement.name) {
                            moduleLocalFunctions.set(statement.name.text, statement)
                        }
                    }
                }
                break
            }
            currentNode = currentNode.parent
        }
    }

    // Check each ambient reference to see if it's a module-local function or variable
    for (const [name, ref] of Object.entries(ambientReferences)) {
        const refTyped = ref as any

        // Skip if it's not a literal ambient reference or module-local (imports, assignments, etc. are handled elsewhere)
        if (refTyped.type !== 'literal' && refTyped.type !== 'object' && refTyped.type !== 'capsule' && refTyped.type !== 'module-local') {
            continue
        }

        // Check if this identifier refers to a module-local function
        const funcDecl = moduleLocalFunctions.get(name)
        if (funcDecl) {
            // Analyze the function to see if it's self-contained
            const dependencies = new Set<string>()
            const isContained = analyzeFunctionDependencies(funcDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, dependencies)

            if (isContained) {
                // Mark this as module-local in ambient references
                refTyped.type = 'module-local'

                // Collect the function code and all its dependencies
                const collectedCode: string[] = []
                const processed = new Set<string>()

                function collectFunction(fnName: string) {
                    if (processed.has(fnName)) return
                    processed.add(fnName)

                    const fn = moduleLocalFunctions.get(fnName)
                    if (fn) {
                        const fnCode = fn.getText(sourceFile)
                        collectedCode.push(fnCode)
                        // Also add each function as a separate entry in moduleLocalCode
                        if (!moduleLocalCode[fnName]) {
                            moduleLocalCode[fnName] = fnCode
                        }
                    }
                }

                // Collect the main function
                collectFunction(name)

                // Collect all dependencies
                for (const dep of dependencies) {
                    collectFunction(dep)
                }

                // Store the collected code (main function with all dependencies)
                moduleLocalCode[name] = collectedCode.join('\n\n')
            }
            continue
        }

        // Check if this identifier refers to a module-local variable
        const varDecl = moduleLocalVariables.get(name)
        if (varDecl) {
            // Analyze the variable to see if it's self-contained
            const varDependencies = analyzeVariableDependencies(varDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, moduleLocalVariables)

            if (varDependencies.isContained) {
                // Mark this as module-local in ambient references
                refTyped.type = 'module-local'

                // Get the variable declaration code
                // We need to get the full variable statement (const/let/var KEYS_DIR = ...)
                const varStatement = varDecl.parent?.parent
                if (varStatement && ts.isVariableStatement(varStatement)) {
                    moduleLocalCode[name] = varStatement.getText(sourceFile)
                } else {
                    // Fallback to just the declaration
                    moduleLocalCode[name] = varDecl.getText(sourceFile)
                }
            }
        }
    }

    // Also process any module-local functions that weren't in ambient references
    // but might be dependencies of other functions
    for (const [fnName, funcDecl] of moduleLocalFunctions.entries()) {
        // Skip if already processed
        if (moduleLocalCode[fnName]) continue

        // Analyze if it's self-contained
        const dependencies = new Set<string>()
        const isContained = analyzeFunctionDependencies(funcDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, dependencies)

        if (isContained) {
            // Add this function to moduleLocalCode
            moduleLocalCode[fnName] = funcDecl.getText(sourceFile)
        }
    }

    return moduleLocalCode
}

// Analyze if a function is self-contained (only depends on other module-local functions or builtins)
function analyzeFunctionDependencies(
    funcDecl: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    assignmentMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    moduleLocalFunctions: Map<string, ts.FunctionDeclaration>,
    dependencies: Set<string>
): boolean {
    const localIdentifiers = new Set<string>()
    const nestedFunctionScopes = new Map<ts.Node, Set<string>>()

    // Collect parameter names from the main function
    if (funcDecl.parameters) {
        for (const param of funcDecl.parameters) {
            extractBindingIdentifiersForAnalysis(param.name, localIdentifiers)
        }
    }

    let isContained = true

    // First pass: collect all nested function declarations and their scopes
    function collectNestedFunctions(node: ts.Node, currentScope: Set<string>) {
        // Track variable declarations in current scope
        if (ts.isVariableDeclaration(node)) {
            extractBindingIdentifiersForAnalysis(node.name, currentScope)
        }

        // Track nested function declarations
        if (ts.isFunctionDeclaration(node) && node.name) {
            currentScope.add(node.name.text)
            // Create a new scope for this nested function
            const nestedScope = new Set<string>(currentScope)
            nestedFunctionScopes.set(node, nestedScope)
            // Add parameters to nested scope
            for (const param of node.parameters) {
                extractBindingIdentifiersForAnalysis(param.name, nestedScope)
            }
            // Continue traversing within the nested function
            if (node.body) {
                ts.forEachChild(node.body, (child) => collectNestedFunctions(child, nestedScope))
            }
            return // Don't traverse children again
        }

        // Track nested function expressions and arrow functions
        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            const nestedScope = new Set<string>(currentScope)
            nestedFunctionScopes.set(node, nestedScope)
            // Add parameters to nested scope
            for (const param of node.parameters) {
                extractBindingIdentifiersForAnalysis(param.name, nestedScope)
            }
            // Add function name if it's a named function expression
            if (ts.isFunctionExpression(node) && node.name) {
                nestedScope.add(node.name.text)
            }
            // Continue traversing within the nested function
            if (node.body) {
                if (ts.isBlock(node.body)) {
                    ts.forEachChild(node.body, (child) => collectNestedFunctions(child, nestedScope))
                }
            }
            return // Don't traverse children again
        }

        ts.forEachChild(node, (child) => collectNestedFunctions(child, currentScope))
    }

    // Collect nested functions and their scopes
    if (funcDecl.body) {
        collectNestedFunctions(funcDecl.body, localIdentifiers)
    }

    // Second pass: check for external dependencies
    function visit(node: ts.Node, currentScope: Set<string> = localIdentifiers) {
        // Skip type nodes to avoid false positives from type annotations
        if (ts.isTypeNode(node)) {
            return
        }

        // Use the appropriate scope for nested functions
        if (nestedFunctionScopes.has(node)) {
            currentScope = nestedFunctionScopes.get(node)!
        }

        // Check identifiers
        if (ts.isIdentifier(node)) {
            const identifierName = node.text

            // Skip special keywords and local identifiers
            if (identifierName === 'this' || identifierName === 'undefined' || identifierName === 'null' ||
                identifierName === 'arguments' || currentScope.has(identifierName)) {
                return
            }

            // Skip property access names
            const parent = node.parent
            if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
                return
            }

            // Skip property names in object literals
            if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
                return
            }

            // Skip shorthand property assignments where the identifier is both key and value
            if (parent && ts.isShorthandPropertyAssignment(parent)) {
                return
            }

            // Check if it's an import or assignment - track as dependency
            if (importMap.has(identifierName)) {
                dependencies.add(identifierName)
                return
            }

            if (assignmentMap.has(identifierName)) {
                dependencies.add(identifierName)
                return
            }

            // Check if it's a module-local function - add as dependency
            if (moduleLocalFunctions.has(identifierName)) {
                dependencies.add(identifierName)
                return
            }

            // Check if it's a module-global builtin - allowed
            if (MODULE_GLOBAL_BUILTINS.has(identifierName)) {
                return
            }

            // Unknown external reference - not self-contained
            isContained = false
        }

        ts.forEachChild(node, (child) => visit(child, currentScope))
    }

    if (funcDecl.body) {
        visit(funcDecl.body)
    }

    return isContained
}

// Analyze if a variable declaration is self-contained (only depends on imports and builtins)
// Returns whether it's contained and the import dependencies needed
function analyzeVariableDependencies(
    varDecl: ts.VariableDeclaration,
    sourceFile: ts.SourceFile,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    assignmentMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    moduleLocalFunctions: Map<string, ts.FunctionDeclaration>,
    moduleLocalVariables: Map<string, ts.VariableDeclaration>
): { isContained: boolean, importDependencies: Map<string, { importSpecifier: string, moduleUri: string }> } {
    const importDependencies = new Map<string, { importSpecifier: string, moduleUri: string }>()
    let isContained = true

    if (!varDecl.initializer) {
        // No initializer means it's just a declaration, treat as contained
        return { isContained: true, importDependencies }
    }

    function visit(node: ts.Node) {
        // Skip type nodes
        if (ts.isTypeNode(node)) {
            return
        }

        if (ts.isIdentifier(node)) {
            const identifierName = node.text

            // Skip special keywords
            if (identifierName === 'this' || identifierName === 'undefined' || identifierName === 'null') {
                return
            }

            // Skip property access names
            const parent = node.parent
            if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
                return
            }

            // Skip property names in object literals
            if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
                return
            }

            // Check if it's an import - track as dependency
            const importInfo = importMap.get(identifierName)
            if (importInfo) {
                importDependencies.set(identifierName, importInfo)
                return
            }

            // Check if it's an assignment from import
            const assignmentInfo = assignmentMap.get(identifierName)
            if (assignmentInfo) {
                importDependencies.set(identifierName, assignmentInfo)
                return
            }

            // Check if it's a module-global builtin - allowed
            if (MODULE_GLOBAL_BUILTINS.has(identifierName)) {
                return
            }

            // Check if it's another module-local variable - recursively analyze
            if (moduleLocalVariables.has(identifierName)) {
                // For now, allow references to other module-local variables
                // A more complete implementation would recursively analyze
                return
            }

            // Check if it's a module-local function - allowed
            if (moduleLocalFunctions.has(identifierName)) {
                return
            }

            // Unknown external reference - not self-contained
            isContained = false
        }

        ts.forEachChild(node, visit)
    }

    visit(varDecl.initializer)

    return { isContained, importDependencies }
}

// Helper to extract binding identifiers for analysis
function extractBindingIdentifiersForAnalysis(name: ts.BindingName, targetSet: Set<string>) {
    if (ts.isIdentifier(name)) {
        targetSet.add(name.text)
    } else if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
            if (ts.isBindingElement(element)) {
                extractBindingIdentifiersForAnalysis(element.name, targetSet)
            }
        }
    } else if (ts.isArrayBindingPattern(name)) {
        for (const element of name.elements) {
            if (ts.isBindingElement(element)) {
                extractBindingIdentifiersForAnalysis(element.name, targetSet)
            }
        }
    }
}

// Extract ambient references from the entire encapsulate call
function extractCapsuleAmbientReferences(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    runtimeAmbientRefs: Record<string, any> | undefined,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    assignmentMap: Map<string, { importSpecifier: string, moduleUri: string }>
): Record<string, any> {
    const ambientRefs: Record<string, any> = {}
    const localIdentifiers = new Set<string>()
    const propertyNames = new Set<string>()
    const invocationParameters = new Set<string>()
    const moduleLocalFunctions = new Map<string, ts.FunctionDeclaration>()
    const moduleLocalVariables = new Map<string, ts.VariableDeclaration>()

    // Collect module-local functions and variables from module top-level
    for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name) {
            moduleLocalFunctions.set(statement.name.text, statement)
        }
        // Collect module-level variable declarations
        if (ts.isVariableStatement(statement)) {
            for (const decl of statement.declarationList.declarations) {
                if (ts.isIdentifier(decl.name)) {
                    moduleLocalVariables.set(decl.name.text, decl)
                }
            }
        }
    }

    // Find enclosing function and collect its parameters and local functions
    let currentNode: ts.Node | undefined = call
    let enclosingBlock: ts.Block | undefined
    while (currentNode) {
        if (ts.isFunctionExpression(currentNode) || ts.isArrowFunction(currentNode) || ts.isFunctionDeclaration(currentNode)) {
            // Extract parameter names from this function
            for (const param of currentNode.parameters) {
                extractParameterNames(param.name, invocationParameters)
            }
            // Get the function body to collect local functions
            if (currentNode.body && ts.isBlock(currentNode.body)) {
                enclosingBlock = currentNode.body
            }
            break
        }
        currentNode = currentNode.parent
    }

    // Collect function declarations from the enclosing block
    if (enclosingBlock) {
        for (const statement of enclosingBlock.statements) {
            if (ts.isFunctionDeclaration(statement) && statement.name) {
                moduleLocalFunctions.set(statement.name.text, statement)
            }
        }
    }

    // Helper to extract parameter names from binding patterns
    function extractParameterNames(name: ts.BindingName, targetSet: Set<string>) {
        if (ts.isIdentifier(name)) {
            targetSet.add(name.text)
        } else if (ts.isObjectBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractParameterNames(element.name, targetSet)
                }
            }
        } else if (ts.isArrayBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractParameterNames(element.name, targetSet)
                }
            }
        }
    }

    // First pass: collect property names and local identifiers
    function collectNames(node: ts.Node) {
        // Track property names in object literals
        if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
            propertyNames.add(node.name.text)
        }

        // Track variable declarations within the call
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            localIdentifiers.add(node.name.text)
        }

        ts.forEachChild(node, collectNames)
    }

    collectNames(call)

    // Extract CSS imports from comments in the entire call
    // Pattern: /* import "./file.css"; */ or /* import './file.css' */ (with or without semicolon)
    const callText = call.getText(sourceFile)
    const cssImportPattern = /\/\*\s*import\s+["']([^"']+\.css)["']\s*;?\s*\*\//g
    let match

    while ((match = cssImportPattern.exec(callText)) !== null) {
        const cssPath = match[1]

        // Add CSS import to ambient references if not already present
        if (!ambientRefs[cssPath]) {
            ambientRefs[cssPath] = {
                type: 'import',
                importSpecifier: `'${cssPath}'`,
                moduleUri: cssPath
            }
        }
    }

    // Second pass: find identifiers used as values (not property names)
    function visit(node: ts.Node) {
        // Check for identifiers that might be ambient references
        if (ts.isIdentifier(node)) {
            const identifierName = node.text

            // Skip 'this', 'encapsulate', and other special keywords
            if (identifierName === 'this' || identifierName === 'undefined' || identifierName === 'null' || identifierName === 'encapsulate' || identifierName === 'import') {
                return
            }

            // Skip if it's part of import.meta (MetaProperty node)
            const parent = node.parent
            if (parent && parent.kind === ts.SyntaxKind.MetaProperty) {
                return
            }

            // Skip if it's a property name
            if (propertyNames.has(identifierName)) {
                return
            }

            // Skip if it's a local identifier (local variable)
            if (localIdentifiers.has(identifierName)) {
                return
            }

            // Skip if it's a property access (e.g., this.username)
            if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
                return
            }

            // Skip if it's a property name in an object literal
            if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
                return
            }

            // Check if we already added this reference
            if (ambientRefs[identifierName]) {
                return
            }

            // Check if this is an imported identifier
            const importInfo = importMap.get(identifierName)
            if (importInfo) {
                // This is an import
                ambientRefs[identifierName] = {
                    type: 'import',
                    importSpecifier: importInfo.importSpecifier,
                    moduleUri: importInfo.moduleUri
                }
            } else {
                // Check if this is an assigned variable from an imported function call
                const assignmentInfo = assignmentMap.get(identifierName)
                if (assignmentInfo) {
                    // This is assigned from an imported function
                    ambientRefs[identifierName] = {
                        type: 'assigned',
                        importSpecifier: assignmentInfo.importSpecifier,
                        moduleUri: assignmentInfo.moduleUri
                    }
                } else if (invocationParameters.has(identifierName)) {
                    // This is an invocation argument (parameter from enclosing function)
                    ambientRefs[identifierName] = {
                        type: 'invocation-argument',
                        isEncapsulateExport: ENCAPSULATE_MODULE_EXPORTS.has(identifierName)
                    }
                } else {
                    // Check if it's a module-local function
                    const funcDecl = moduleLocalFunctions.get(identifierName)
                    if (funcDecl) {
                        // Analyze if it's self-contained
                        const dependencies = new Set<string>()
                        const isContained = analyzeFunctionDependencies(funcDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, dependencies)

                        if (isContained) {
                            // Mark as module-local
                            ambientRefs[identifierName] = {
                                type: 'module-local'
                            }
                            return
                        }
                    }

                    // Check if it's a module-local variable (const/let/var at module level)
                    const varDecl = moduleLocalVariables.get(identifierName)
                    if (varDecl) {
                        // Analyze the variable's initializer for dependencies
                        const varDependencies = analyzeVariableDependencies(varDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, moduleLocalVariables)

                        if (varDependencies.isContained) {
                            // Mark as module-local and add any import dependencies to ambientRefs
                            ambientRefs[identifierName] = {
                                type: 'module-local'
                            }

                            // Add import dependencies from the variable's initializer
                            for (const [depName, depInfo] of varDependencies.importDependencies) {
                                if (!ambientRefs[depName]) {
                                    ambientRefs[depName] = {
                                        type: 'import',
                                        importSpecifier: depInfo.importSpecifier,
                                        moduleUri: depInfo.moduleUri
                                    }
                                }
                            }
                            return
                        }
                    }

                    // This is a literal ambient reference
                    // Check if the ambient reference is provided
                    if (runtimeAmbientRefs && identifierName in runtimeAmbientRefs) {
                        const value = runtimeAmbientRefs[identifierName]

                        if (isLiteralType(value)) {
                            ambientRefs[identifierName] = {
                                type: 'literal',
                                value
                            }
                        } else
                            if (isCapsuleInstance(value)) {
                                ambientRefs[identifierName] = {
                                    type: 'capsule',
                                    value: value.toCapsuleReference()
                                }
                            } else {
                                ambientRefs[identifierName] = {
                                    type: 'object',
                                    value
                                }
                            }
                    }
                    // If not provided, skip validation - it might be defined later or in outer scope
                }
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(call)
    return ambientRefs
}

// Extract ambient references and validate them against runtime-provided values
function extractAndValidateAmbientReferences(
    fn: ts.FunctionExpression | ts.ArrowFunction,
    sourceFile: ts.SourceFile,
    runtimeAmbientRefs: Record<string, any> | undefined,
    propName: string,
    spineContractName: string,
    importMap: Map<string, { importSpecifier: string, moduleUri: string }>,
    assignmentMap: Map<string, { importSpecifier: string, moduleUri: string }>
): Record<string, any> {
    // Build module-local functions map for checking
    const moduleLocalFunctions = new Map<string, ts.FunctionDeclaration>()
    // Build module-local variables map for checking (const/let/var declarations at module level)
    const moduleLocalVariables = new Map<string, ts.VariableDeclaration>()

    // Collect top-level module functions and variables
    for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name) {
            moduleLocalFunctions.set(statement.name.text, statement)
        }
        // Collect module-level variable declarations
        if (ts.isVariableStatement(statement)) {
            for (const decl of statement.declarationList.declarations) {
                if (ts.isIdentifier(decl.name)) {
                    moduleLocalVariables.set(decl.name.text, decl)
                }
            }
        }
    }

    const ambientRefs: Record<string, any> = {}
    const localIdentifiers = new Set<string>()
    const invocationParameters = new Set<string>()

    // Find enclosing function and collect its parameters as invocation arguments and local functions
    let currentNode: ts.Node | undefined = fn
    let enclosingBlock: ts.Block | undefined
    while (currentNode) {
        if (ts.isFunctionExpression(currentNode) || ts.isArrowFunction(currentNode) || ts.isFunctionDeclaration(currentNode)) {
            // Skip the current function itself, look for parent functions
            if (currentNode !== fn) {
                for (const param of currentNode.parameters) {
                    extractParameterNamesForInvocation(param.name, invocationParameters)
                }
                // Get the function body to collect local functions
                if (currentNode.body && ts.isBlock(currentNode.body)) {
                    enclosingBlock = currentNode.body
                }
                break
            }
        }
        currentNode = currentNode.parent
    }

    // Collect function declarations from the enclosing block
    if (enclosingBlock) {
        for (const statement of enclosingBlock.statements) {
            if (ts.isFunctionDeclaration(statement) && statement.name) {
                moduleLocalFunctions.set(statement.name.text, statement)
            }
        }
    }

    // Helper to extract parameter names for invocation detection
    function extractParameterNamesForInvocation(name: ts.BindingName, targetSet: Set<string>) {
        if (ts.isIdentifier(name)) {
            targetSet.add(name.text)
        } else if (ts.isObjectBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractParameterNamesForInvocation(element.name, targetSet)
                }
            }
        } else if (ts.isArrayBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractParameterNamesForInvocation(element.name, targetSet)
                }
            }
        }
    }

    // Helper to extract identifiers from binding patterns
    function extractBindingIdentifiers(name: ts.BindingName) {
        if (ts.isIdentifier(name)) {
            localIdentifiers.add(name.text)
        } else if (ts.isArrayBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractBindingIdentifiers(element.name)
                }
            }
        } else if (ts.isObjectBindingPattern(name)) {
            for (const element of name.elements) {
                if (ts.isBindingElement(element)) {
                    extractBindingIdentifiers(element.name)
                }
            }
        }
    }

    // Collect parameter names as local identifiers
    for (const param of fn.parameters) {
        extractBindingIdentifiers(param.name)
    }

    // Traverse the function body to find identifiers
    function visit(node: ts.Node) {
        // Skip type nodes to avoid false positives from type annotations
        if (ts.isTypeNode(node)) {
            return
        }

        // Track variable declarations within the function
        if (ts.isVariableDeclaration(node)) {
            extractBindingIdentifiers(node.name)
        }

        // Track function declarations
        if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
            localIdentifiers.add(node.name.text)
            // Also track parameters from nested function declarations
            for (const param of node.parameters) {
                extractBindingIdentifiers(param.name)
            }
        }

        // Track named function expressions (e.g., function Counter() {})
        if (ts.isFunctionExpression(node) && node.name && ts.isIdentifier(node.name)) {
            localIdentifiers.add(node.name.text)
        }

        // Track parameters from nested arrow functions and function expressions
        // This prevents false positives where callback parameters are treated as ambient references
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            for (const param of node.parameters) {
                extractBindingIdentifiers(param.name)
            }
        }

        // Track for...in and for...of loop variables
        if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
            const initializer = node.initializer
            if (ts.isVariableDeclarationList(initializer)) {
                for (const declaration of initializer.declarations) {
                    extractBindingIdentifiers(declaration.name)
                }
            }
        }

        // Check for identifiers that might be ambient references
        if (ts.isIdentifier(node)) {
            const identifierName = node.text

            // Skip 'this' and other special keywords
            if (identifierName === 'this' || identifierName === 'undefined' || identifierName === 'null' || identifierName === 'arguments') {
                return
            }

            // Skip if it's a local identifier (parameter or local variable)
            if (localIdentifiers.has(identifierName)) {
                return
            }

            // Skip if it's a property access (e.g., this.username)
            const parent = node.parent

            // Skip if it's part of import.meta (MetaProperty node)
            if (parent && parent.kind === ts.SyntaxKind.MetaProperty) {
                return
            }

            if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
                return
            }

            // Skip if it's a JSX attribute name
            if (parent && ts.isJsxAttribute(parent) && parent.name === node) {
                return
            }

            // Skip if it's a property name in an object literal
            if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
                return
            }

            // Skip if it's a parameter name (not a reference, but a declaration)
            if (parent && ts.isParameter(parent) && parent.name === node) {
                return
            }

            // Skip if this is a capsule['#'] pattern - the capsule name reference
            // These references are resolved at encapsulation time and replaced with the actual string value
            if (parent && ts.isElementAccessExpression(parent) && parent.expression === node) {
                const arg = parent.argumentExpression
                if (arg && ts.isStringLiteral(arg) && arg.text === '#') {
                    return
                }
            }

            // Check if we already added this reference
            if (ambientRefs[identifierName]) {
                return
            }

            // Check if this is an imported identifier
            const importInfo = importMap.get(identifierName)
            if (importInfo) {
                // This is an import
                ambientRefs[identifierName] = {
                    type: 'import',
                    importSpecifier: importInfo.importSpecifier,
                    moduleUri: importInfo.moduleUri
                }
            } else {
                // Check if this is an assigned variable from an imported function call
                const assignmentInfo = assignmentMap.get(identifierName)
                if (assignmentInfo) {
                    // This is assigned from an imported function
                    ambientRefs[identifierName] = {
                        type: 'assigned',
                        importSpecifier: assignmentInfo.importSpecifier,
                        moduleUri: assignmentInfo.moduleUri
                    }
                } else if (MODULE_GLOBAL_BUILTINS.has(identifierName)) {
                    // This is a native JavaScript API (console, setTimeout, etc.)
                    // Record it but don't require explicit declaration
                    ambientRefs[identifierName] = {
                        type: 'module-global'
                    }
                } else if (invocationParameters.has(identifierName)) {
                    // This is an invocation argument (parameter from enclosing function)
                    ambientRefs[identifierName] = {
                        type: 'invocation-argument',
                        isEncapsulateExport: ENCAPSULATE_MODULE_EXPORTS.has(identifierName)
                    }
                } else {
                    // Check if it's a module-local function
                    const funcDecl = moduleLocalFunctions.get(identifierName)
                    if (funcDecl) {
                        // Analyze if it's self-contained
                        const dependencies = new Set<string>()
                        const isContained = analyzeFunctionDependencies(funcDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, dependencies)

                        if (isContained) {
                            // Mark as module-local
                            ambientRefs[identifierName] = {
                                type: 'module-local'
                            }
                            return
                        }
                    }

                    // Check if it's a module-local variable (const/let/var at module level)
                    const varDecl = moduleLocalVariables.get(identifierName)
                    if (varDecl) {
                        // Analyze the variable's initializer for dependencies
                        const varDependencies = analyzeVariableDependencies(varDecl, sourceFile, importMap, assignmentMap, moduleLocalFunctions, moduleLocalVariables)

                        if (varDependencies.isContained) {
                            // Mark as module-local and add any import dependencies to ambientRefs
                            ambientRefs[identifierName] = {
                                type: 'module-local'
                            }

                            // Add import dependencies from the variable's initializer
                            for (const [depName, depInfo] of varDependencies.importDependencies) {
                                if (!ambientRefs[depName]) {
                                    ambientRefs[depName] = {
                                        type: 'import',
                                        importSpecifier: depInfo.importSpecifier,
                                        moduleUri: depInfo.moduleUri
                                    }
                                }
                            }
                            return
                        }
                    }

                    // Check if this is a JSX intrinsic element (like 'div', 'button', etc.) in a .tsx/.jsx file
                    const fileName = sourceFile.fileName
                    const isJsxFile = fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
                    if (isJsxFile && node.parent && (ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent))) {
                        // This is a JSX intrinsic element, record it but don't require validation
                        ambientRefs[identifierName] = {
                            type: 'jsx'
                        }
                        return
                    }

                    // This is a literal ambient reference
                    // Validate that the ambient reference is provided
                    if (!runtimeAmbientRefs || !(identifierName in runtimeAmbientRefs)) {
                        throw new Error(
                            `Ambient reference '${identifierName}' used in property '${propName}' of spineContract '${spineContractName}' ` +
                            `is not provided in encapsulate options.ambientReferences`
                        )
                    }

                    const value = runtimeAmbientRefs[identifierName]

                    // Validate that the value is a literal type or an instance
                    if (!isLiteralType(value) && !isCapsuleInstance(value)) {
                        throw new Error(
                            `Ambient reference '${identifierName}' used in property '${propName}' of spineContract '${spineContractName}' ` +
                            `must be a literal type (string, number, boolean, null, or undefined) or an instance, got: ${typeof value}`
                        )
                    }

                    // Add to ambient references with the value
                    // For instances (capsules, functions, or non-literal objects), use '[instance]' as the value
                    ambientRefs[identifierName] = {
                        type: isLiteralType(value) ? 'literal' : 'instance',
                        value: isLiteralType(value) ? value : '[instance]'
                    }
                }
            }
        }

        ts.forEachChild(node, visit)
    }

    if (fn.body) {
        // Extract CSS imports from comments in function body
        // Pattern: /* import "./file.css"; */ or /* import './file.css' */ (with or without semicolon)
        const functionBodyText = fn.body.getText(sourceFile)
        const cssImportPattern = /\/\*\s*import\s+["']([^"']+\.css)["']\s*;?\s*\*\//g
        let match

        while ((match = cssImportPattern.exec(functionBodyText)) !== null) {
            const cssPath = match[1]

            // Add CSS import to ambient references if not already present
            if (!ambientRefs[cssPath]) {
                ambientRefs[cssPath] = {
                    type: 'import',
                    importSpecifier: `'${cssPath}'`,
                    moduleUri: cssPath
                }
            }
        }

        visit(fn.body)
    }

    return ambientRefs
}

// Check if a value is a literal type
function isLiteralType(value: any): boolean {
    const type = typeof value
    return (
        type === 'string' ||
        type === 'number' ||
        type === 'boolean' ||
        value === null ||
        value === undefined
    )
}

// Check if a value is an instance (object with capsuleSourceLineRef property)
function isCapsuleInstance(value: any): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.toCapsuleReference === 'function'
    )
}
