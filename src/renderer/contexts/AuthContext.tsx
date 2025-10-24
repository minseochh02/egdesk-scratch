import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  user_metadata?: any;
  app_metadata?: any;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 AuthContext: Initializing...');
    
    // Get initial session
    const initAuth = async () => {
      try {
        console.log('🔐 AuthContext: Fetching initial session...');
        const result = await window.electron.auth.getSession();
        console.log('🔐 AuthContext: Initial session result:', { 
          success: result.success, 
          hasSession: !!result.session,
          hasUser: !!result.user 
        });
        
        if (result.success && result.session) {
          console.log('🔐 AuthContext: Setting initial session');
          setSession(result.session);
          setUser(result.user);
        }
      } catch (error) {
        console.error('🔐 AuthContext: Failed to get initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    console.log('🔐 AuthContext: Setting up auth state listener...');
    const unsubscribe = window.electron.auth.onAuthStateChanged((data) => {
      console.log('🔐 AuthContext: Auth state changed event received!', data);
      console.log('🔐 AuthContext: Event details:', { 
        success: data.success, 
        hasSession: !!data.session,
        hasUser: !!data.user 
      });
      
      if (data.success && data.session) {
        console.log('🔐 AuthContext: Updating auth state with new session');
        setSession(data.session);
        setUser(data.user);
        setLoading(false);
      } else {
        console.log('🔐 AuthContext: Clearing auth state');
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    console.log('🔐 AuthContext: Auth state listener set up successfully');

    return () => {
      console.log('🔐 AuthContext: Cleaning up auth state listener');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await window.electron.auth.signInWithGoogle();
      if (!result.success) {
        console.error('Google sign-in failed:', result.error);
        throw new Error(result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithGithub = async () => {
    try {
      const result = await window.electron.auth.signInWithGithub();
      if (!result.success) {
        console.error('GitHub sign-in failed:', result.error);
        throw new Error(result.error || 'GitHub sign-in failed');
      }
    } catch (error: any) {
      console.error('Error signing in with GitHub:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const result = await window.electron.auth.signOut();
      if (result.success) {
        setSession(null);
        setUser(null);
      } else {
        console.error('Sign out failed:', result.error);
        throw new Error(result.error || 'Sign out failed');
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithGithub,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

