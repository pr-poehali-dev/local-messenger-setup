import { useState } from 'react';
import Icon from '@/components/ui/icon';

type Tab = 'chats' | 'admin' | 'profile' | 'settings';

const chats = [
  { id: 1, name: 'Отдел продаж', last: 'Отправил отчёт за квартал', time: '14:32', unread: 3, online: true, initials: 'ОП', color: 'bg-emerald-500' },
  { id: 2, name: 'Анна Сергеева', last: 'Хорошо, договорились', time: '13:05', unread: 0, online: true, initials: 'АС', color: 'bg-sky-500' },
  { id: 3, name: 'IT-поддержка', last: 'Сервер перезапущен', time: '11:48', unread: 1, online: false, initials: 'IT', color: 'bg-violet-500' },
  { id: 4, name: 'Дмитрий Орлов', last: 'Жду документы до конца дня', time: '10:20', unread: 0, online: false, initials: 'ДО', color: 'bg-amber-500' },
  { id: 5, name: 'Общий канал', last: 'Совещание перенесено на 16:00', time: 'Вчера', unread: 0, online: true, initials: 'ОК', color: 'bg-rose-500' },
];

const messages = [
  { id: 1, me: false, text: 'Привет! Подготовил отчёт за квартал, отправляю.', time: '14:28' },
  { id: 2, me: false, text: 'Документ в защищённом контуре, доступен только внутри сети.', time: '14:29' },
  { id: 3, me: true, text: 'Отлично, спасибо! Сейчас посмотрю.', time: '14:30' },
  { id: 4, me: true, text: 'Всё корректно. Цифры по региону можно детализировать?', time: '14:31' },
  { id: 5, me: false, text: 'Конечно, добавлю разбивку и пришлю обновлённую версию.', time: '14:32' },
];

const accounts = [
  { id: 1, login: 'a.sergeeva', name: 'Анна Сергеева', role: 'Пользователь', status: 'active', last: '2 мин назад' },
  { id: 2, login: 'd.orlov', name: 'Дмитрий Орлов', role: 'Пользователь', status: 'active', last: '15 мин назад' },
  { id: 3, login: 'it.support', name: 'IT-поддержка', role: 'Модератор', status: 'active', last: '1 ч назад' },
  { id: 4, login: 'guest.04', name: 'Гостевой доступ', role: 'Гость', status: 'blocked', last: '3 дня назад' },
];

const auditLog = [
  { id: 1, action: 'Создана учётная запись', target: 'a.sergeeva', admin: 'admin', time: '23.06 · 14:02', type: 'create' },
  { id: 2, action: 'Сброшен пароль', target: 'd.orlov', admin: 'admin', time: '23.06 · 13:40', type: 'edit' },
  { id: 3, action: 'Заблокирован аккаунт', target: 'guest.04', admin: 'admin', time: '23.06 · 11:18', type: 'block' },
  { id: 4, action: 'Выгружена история чата', target: 'Отдел продаж', admin: 'admin', time: '23.06 · 09:55', type: 'view' },
  { id: 5, action: 'Изменена роль на «Модератор»', target: 'it.support', admin: 'admin', time: '22.06 · 17:30', type: 'edit' },
];

const navItems: { id: Tab; icon: string; label: string }[] = [
  { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
  { id: 'admin', icon: 'ShieldCheck', label: 'Админ' },
  { id: 'profile', icon: 'User', label: 'Профиль' },
  { id: 'settings', icon: 'Settings', label: 'Настройки' },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>('chats');
  const [activeChat, setActiveChat] = useState(1);

  const typeColor: Record<string, string> = {
    create: 'text-emerald-600 bg-emerald-50',
    edit: 'text-amber-600 bg-amber-50',
    block: 'text-rose-600 bg-rose-50',
    view: 'text-sky-600 bg-sky-50',
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Rail */}
      <aside className="w-20 shrink-0 border-r border-border flex flex-col items-center py-6 gap-2 bg-card">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-4 shadow-sm">
          <Icon name="Lock" size={20} />
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              tab === item.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Icon name={item.icon} size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <div className="mt-auto w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
          АД
        </div>
      </aside>

      {tab === 'chats' && (
        <>
          {/* Chat list */}
          <section className="w-80 shrink-0 border-r border-border flex flex-col bg-card">
            <header className="px-6 pt-6 pb-4">
              <h1 className="text-xl font-semibold tracking-tight">Чаты</h1>
              <div className="mt-4 relative">
                <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Поиск"
                  className="w-full bg-secondary rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChat(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    activeChat === c.id ? 'bg-accent' : 'hover:bg-secondary'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-full ${c.color} flex items-center justify-center text-white text-sm font-semibold`}>
                      {c.initials}
                    </div>
                    {c.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{c.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Conversation */}
          <main className="flex-1 flex flex-col bg-background">
            <header className="h-[73px] border-b border-border px-6 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-semibold">ОП</div>
                <div>
                  <div className="font-medium text-sm">Отдел продаж</div>
                  <div className="text-xs text-emerald-600">в сети · 4 участника</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                {['Phone', 'Video', 'Search', 'MoreVertical'].map((i) => (
                  <button key={i} className="w-9 h-9 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
                    <Icon name={i} size={18} />
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              <div className="text-center">
                <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">Сегодня</span>
              </div>
              {messages.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex ${m.me ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <div
                    className={`max-w-[60%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.me
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border rounded-bl-md'
                    }`}
                  >
                    {m.text}
                    <span className={`block text-[10px] mt-1 ${m.me ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {m.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <footer className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-1.5">
                <button className="w-9 h-9 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground transition-colors">
                  <Icon name="Paperclip" size={18} />
                </button>
                <input
                  placeholder="Сообщение..."
                  className="flex-1 bg-transparent outline-none text-sm py-2 placeholder:text-muted-foreground"
                />
                <button className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
                  <Icon name="Send" size={16} />
                </button>
              </div>
            </footer>
          </main>
        </>
      )}

      {tab === 'admin' && (
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-5xl mx-auto px-10 py-10 animate-slide-up">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-semibold tracking-tight">Администрация</h1>
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Icon name="UserPlus" size={16} />
                Выдать учётную запись
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-8">Управление пользователями, история и аудит действий</p>

            <div className="grid grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Учётных записей', value: '24', icon: 'Users' },
                { label: 'Активны сейчас', value: '8', icon: 'Activity' },
                { label: 'Сообщений за день', value: '1 203', icon: 'MessageSquare' },
                { label: 'Заблокировано', value: '2', icon: 'ShieldX' },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-5">
                  <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center mb-3">
                    <Icon name={s.icon} size={18} />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Accounts */}
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <Icon name="Users" size={16} className="text-primary" />
                <h2 className="font-medium text-sm">Учётные записи</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Логин</th>
                    <th className="px-6 py-3 font-medium">Имя</th>
                    <th className="px-6 py-3 font-medium">Роль</th>
                    <th className="px-6 py-3 font-medium">Активность</th>
                    <th className="px-6 py-3 font-medium">Статус</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-xs">{a.login}</td>
                      <td className="px-6 py-3.5 font-medium">{a.name}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{a.role}</td>
                      <td className="px-6 py-3.5 text-muted-foreground text-xs">{a.last}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          a.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {a.status === 'active' ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button className="text-muted-foreground hover:text-foreground">
                          <Icon name="MoreHorizontal" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit log */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <Icon name="ScrollText" size={16} className="text-primary" />
                <h2 className="font-medium text-sm">Аудит действий администратора</h2>
              </div>
              <div className="divide-y divide-border">
                {auditLog.map((l) => (
                  <div key={l.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${typeColor[l.type]}`}>
                      <Icon name={l.type === 'create' ? 'Plus' : l.type === 'block' ? 'Ban' : l.type === 'view' ? 'Eye' : 'Pencil'} size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        {l.action} <span className="font-mono text-xs text-muted-foreground">· {l.target}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Инициатор: {l.admin}</div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{l.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {(tab === 'profile' || tab === 'settings') && (
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-2xl mx-auto px-10 py-12 animate-slide-up">
            <h1 className="text-2xl font-semibold tracking-tight mb-8">
              {tab === 'profile' ? 'Профиль' : 'Настройки'}
            </h1>

            {tab === 'profile' && (
              <div className="bg-card border border-border rounded-xl p-8 flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold">АД</div>
                <div>
                  <div className="text-lg font-semibold">Администратор</div>
                  <div className="text-sm text-muted-foreground font-mono">admin · локальный сервер</div>
                  <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary bg-accent px-2.5 py-1 rounded-full">
                    <Icon name="ShieldCheck" size={12} /> Полные права
                  </span>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {(tab === 'profile'
                ? [
                    { icon: 'User', label: 'Отображаемое имя', value: 'Администратор' },
                    { icon: 'AtSign', label: 'Логин', value: 'admin' },
                    { icon: 'Key', label: 'Пароль', value: 'Изменить' },
                  ]
                : [
                    { icon: 'Bell', label: 'Уведомления', value: 'Включены' },
                    { icon: 'Server', label: 'Адрес сервера', value: '192.168.0.10' },
                    { icon: 'Moon', label: 'Тёмная тема', value: 'Выключена' },
                    { icon: 'Globe', label: 'Язык', value: 'Русский' },
                  ]
              ).map((row) => (
                <button key={row.label} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-secondary/50 transition-colors text-left">
                  <Icon name={row.icon} size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">{row.label}</span>
                  <span className="text-sm text-muted-foreground">{row.value}</span>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default Index;
