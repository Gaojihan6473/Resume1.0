import type { Resume } from '../../lib/api'
import { ResumePreviewCard } from './ResumePreviewCard'

interface Props {
  resumes: Resume[]
  selectedResumeId: string | null
  onSelectResume: (id: string) => void
  onEditResume?: (resume: Resume) => void
}

export function ResumeSelector({
  resumes,
  selectedResumeId,
  onSelectResume,
  onEditResume,
}: Props) {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId)
  const otherResumes = resumes.filter((r) => r.id !== selectedResumeId)
  const hasSelected = !!selectedResume

  const handleResumeClick = (resumeId: string) => {
    if (selectedResumeId === resumeId) {
      onSelectResume('')
    } else {
      onSelectResume(resumeId)
    }
  }

  return (
    <div className="relative h-full">
      <div
        className={`absolute inset-0 transition-all duration-300 ease-out ${
          hasSelected ? 'opacity-0 scale-[0.985] translate-y-1 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        <div className="grid grid-cols-2 gap-3 pb-4">
          {resumes.map((resume) => (
            <ResumePreviewCard
              key={resume.id}
              resume={resume}
              isSelected={false}
              isMinimized={false}
              onClick={() => handleResumeClick(resume.id)}
              onEdit={() => onEditResume?.(resume)}
            />
          ))}
        </div>
      </div>

      <div
        className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out ${
          hasSelected ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[1.01] -translate-y-1 pointer-events-none'
        }`}
      >
        {selectedResume && (
          <>
            <div className="flex-1 min-h-0 pb-4">
              <ResumePreviewCard
                resume={selectedResume}
                isSelected={true}
                isMinimized={false}
                onClick={() => handleResumeClick(selectedResume.id)}
                onEdit={() => onEditResume?.(selectedResume)}
              />
            </div>

            {otherResumes.length > 0 && (
              <div className="flex-shrink-0 mt-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {otherResumes.map((resume) => (
                    <ResumePreviewCard
                      key={resume.id}
                      resume={resume}
                      isSelected={false}
                      isMinimized={true}
                      onClick={() => handleResumeClick(resume.id)}
                      onEdit={() => onEditResume?.(resume)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
