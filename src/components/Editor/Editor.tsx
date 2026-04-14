import { BasicInfoEditor } from './BasicInfo'
import { EducationEditor } from './Education'
import { InternshipEditor } from './Internship'
import { ProjectEditor } from './Project'
import { SummaryEditor } from './Summary'
import { SkillsEditor } from './Skills'

export function Editor() {
  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <BasicInfoEditor />
      <EducationEditor />
      <InternshipEditor />
      <ProjectEditor />
      <SummaryEditor />
      <SkillsEditor />
    </div>
  )
}
