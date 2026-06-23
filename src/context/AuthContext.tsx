import { createContext, useContext, useState, ReactNode } from 'react';
import { User, login as apiLogin } from '@/lib/api';

interface AuthCtx {
  user: User | null;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const signIn = async (loginName: string, password: string) => {
    const { token, user } = await apiLogin(loginName, password);
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(user.id));
    localStorage.setItem('user', JSON.stringify(user));
    setUserState(user);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setUserState(null);
  };

  const setUser = (u: User) => {
    localStorage.setItem('user', JSON.stringify(u));
    setUserState(u);
  };

  return <Ctx.Provider value={{ user, signIn, signOut, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
