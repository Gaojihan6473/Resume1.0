import { useEffect } from 'react'
import type { ResumeAgentStore } from '../../store/resumeAgentSessionStore'
import { useApplicationStore } from '../../store/applicationStore'
import type { ResumeData } from '../../types/resume'

export function useResumeAgentValidity(agent: ResumeAgentStore, base: ResumeData, isDirty: boolean) {
  const applications = useApplicationStore((state) => state.applications)
  const jdText = agent.jobSource === 'manual' ? agent.jdText
    : applications.find((item) => item.id === agent.applicationId)?.jobDescription ?? null
  const { validateInputs, runId, resumeHash, jdHash } = agent
  useEffect(() => {
    if (runId) void validateInputs(base, jdText)
  }, [base, jdText, runId, resumeHash, jdHash, validateInputs])
  return !isDirty && agent.inputsValid && agent.validatedBase === base && agent.validatedJdText === jdText
}
