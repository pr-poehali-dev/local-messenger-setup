import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';

const LOGO = 'https://cdn.poehali.dev/projects/2189e8a9-b402-49f2-9003-9d72d6b6b61a/bucket/7cf0a125-afe0-4a0e-b726-aea598f66611.png';

const Login = () => {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(login.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/6 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-red-600/6 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <img src={LOGO} alt="CoonChat" className="w-36 h-36 object-contain drop-shadow-2xl" />
          <div className="mt-2 text-center">
            <div className="font-display text-3xl font-700 tracking-widest uppercase leading-none">
              <span className="text-foreground">Coo</span>
              <span className="text-red-500">N</span>
              <span className="text-foreground">Cha</span>
              <span className="text-primary">T</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 tracking-[0.2em] uppercase">Защищённый мессенджер</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Логин"
              autoComplete="username"
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <Icon name="KeyRound" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
              <Icon name="TriangleAlert" size={15} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-display uppercase tracking-widest rounded-lg py-3.5 text-sm font-600 hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          >
            {loading ? <Icon name="Loader2" size={17} className="animate-spin" /> : <Icon name="LogIn" size={17} />}
            Войти
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground tracking-widest uppercase">CoonChat</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Учётные записи выдаёт только администратор.<br />
          Самостоятельная регистрация недоступна.
        </p>
      </div>
    </div>
  );
};

export default Login;
