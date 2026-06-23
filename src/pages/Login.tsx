import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';

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
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5" />
      <div className="absolute -bottom-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-destructive/5" />

      <div className="w-full max-w-sm relative animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg mb-5 relative">
            <Icon name="Lock" size={28} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive border-2 border-background" />
          </div>
          <h1 className="font-display text-3xl font-700 tracking-wide uppercase text-foreground">
            Мессенджер
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Защищённый локальный сервер</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">Логин</label>
            <div className="relative">
              <Icon name="User" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Введите логин"
                autoComplete="username"
                className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">Пароль</label>
            <div className="relative">
              <Icon name="KeyRound" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
              <Icon name="TriangleAlert" size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-display uppercase tracking-wider rounded-lg py-3.5 text-sm font-600 hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="LogIn" size={18} />}
            Войти
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
          Учётные записи выдаёт администратор.<br />
          Самостоятельная регистрация недоступна.
        </p>
      </div>
    </div>
  );
};

export default Login;
