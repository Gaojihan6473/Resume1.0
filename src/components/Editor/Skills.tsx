import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { X, Code, Globe, Award, Heart } from 'lucide-react'

function TagInput({
  label,
  tags,
  onChange,
  icon: Icon,
  color,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="animate-slide-in">
      <label className="flex items-center gap-1.5 text-sm text-gray-700 mb-2">
        <div className={`w-6 h-6 rounded-md ${color} flex items-center justify-center transition-transform duration-200 hover:scale-110`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg tag-chip animate-scale-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((_, i) => i !== index))}
              className="hover:text-red-500 transition-colors rounded-full hover:bg-red-50 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="输入后按回车添加"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all input-glow bg-gray-50 hover:bg-gray-100 focus:bg-white"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const value = (e.target as HTMLInputElement).value.trim()
            if (value && !tags.includes(value)) {
              onChange([...tags, value])
              ;(e.target as HTMLInputElement).value = ''
            }
          }
        }}
      />
    </div>
  )
}

export function SkillsEditor() {
  const { resumeData, updateSkills } = useResumeStore()
  const { skills } = resumeData

  return (
    <SortableModuleWrapper id="skills" title="技能与其他">
      <div className="grid grid-cols-2 gap-5">
        <TagInput
          label="技术技能"
          tags={skills.technical}
          onChange={(technical) => updateSkills({ technical })}
          icon={Code}
          color="bg-blue-50 text-blue-500"
        />

        <TagInput
          label="语言能力"
          tags={skills.languages}
          onChange={(languages) => updateSkills({ languages })}
          icon={Globe}
          color="bg-green-50 text-green-500"
        />

        <TagInput
          label="证书资格"
          tags={skills.certificates}
          onChange={(certificates) => updateSkills({ certificates })}
          icon={Award}
          color="bg-purple-50 text-purple-500"
        />

        <TagInput
          label="兴趣爱好"
          tags={skills.interests}
          onChange={(interests) => updateSkills({ interests })}
          icon={Heart}
          color="bg-pink-50 text-pink-500"
        />
      </div>
    </SortableModuleWrapper>
  )
}