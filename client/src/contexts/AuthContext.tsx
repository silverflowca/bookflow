import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';
import supabase from '../lib/supabase';
import type { User, Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;

    // onAuthStateChange fires immediately with the current session,
    // then again on any token refresh, login, or logout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        api.setToken(session.access_token);
        if (!initialized) {
          initialized = true;
          loadProfile();
        }
      } else {
        initialized = true;
        api.setToken(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setProfile(data.profile);
    } catch (err) {
      console.error('Auth check failed:', err);
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await api.login(email, password);
    // api.login() calls api.setToken() internally; also sign in to Supabase
    // so onAuthStateChange fires and keeps the client session in sync
    if (data.session?.access_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    setUser(data.user);
    setProfile(data.profile || null);
  }

  async function register(email: string, password: string, displayName: string) {
    const data = await api.register(email, password, displayName);
    if (data.session?.access_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    setUser(data.user);
    setProfile(data.profile || null);
  }

  async function logout() {
    await api.logout();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(data: Partial<Profile>) {
    const updated = await api.updateProfile(data);
    setProfile(updated);
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      login,
      register,
      logout,
      updateProfile
    }}>
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
