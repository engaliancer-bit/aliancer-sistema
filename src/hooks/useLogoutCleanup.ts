import { useEffect, useCallback } from 'react';
import { globalMemoryCleanup } from '../lib/memoryCleanup';
import { useAppCache } from '../contexts/AppCacheContext';
import { supabase } from '../lib/supabase';

export function useLogoutCleanup() {
  const { clearAllCache } = useAppCache();

  const handleLogout = useCallback(async () => {
    console.log('[Logout] Iniciando processo de logout com limpeza...');

    clearAllCache();

    await globalMemoryCleanup.cleanupOnLogout();

    console.log('[Logout] Processo de logout concluído');

    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [clearAllCache]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[Cleanup] Página ficou inativa, executando limpeza preventiva...');
        globalMemoryCleanup.cleanupAll().catch(err => {
          console.error('[Cleanup] Erro na limpeza preventiva:', err);
        });
      }
    };

    const handleBeforeUnload = () => {
      console.log('[Cleanup] Página sendo fechada, executando limpeza...');
      globalMemoryCleanup.cleanupAll().catch(err => {
        console.error('[Cleanup] Erro na limpeza ao fechar:', err);
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          console.log('[Auth] Usuário deslogado, executando limpeza completa...');
          clearAllCache();
          await globalMemoryCleanup.cleanupAll();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [clearAllCache]);

  return {
    logout: handleLogout,
    getMemoryStats: () => globalMemoryCleanup.getStats(),
  };
}

export function usePageVisibility(onVisible?: () => void, onHidden?: () => void) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onVisible?.();
      } else {
        onHidden?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisible, onHidden]);
}

export function useIdleCleanup(idleTimeMs: number = 5 * 60 * 1000) {
  useEffect(() => {
    let idleTimer: number;
    let isIdle = false;

    const resetTimer = () => {
      clearTimeout(idleTimer);

      if (isIdle) {
        console.log('[Cleanup] Usuário voltou a ser ativo');
        isIdle = false;
      }

      idleTimer = window.setTimeout(() => {
        if (!isIdle) {
          console.log('[Cleanup] Usuário inativo há', idleTimeMs / 1000, 'segundos');
          isIdle = true;

          globalMemoryCleanup.cleanupAll().then(() => {
            console.log('[Cleanup] Limpeza automática por inatividade concluída');
          }).catch(err => {
            console.error('[Cleanup] Erro na limpeza por inatividade:', err);
          });
        }
      }, idleTimeMs);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [idleTimeMs]);
}
