import { Lock, X } from 'lucide-react'

interface AuthRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: () => void
}

export function AuthRequiredModal({
  isOpen,
  onClose,
  onLogin,
}: AuthRequiredModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">需要登录</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          此操作需要登录后才能使用。请先登录以继续。
        </p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <Lock className="w-5 h-5" />
            登录
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
