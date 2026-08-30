import type { ResumeAgentPatch } from '../types/resumeAgent'

export const MAX_VISIBLE_HIGH_RISK_PATCHES = 2

export function getVisibleResumeAgentPatches(patches: ResumeAgentPatch[]): ResumeAgentPatch[] {
  const visibleHighRiskPatches = new Set(
    patches.filter((patch) => patch.risk === 'high').slice(0, MAX_VISIBLE_HIGH_RISK_PATCHES),
  )
  return patches.filter((patch) => patch.risk !== 'high' || visibleHighRiskPatches.has(patch))
}

export function countPendingResumeAgentPatches(
  patches: ResumeAgentPatch[],
  acceptedPatchKeys: string[],
  rejectedPatchKeys: string[],
): number {
  const decided = new Set([...acceptedPatchKeys, ...rejectedPatchKeys])
  return getVisibleResumeAgentPatches(patches).filter((patch) => !decided.has(patch.key)).length
}
