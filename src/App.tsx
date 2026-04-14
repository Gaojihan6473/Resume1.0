import { useRef } from 'react'
import { useResumeStore } from './store/resumeStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { Upload } from './components/Upload/Upload'

function App() {
  const { parseStatus } = useResumeStore()
  const previewRef = useRef<HTMLDivElement>(null)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar previewRef={previewRef} />

      <div className="flex-1 flex overflow-hidden">
        {parseStatus === 'idle' || parseStatus === 'parsing' ? (
          <div className="w-full flex items-center justify-center">
            <Upload />
          </div>
        ) : (
          <>
            <div className="w-[45%] border-r border-gray-200 overflow-hidden flex flex-col bg-white">
              <Editor />
            </div>
            <div className="w-[55%] preview-container bg-gray-100">
              <Preview ref={previewRef} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
