import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function AuthDiagnostics() {
  const { user, session, isAuthenticated, loading, refreshSession } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (import.meta.env.PROD) {
    return null;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSession();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 text-xs font-medium z-50"
        title="Abrir diagnóstico de autenticação"
      >
        Auth Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-4 z-50 max-w-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-gray-900">Auth Diagnostics (DEV)</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        {/* Status Geral */}
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
          {isAuthenticated ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className="font-medium">
            Status: {isAuthenticated ? 'Autenticado' : 'Não Autenticado'}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-700">Carregando sessão...</span>
          </div>
        )}

        {/* User Info */}
        <div className="p-2 bg-gray-50 rounded">
          <div className="font-medium text-gray-700 mb-1">Usuário:</div>
          {user ? (
            <div className="space-y-1 text-gray-600">
              <div>ID: {user.id.substring(0, 8)}...</div>
              <div>Email: {user.email}</div>
            </div>
          ) : (
            <div className="text-gray-500 italic">Nenhum usuário</div>
          )}
        </div>

        {/* Session Info */}
        <div className="p-2 bg-gray-50 rounded">
          <div className="font-medium text-gray-700 mb-1">Sessão:</div>
          {session ? (
            <div className="space-y-1 text-gray-600">
              <div>Access Token: {session.access_token.substring(0, 20)}...</div>
              <div>
                Expira em:{' '}
                {session.expires_at
                  ? new Date(session.expires_at * 1000).toLocaleString('pt-BR')
                  : 'N/A'}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic">Nenhuma sessão</div>
          )}
        </div>

        {/* LocalStorage Info */}
        <div className="p-2 bg-gray-50 rounded">
          <div className="font-medium text-gray-700 mb-1">LocalStorage:</div>
          <div className="text-gray-600">
            Keys:{' '}
            {Object.keys(localStorage)
              .filter((k) => k.includes('supabase') || k.includes('auth'))
              .length}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              console.log('[AuthDiagnostics] Full session:', session);
              console.log('[AuthDiagnostics] Full user:', user);
              console.log('[AuthDiagnostics] LocalStorage:', { ...localStorage });
            }}
            className="flex-1 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Log Console
          </button>
        </div>
      </div>
    </div>
  );
}
