import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      subscribedRef.current = false;
    }

    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        if (import.meta.env.DEV) {
          console.log('[AuthContext] Auth state changed:', {
            event,
            hasSession: !!currentSession,
            userId: currentSession?.user?.id,
            timestamp: new Date().toISOString()
          });
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }

        setLoading(false);

        if (import.meta.env.DEV) {
          if (event === 'SIGNED_IN') console.log('[AuthContext] User signed in successfully');
          if (event === 'TOKEN_REFRESHED') console.log('[AuthContext] Token refreshed successfully');
        }
      }
    );

    subscriptionRef.current = subscription;

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

    return () => {
      mounted = false;
      subscription.unsubscribe();
      subscriptionRef.current = null;
      subscribedRef.current = false;
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
