export function AppLoading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50" role="status">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-2 text-gray-500">加载中...</p>
      </div>
    </div>
  )
}
