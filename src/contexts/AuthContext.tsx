import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (import.meta.env.DEV) {
          console.log('[AuthContext] Initial session check:', {
            hasSession: !!initialSession,
            userId: initialSession?.user?.id,
            error: error?.message
          });
        }

        if (mounted && !error) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      } catch (error: any) {
        console.error('[AuthContext] Error getting initial session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Auth state changed:', {
            event,
            hasSession: !!currentSession,
            userId: currentSession?.user?.id,
            timestamp: new Date().toISOString()
          });
        }

        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }

        if (event === 'SIGNED_IN') {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] User signed in successfully');
          }
        }

        if (event === 'SIGNED_OUT') {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] User signed out');
          }
          if (mounted) {
            setSession(null);
            setUser(null);
          }
        }

        if (event === 'TOKEN_REFRESHED') {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] Token refreshed successfully');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();

      if (import.meta.env.DEV) {
        console.log('[AuthContext] Manual session refresh:', {
          success: !error,
          hasSession: !!refreshedSession,
          error: error?.message
        });
      }

      if (!error && refreshedSession) {
        setSession(refreshedSession);
        setUser(refreshedSession.user);
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing session:', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    isAuthenticated: !!session && !!user,
    signOut,
    refreshSession
  }), [user, session, loading, signOut, refreshSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
