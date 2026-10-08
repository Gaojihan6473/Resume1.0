import { useEffect } from 'react'
import type { ResumeAgentStore } from '../../store/resumeAgentSessionStore'
import { useResumeStore } from '../../store/resumeStore'
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
  const resumes = useResumeStore((state) => state.cachedResumes)
  const currentBatch = resumes.find((item) => item.id === agent.resumeId)?.batch_id
  const selectedApplication = applications.find((item) => item.id === agent.applicationId)
  const batchValid = (!agent.batchId || currentBatch === agent.batchId) && (!currentBatch || !selectedApplication || selectedApplication.batch_id === currentBatch)
  return batchValid && !isDirty && agent.inputsValid && agent.validatedBase === base && agent.validatedJdText === jdText
}
