export default function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 animate-pulse">
      <div className="bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-8 bg-white/20 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-white/10 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="p-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl shadow-lg animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-400 rounded-lg"></div>
                <div className="h-6 bg-gray-400 rounded w-3/4 mx-auto"></div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center mt-12">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[#0A7EC2] border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-8 border-4 border-[#0968A8] border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">Carregando módulo...</p>
            <p className="text-sm text-gray-500 mt-1">Aguarde um momento</p>
          </div>
        </div>
      </div>
    </div>
  );
}
