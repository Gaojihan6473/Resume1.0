import { useRef, useState } from 'react'
import { useResumeStore } from './store/resumeStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { HomePage } from './pages/HomePage'
import { Sidebar } from './components/Sidebar/Sidebar'

function App() {
  const { parseStatus } = useResumeStore()
  const previewRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {parseStatus === 'idle' || parseStatus === 'parsing' ? (
        <HomePage
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 工具栏 */}
          <Toolbar
            previewRef={previewRef}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          {/* 侧边栏 + 主内容，放在同一 relative 容器中 */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* 侧边栏：topOffset=0 因为父容器已在 toolbar 下方；backdropTop=56 对齐 toolbar 底部 */}
            <Sidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              topOffset={0}
              backdropTop={56}
              onGoHome={() => {
                useResumeStore.getState().resetAll()
                setSidebarOpen(false)
              }}
            />

            {/* 主内容 */}
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[45%] border-r border-gray-200 overflow-hidden flex flex-col bg-white">
                <Editor />
              </div>
              <div className="w-[55%] preview-container bg-gray-100">
                <Preview ref={previewRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
