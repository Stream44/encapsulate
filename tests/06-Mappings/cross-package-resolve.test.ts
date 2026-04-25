
import { it, expect } from 'bun:test'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { CapsuleSpineFactory } from "../../src/spine-factories/CapsuleSpineFactory"
import { CapsuleSpineContract } from "../../src/spine-contracts/CapsuleSpineContract.v0/Static"
import { capsule as rootCapsuleFn } from './cross-package-consumer/root-capsule'


it('Cross-package mapping resolves correctly when cst.source.moduleFilepath is relative to a different root', async function () {

    // This test reproduces a bug where cst.source.moduleFilepath is relative to a
    // different (broader) package root than the consuming spine's spineFilesystemRoot.
    //
    // Real-world scenario: L3-model-server (narrow spineRoot) maps to capsules in
    // L4-space-models (sibling dir). The CST cache stores moduleFilepath relative to
    // FramespaceGenesis/ (the broad root), e.g. "L4-space-models/Capsular/ModelEngines.ts".
    // But the narrow spine needs "../L4-space-models/Capsular/ModelEngines.ts".
    // join(narrowRoot, "L4-space-models/...") produces a wrong path.
    //
    // Reproduction strategy:
    // 1. First pass: use a BROAD spineRoot (the parent 06-Mappings/ dir) to populate
    //    the static analysis cache. The CST moduleFilepath for sibling-capsule.ts
    //    will be "cross-package-sibling/sibling-capsule.ts" (no "../" prefix).
    // 2. Second pass: use a NARROW spineRoot (cross-package-consumer/) that reads the
    //    cached CST. Now cst.source.moduleFilepath is "cross-package-sibling/..."
    //    but encapsulateOptions.moduleFilepath is "../cross-package-sibling/...".
    //    Without the fallback fix, join(narrowRoot, "cross-package-sibling/...")
    //    produces "cross-package-consumer/cross-package-sibling/..." which doesn't exist.

    const narrowRoot = join(import.meta.dir, 'cross-package-consumer')
    const broadRoot = import.meta.dir

    // Clean cache to ensure fresh state
    try { rmSync(join(narrowRoot, '.~o'), { recursive: true }) } catch { }

    // --- Pass 1: Broad spineRoot to populate CST cache ---
    {
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: broadRoot,
            capsuleModuleProjectionRoot: narrowRoot,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const rootCapsule = await rootCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })
        const result = await run({}, async ({ apis }: any) => {
            return apis[rootCapsule.capsuleSourceLineRef].run()
        })

        // Sanity: broad root works fine
        expect(result).toBe('sibling:leaf-ok')
    }

    // --- Pass 2: Narrow spineRoot reuses cached CSTs from broad root ---
    // The CST cache in narrowRoot/.~o/ now has moduleFilepath values relative to
    // broadRoot (e.g. "cross-package-sibling/sibling-capsule.ts"), but the narrow
    // spine needs them relative to narrowRoot ("../cross-package-sibling/...").
    {
        const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
            spineFilesystemRoot: narrowRoot,
            capsuleModuleProjectionRoot: narrowRoot,
            spineContracts: {
                ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
            }
        })

        const rootCapsule = await rootCapsuleFn({ encapsulate, CapsulePropertyTypes, makeImportStack })

        const { run } = await hoistSnapshot({ snapshot: await freeze() })
        const result = await run({}, async ({ apis }: any) => {
            return apis[rootCapsule.capsuleSourceLineRef].run()
        })

        // This fails without the fallback fix in Static.ts resolveMappedCapsule:
        // "[encapsulate resolve] Cannot resolve '.../cross-package-consumer/cross-package-sibling/...'"
        expect(result).toBe('sibling:leaf-ok')
    }
})
