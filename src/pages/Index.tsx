import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  fetchUsers, createAccount, setUserStatus, changePassword, updateProfile,
  fetchConversations, fetchMessages, sendMessage, createDialog, pollSignals,
  AdminUser, AuditEntry, Conversation, Message, User,
} from '@/lib/api';
import CallModal, { CallMode } from '@/components/CallModal';

type Tab = 'chats' | 'admin' | 'profile' | 'settings';

const LOGO = 'https://cdn.poehali.dev/projects/2189e8a9-b402-49f2-9003-9d72d6b6b61a/bucket/7cf0a125-afe0-4a0e-b726-aea598f66611.png';
const avatarColors = ['bg-blue-600', 'bg-rose-600', 'bg-slate-700', 'bg-indigo-600', 'bg-cyan-700'];
const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const Index = () => {
  const { user, signOut, setUser } = useAuth();
  const [tab, setTab] = useState<Tab>('chats');
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <aside className="w-16 md:w-20 shrink-0 border-r border-border flex flex-col items-center py-4 md:py-6 gap-1.5 bg-card">
        <div className="mb-2">
          <img src={LOGO} alt="CoonChat" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
        </div>
        {([
          { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
          ...(isAdmin ? [{ id: 'admin', icon: 'ShieldCheck', label: 'Админ' }] : []),
          { id: 'profile', icon: 'User', label: 'Профиль' },
          { id: 'settings', icon: 'Settings', label: 'Настр.' },
        ] as { id: Tab; icon: string; label: string }[]).map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
              tab === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <Icon name={item.icon} size={18} />
            <span className="text-[9px] md:text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button onClick={signOut}
          className="mt-auto w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Icon name="LogOut" size={18} />
          <span className="text-[9px] md:text-[10px] font-medium">Выход</span>
        </button>
      </aside>

      {tab === 'chats' && <ChatsView />}
      {tab === 'admin' && isAdmin && <AdminView />}
      {tab === 'profile' && <ProfileView onUpdate={setUser} />}
      {tab === 'settings' && <SettingsView />}
    </div>
  );
};

/* ---------- Chats ---------- */
interface CallState {
  conversationId: number;
  recipientId: number;
  recipientName: string;
  mode: CallMode;
  isIncoming: boolean;
  incomingSignalId?: number;
}

const ChatsView = () => {
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newLogin, setNewLogin] = useState('');
  const [newLoading, setNewLoading] = useState(false);
  const [call, setCall] = useState<CallState | null>(null);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSigIdRef = useRef<number>(0);

  const loadConvs = () =>
    fetchConversations()
      .then((c) => { setConvs(c); if (c[0] && active == null) setActive(c[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { loadConvs(); }, []);

  // Polling входящих звонков по всем диалогам
  useEffect(() => {
    if (call) return;
    incomingPollRef.current = setInterval(async () => {
      for (const conv of convs) {
        if (!conv.other_user_id) continue;
        try {
          const sigs = await pollSignals(conv.id, lastSigIdRef.current);
          const callSig = sigs.find(s => s.type === 'call' && s.sender_id !== user?.id);
          if (callSig) {
            lastSigIdRef.current = callSig.id;
            setCall({
              conversationId: conv.id,
              recipientId: callSig.sender_id,
              recipientName: conv.title,
              mode: (callSig.payload?.mode as CallMode) || 'audio',
              isIncoming: true,
              incomingSignalId: callSig.id,
            });
            break;
          }
          if (sigs.length) lastSigIdRef.current = sigs[sigs.length - 1].id;
        } catch { /* ignore */ }
      }
    }, 2000);
    return () => { if (incomingPollRef.current) clearInterval(incomingPollRef.current); };
  }, [convs, call, user?.id]);

  useEffect(() => {
    if (active != null) fetchMessages(active).then(setMessages).catch(() => {});
  }, [active]);

  const send = async () => {
    if (!text.trim() || active == null) return;
    const body = text.trim();
    setText('');
    try {
      await sendMessage(active, body);
      setMessages(await fetchMessages(active));
    } catch {
      toast.error('Не удалось отправить');
    }
  };

  const startDialog = async () => {
    if (!newLogin.trim()) return;
    setNewLoading(true);
    try {
      const res = await createDialog(newLogin.trim());
      toast.success(res.already_exists ? 'Диалог уже существует' : `Диалог с ${res.title} создан`);
      setShowNew(false);
      setNewLogin('');
      await loadConvs();
      setActive(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setNewLoading(false);
    }
  };

  const activeConv = convs.find((c) => c.id === active);

  return (
    <>
      <section className="w-64 md:w-80 shrink-0 border-r border-border flex flex-col bg-card">
        <header className="px-4 md:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-0.5 h-5 rounded-full bg-red-500 inline-block" />
              <h1 className="font-display text-xl font-600 uppercase tracking-wide">Чаты</h1>
            </div>
            <button
              onClick={() => setShowNew(!showNew)}
              title="Новый диалог"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showNew ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            >
              <Icon name="SquarePen" size={16} />
            </button>
          </div>

          {showNew && (
            <div className="mt-3 animate-fade-in">
              <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">Логин собеседника</p>
              <div className="flex gap-2">
                <input
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startDialog()}
                  placeholder="например: ivan"
                  autoFocus
                  className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                />
                <button
                  onClick={startDialog}
                  disabled={newLoading}
                  className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {newLoading ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="ArrowRight" size={15} />}
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Поиск" className="w-full bg-secondary rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-2 md:px-3 pb-4 space-y-1">
          {loading && <p className="text-center text-xs text-muted-foreground py-8">Загрузка...</p>}
          {!loading && convs.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8 px-4">Пока нет диалогов. Их создаёт администратор.</p>
          )}
          {convs.map((c, i) => (
            <button key={c.id} onClick={() => setActive(c.id)}
              className={`w-full flex items-center gap-3 p-2.5 md:p-3 rounded-xl text-left transition-colors ${active === c.id ? 'bg-accent' : 'hover:bg-secondary'}`}>
              <div className={`w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-sm font-semibold`}>
                {initials(c.title)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-sm truncate">{c.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{c.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <main className="flex-1 flex flex-col bg-background min-w-0">
        {activeConv ? (
          <>
            <header className="h-[65px] border-b border-border px-4 md:px-6 flex items-center gap-3 bg-card">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">{initials(activeConv.title)}</div>
              <div className="flex-1">
                <div className="font-medium text-sm">{activeConv.title}</div>
                <div className="text-xs text-primary">локальный сервер</div>
              </div>
              {activeConv.other_user_id && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCall({ conversationId: activeConv.id, recipientId: activeConv.other_user_id!, recipientName: activeConv.title, mode: 'audio', isIncoming: false })}
                    className="w-9 h-9 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center transition-colors"
                    title="Аудиозвонок">
                    <Icon name="Phone" size={17} />
                  </button>
                  <button
                    onClick={() => setCall({ conversationId: activeConv.id, recipientId: activeConv.other_user_id!, recipientName: activeConv.title, mode: 'video', isIncoming: false })}
                    className="w-9 h-9 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center transition-colors"
                    title="Видеозвонок">
                    <Icon name="Video" size={17} />
                  </button>
                </div>
              )}
            </header>
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-3">
              {messages.map((m, i) => (
                <div key={m.id} className={`flex ${m.me ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: 'backwards' }}>
                  <div className={`max-w-[75%] md:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.me ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                    {!m.me && <span className="block text-[11px] font-semibold text-primary mb-0.5">{m.sender_name}</span>}
                    {m.body}
                    <span className={`block text-[10px] mt-1 ${m.me ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{m.time}</span>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Нет сообщений</p>}
            </div>
            <footer className="p-3 md:p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 bg-secondary rounded-xl px-2 md:px-3 py-1.5">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Сообщение..." className="flex-1 bg-transparent outline-none text-sm py-2 px-2" />
                <button onClick={send} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden">
                  <img src="https://cdn.poehali.dev/projects/2189e8a9-b402-49f2-9003-9d72d6b6b61a/bucket/dac09d13-dd77-4b3e-8e81-f1d8889018fe.png" alt="send" className="w-7 h-7 object-contain invert" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Выберите диалог</div>
        )}
      </main>

      {call && (
        <CallModal
          conversationId={call.conversationId}
          recipientId={call.recipientId}
          recipientName={call.recipientName}
          mode={call.mode}
          isIncoming={call.isIncoming}
          incomingSignalId={call.incomingSignalId}
          onClose={() => setCall(null)}
        />
      )}
    </>
  );
};

/* ---------- Admin ---------- */
const AdminView = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ login: '', display_name: '', password: '', role: 'user' });

  const load = () => fetchUsers().then((d) => { setUsers(d.users); setAudit(d.audit); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.login || !form.display_name || !form.password) { toast.error('Заполните все поля'); return; }
    try {
      await createAccount(form);
      toast.success('Учётная запись создана');
      setForm({ login: '', display_name: '', password: '', role: 'user' });
      setShowForm(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };

  const toggleStatus = async (u: AdminUser) => {
    try { await setUserStatus(u.id, u.status === 'active' ? 'blocked' : 'active'); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };

  const typeColor: Record<string, string> = {
    create: 'text-blue-400 bg-blue-500/15', edit: 'text-slate-300 bg-slate-500/15',
    block: 'text-red-400 bg-red-500/15', view: 'text-indigo-400 bg-indigo-500/15',
  };
  const typeIcon: Record<string, string> = { create: 'Plus', block: 'Ban', view: 'Eye', edit: 'Pencil' };

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-10 py-6 md:py-10 animate-slide-up">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="w-1 h-6 rounded-full bg-red-500 inline-block" />
              <h1 className="font-display text-2xl font-600 uppercase tracking-wide">Администрация</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-4">Управление пользователями · аудит · CoonChat</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-display uppercase tracking-wide hover:bg-blue-500 transition-colors">
            <Icon name="UserPlus" size={16} /> Выдать аккаунт
          </button>
        </div>
        <div className="mb-6" />

        {showForm && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6 animate-fade-in">
            <h2 className="font-display uppercase text-sm tracking-wide mb-4">Новая учётная запись</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="Логин" className="bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Имя пользователя" className="bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Пароль" className="bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="user">Пользователь</option>
                <option value="moderator">Модератор</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={create} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Создать</button>
              <button onClick={() => setShowForm(false)} className="bg-secondary px-4 py-2 rounded-lg text-sm">Отмена</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {[
            { label: 'Учётных записей', value: users.length, icon: 'Users' },
            { label: 'Активны', value: users.filter((u) => u.status === 'active').length, icon: 'Activity' },
            { label: 'Заблокировано', value: users.filter((u) => u.status === 'blocked').length, icon: 'ShieldX' },
            { label: 'Записей в логе', value: audit.length, icon: 'ScrollText' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 md:p-5">
              <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center mb-3"><Icon name={s.icon} size={18} /></div>
              <div className="text-2xl font-display font-600">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2"><Icon name="Users" size={16} className="text-primary" /><h2 className="font-display uppercase text-sm tracking-wide">Учётные записи</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Логин</th><th className="px-5 py-3 font-medium">Имя</th>
                <th className="px-5 py-3 font-medium">Роль</th><th className="px-5 py-3 font-medium">Статус</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-secondary/50">
                    <td className="px-5 py-3 font-mono text-xs">{u.login}</td>
                    <td className="px-5 py-3 font-medium">{u.display_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.role === 'admin' ? 'Админ' : u.role === 'moderator' ? 'Модератор' : 'Пользователь'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${u.status === 'active' ? 'text-blue-400 bg-blue-500/15' : 'text-red-400 bg-red-500/15'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-blue-400' : 'bg-red-400'}`} />
                        {u.status === 'active' ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.login !== user?.login && (
                        <button onClick={() => toggleStatus(u)} className="text-xs text-muted-foreground hover:text-destructive">
                          {u.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2"><Icon name="ScrollText" size={16} className="text-primary" /><h2 className="font-display uppercase text-sm tracking-wide">Аудит действий администратора</h2></div>
          <div className="divide-y divide-border">
            {audit.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Нет записей</p>}
            {audit.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center gap-4 hover:bg-secondary/50">
                <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${typeColor[l.type] || typeColor.edit}`}><Icon name={typeIcon[l.type] || 'Pencil'} size={14} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{l.action} <span className="font-mono text-xs text-muted-foreground">· {l.target}</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">Инициатор: {l.admin}</div>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{l.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

/* ---------- Profile ---------- */
const ProfileView = ({ onUpdate }: { onUpdate: (u: User) => void }) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [oldShow, setOldShow] = useState(false);
  const [pass, setPass] = useState('');

  const saveProfile = async () => {
    try { await updateProfile(name, bio); onUpdate({ ...user!, display_name: name, bio }); toast.success('Профиль обновлён'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };
  const savePass = async () => {
    if (pass.length < 4) { toast.error('Пароль слишком короткий'); return; }
    try { await changePassword(pass); setPass(''); setOldShow(false); toast.success('Пароль изменён'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-10 py-8 md:py-12 animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-1 h-6 rounded-full bg-red-500 inline-block" />
          <h1 className="font-display text-2xl font-600 uppercase tracking-wide">Профиль</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 flex items-center gap-5 mb-6">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-display">{initials(user?.display_name || '?')}</div>
          <div>
            <div className="text-lg font-semibold">{user?.display_name}</div>
            <div className="text-sm text-muted-foreground font-mono">{user?.login}</div>
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary bg-accent px-2.5 py-1 rounded-full">
              <Icon name="ShieldCheck" size={12} /> {user?.role === 'admin' ? 'Администратор' : user?.role === 'moderator' ? 'Модератор' : 'Пользователь'}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-display uppercase text-sm tracking-wide">Редактировать профиль</h2>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Отображаемое имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">О себе</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <button onClick={saveProfile} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Сохранить</button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-display uppercase text-sm tracking-wide">Смена пароля</h2>
          {!oldShow ? (
            <button onClick={() => setOldShow(true)} className="flex items-center gap-2 text-sm text-primary font-medium"><Icon name="KeyRound" size={16} /> Изменить пароль</button>
          ) : (
            <div className="space-y-3">
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Новый пароль" className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="flex gap-2">
                <button onClick={savePass} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Сохранить пароль</button>
                <button onClick={() => { setOldShow(false); setPass(''); }} className="bg-secondary px-4 py-2 rounded-lg text-sm">Отмена</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

/* ---------- Settings ---------- */
const SettingsView = () => (
  <main className="flex-1 overflow-y-auto bg-background">
    <div className="max-w-2xl mx-auto px-4 md:px-10 py-8 md:py-12 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-6 rounded-full bg-red-500 inline-block" />
        <h1 className="font-display text-2xl font-600 uppercase tracking-wide">Настройки</h1>
      </div>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {[
          { icon: 'Bell', label: 'Уведомления', value: 'Включены' },
          { icon: 'Server', label: 'Сервер', value: 'Локальный' },
          { icon: 'Smartphone', label: 'Установить на телефон', value: 'PWA' },
          { icon: 'Globe', label: 'Язык', value: 'Русский' },
        ].map((row) => (
          <div key={row.label} className="w-full flex items-center gap-4 px-6 py-4">
            <Icon name={row.icon} size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{row.label}</span>
            <span className="text-sm text-muted-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
        Чтобы установить приложение на Android: откройте меню браузера и выберите «Установить приложение» / «Добавить на главный экран».
      </p>
    </div>
  </main>
);

export default Index;