{process.env.NODE_ENV === 'development' && (
  <>
    <MemoryDiagnostics />
    <QueryPerformanceMonitor />
    <SupabaseConnectionMonitor />
    <MemoryLeakMonitor />
    <AuthDiagnostics />
  </>
)}