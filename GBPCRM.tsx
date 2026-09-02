import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle, BarChart3, Building2, CalendarDays, Check, CheckCircle2,
  ChevronRight, Circle, ClipboardCheck, Clock3, LayoutDashboard, ListChecks,
  Loader2, LogOut, MapPin, MessageSquareText, MoreHorizontal, Plus, Search,
  Settings2, Sparkles, Star, TrendingUp, X, Repeat2, Flag, History,
  KeyRound, ArrowDown, ArrowUp, Minus, Target, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "./src/lib/supabase";

type Stage = "onboarding" | "setup" | "optimization" | "growth" | "attention";
type Priority = "high" | "medium" | "low";
type Recurrence = "none" | "weekly" | "monthly";
type View = "overview" | "priorities" | "clients" | "tasks" | "keywords";

type Client = {
  id: string;
  name: string;
  category: string;
  city: string;
  stage: Stage;
  owner: string;
  health: number;
  rating: number;
  reviews: number;
  postsThisMonth: number;
  targetPosts: number;
  unansweredReviews: number;
  profileCompletion: number;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  updatedAt: string;
};

type Task = {
  id: string;
  title: string;
  clientId: string;
  dueDate: string;
  priority: Priority;
  done: boolean;
  recurrence: Recurrence;
  completedAt?: string;
  description?: string;
};

type Keyword = {
  id: string;
  clientId: string;
  term: string;
  month: string;
  positions: [number | null, number | null, number | null, number | null];
};

type CRMState = { clients: Client[]; tasks: Task[]; keywords: Keyword[] };

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const INITIAL: CRMState = {
  clients: [],
  tasks: [],
  keywords: [],
};

const normalizeState = (saved?: Partial<CRMState> | null): CRMState => ({
  clients: saved?.clients || [],
  tasks: (saved?.tasks || []).map(task => ({ ...task, recurrence: task.recurrence || "none" })),
  keywords: saved?.keywords || [],
});

const stageMeta: Record<Stage, { label: string; className: string }> = {
  onboarding: { label: "Onboarding", className: "stage-onboarding" },
  setup: { label: "Configuração", className: "stage-setup" },
  optimization: { label: "Otimização", className: "stage-optimization" },
  growth: { label: "Crescimento", className: "stage-growth" },
  attention: { label: "Atenção", className: "stage-attention" },
};

const friendlyDate = (value: string) => {
  if (!value) return "Sem prazo";
  const date = new Date(`${value}T12:00:00`);
  if (value === todayISO()) return "Hoje";
  if (value === addDays(1)) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
};

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true);
    const normalizedUser = username.trim().toLowerCase();
    const email = normalizedUser === "bonatto"
      ? "gbpspeedy@gmail.com"
      : normalizedUser.includes("@") ? normalizedUser : `${normalizedUser}@internal.speedymediaus.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error("Não foi possível entrar", { description: "Confira o usuário e a senha." });
  };
  return <main className="gbp-auth">
    <form className="gbp-login" onSubmit={submit}>
      <div className="gbp-logo gbp-logo-official gbp-logo-grain"><span><img src="/speedy-logo-grain.png" alt="Speedy Media" /></span><small>GBP Operations</small></div>
      <div className="gbp-login-copy"><span className="gbp-kicker">Área interna</span><h1>Gestão local,<br />sem improviso.</h1><p>Entre para acompanhar a operação dos perfis, prioridades e resultados.</p></div>
      <label><span>Usuário</span><input value={username} onChange={e => setUsername(e.target.value)} placeholder="seu usuário" autoComplete="username" required /></label>
      <label><span>Senha</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></label>
      <button className="gbp-primary" disabled={loading}>{loading ? <Loader2 className="spin" size={18} /> : "Entrar no CRM"}</button>
    </form>
  </main>;
}

function ManagerDashboard({ state, saveState, onSignOut }: { state: CRMState; saveState: "saved" | "saving" | "error"; onSignOut: () => void }) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const completed = state.tasks.filter(task => task.done && task.completedAt);
  const checksToday = completed.filter(task => task.completedAt?.slice(0, 10) === todayISO()).length;
  const checksWeek = completed.filter(task => new Date(task.completedAt!) >= startOfWeek).length;
  const checksMonth = completed.filter(task => new Date(task.completedAt!) >= startOfMonth).length;
  const open = state.tasks.filter(task => !task.done);
  const late = open.filter(task => task.dueDate < todayISO());
  const forgotten = late.filter(task => (now.getTime() - new Date(`${task.dueDate}T12:00:00`).getTime()) / 86400000 >= 2);
  const dueThisMonth = state.tasks.filter(task => task.dueDate.slice(0, 7) === todayISO().slice(0, 7));
  const doneThisMonth = dueThisMonth.filter(task => task.done).length;
  const completionRate = dueThisMonth.length ? Math.round(doneThisMonth / dueThisMonth.length * 100) : 100;
  const recent = completed.slice().sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 8);

  return <div className="gbp-manager-app">
    <header className="manager-header">
      <div className="gbp-logo gbp-logo-official gbp-logo-grain"><span><img src="/speedy-logo-grain.png" alt="Speedy Media" /></span><small>Gestão GBP</small></div>
      <div className="manager-header-actions"><span className={`gbp-save ${saveState}`}>{saveState === "saving" ? "Atualizando..." : saveState === "error" ? "Erro de sincronização" : "Dados sincronizados"}</span><a className="gbp-secondary" href="/gbp">Abrir operação do Bonatto</a><a className="gbp-secondary" href="/">Dashboard Speedy</a><button className="gbp-icon-btn" onClick={onSignOut} title="Sair"><LogOut size={17} /></button></div>
    </header>
    <main className="manager-main">
      <section className="manager-title"><div><span className="gbp-eyebrow">Acompanhamento operacional</span><h1>Gestão do Bonatto</h1><p>Uma leitura rápida do ritmo, dos atrasos e do que pode ter sido esquecido.</p></div><span className={`manager-status ${late.length ? "attention" : "ok"}`}>{late.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{late.length ? "Operação exige atenção" : "Operação em dia"}</span></section>
      <section className="manager-kpis">
        <article><span><Check size={19} /></span><div><small>Checks hoje</small><strong>{checksToday}</strong><p>{checksWeek} nesta semana</p></div></article>
        <article><span><CalendarDays size={19} /></span><div><small>Checks no mês</small><strong>{checksMonth}</strong><p>{completionRate}% das tarefas do mês</p></div></article>
        <article className={late.length ? "danger" : ""}><span><Clock3 size={19} /></span><div><small>Em atraso</small><strong>{late.length}</strong><p>{open.length} tarefas abertas</p></div></article>
        <article className={forgotten.length ? "danger" : ""}><span><AlertTriangle size={19} /></span><div><small>Possivelmente esquecidas</small><strong>{forgotten.length}</strong><p>atrasadas há 2+ dias</p></div></article>
      </section>
      <section className="manager-grid">
        <article className="gbp-panel manager-activity"><header><div><span className="gbp-section-kicker">Atividade recente</span><h2>Últimos checks do Bonatto</h2></div><History size={19} /></header><div>{recent.map(task => { const client = state.clients.find(item => item.id === task.clientId); return <div className="manager-activity-row" key={task.id}><span><Check size={14} /></span><div><strong>{task.title}</strong><small>{client?.name || "Tarefa interna"}</small></div><time>{new Date(task.completedAt!).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>; })}{!recent.length && <div className="gbp-empty"><History /><strong>Nenhum check registrado</strong><p>As conclusões aparecerão aqui com data e hora.</p></div>}</div></article>
        <article className="gbp-panel manager-alerts"><header><div><span className="gbp-section-kicker">Controle</span><h2>Atrasos para cobrar</h2></div><span>{late.length}</span></header><div>{late.slice(0, 8).map(task => { const client = state.clients.find(item => item.id === task.clientId); return <div className="manager-alert-row" key={task.id}><span className="priority-dot danger" /><div><strong>{task.title}</strong><small>{client?.name || "Tarefa interna"}</small></div><time>{friendlyDate(task.dueDate)}</time></div>; })}{!late.length && <div className="gbp-empty"><CheckCircle2 /><strong>Nenhum atraso</strong><p>O fluxo está dentro dos prazos.</p></div>}</div></article>
      </section>
      <section className="gbp-panel manager-clients"><header><div><span className="gbp-section-kicker">Carteira</span><h2>Execução por cliente</h2></div><span>{state.clients.length} clientes</span></header><div className="manager-client-table"><div className="manager-client-head"><span>Cliente</span><span>Abertas</span><span>Atrasadas</span><span>Concluídas</span><span>Saúde</span></div>{state.clients.map(client => { const tasks = state.tasks.filter(task => task.clientId === client.id); return <div className="manager-client-row" key={client.id}><strong>{client.name}</strong><span>{tasks.filter(task => !task.done).length}</span><span className={tasks.some(task => !task.done && task.dueDate < todayISO()) ? "bad" : ""}>{tasks.filter(task => !task.done && task.dueDate < todayISO()).length}</span><span>{tasks.filter(task => task.done).length}</span><span><b className={client.health < 60 ? "bad" : client.health < 75 ? "warn" : "good"}>{client.health}</b>/100</span></div>; })}{!state.clients.length && <div className="gbp-empty"><Building2 /><strong>Carteira vazia</strong><p>Os clientes cadastrados pelo Bonatto aparecerão aqui.</p></div>}</div></section>
    </main>
  </div>;
}

function ClientForm({ client, onClose, onSave }: { client?: Client; onClose: () => void; onSave: (client: Client) => void }) {
  const [form, setForm] = useState<Client>(client || {
    id: crypto.randomUUID(), name: "", category: "", city: "", stage: "onboarding", owner: "Gestor GBP",
    health: 60, rating: 0, reviews: 0, postsThisMonth: 0, targetPosts: 4, unansweredReviews: 0,
    profileCompletion: 50, nextAction: "Concluir onboarding", nextActionDate: addDays(2), notes: "", updatedAt: new Date().toISOString(),
  });
  const set = <K extends keyof Client>(key: K, value: Client[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ ...form, updatedAt: new Date().toISOString() }); };
  return <div className="gbp-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="gbp-drawer" onSubmit={submit}>
      <header><div><span className="gbp-kicker">Conta GBP</span><h2>{client ? "Editar cliente" : "Novo cliente"}</h2></div><button type="button" className="gbp-icon-btn" onClick={onClose}><X size={19} /></button></header>
      <div className="gbp-form-grid">
        <label className="wide"><span>Nome da empresa</span><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex.: Speedy Auto Care" required autoFocus /></label>
        <label><span>Categoria principal</span><input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Ex.: Roofing Contractor" /></label>
        <label><span>Cidade / Estado</span><input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Ex.: Orlando, FL" /></label>
        <label><span>Etapa</span><select value={form.stage} onChange={e => set("stage", e.target.value as Stage)}>{Object.entries(stageMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
        <label><span>Saúde da conta</span><input type="number" min="0" max="100" value={form.health} onChange={e => set("health", Number(e.target.value))} /></label>
        <label><span>Avaliação</span><input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => set("rating", Number(e.target.value))} /></label>
        <label><span>Total de avaliações</span><input type="number" min="0" value={form.reviews} onChange={e => set("reviews", Number(e.target.value))} /></label>
        <label><span>Avaliações sem resposta</span><input type="number" min="0" value={form.unansweredReviews} onChange={e => set("unansweredReviews", Number(e.target.value))} /></label>
        <label><span>Posts neste mês</span><input type="number" min="0" value={form.postsThisMonth} onChange={e => set("postsThisMonth", Number(e.target.value))} /></label>
        <label className="wide"><span>Próxima ação</span><input value={form.nextAction} onChange={e => set("nextAction", e.target.value)} /></label>
        <label><span>Prazo</span><input type="date" value={form.nextActionDate} onChange={e => set("nextActionDate", e.target.value)} /></label>
        <label><span>Perfil completo</span><input type="number" min="0" max="100" value={form.profileCompletion} onChange={e => set("profileCompletion", Number(e.target.value))} /></label>
        <label className="wide"><span>Notas internas</span><textarea rows={4} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Contexto importante para a equipe..." /></label>
      </div>
      <footer><button type="button" className="gbp-secondary" onClick={onClose}>Cancelar</button><button className="gbp-primary">Salvar cliente</button></footer>
    </form>
  </div>;
}

function TaskForm({ clients, onClose, onSave }: { clients: Client[]; onClose: () => void; onSave: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [dueDate, setDueDate] = useState(todayISO());
  const [priority, setPriority] = useState<Priority>("medium");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [description, setDescription] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ id: crypto.randomUUID(), title, clientId, dueDate, priority, recurrence, description, done: false });
  };
  return <div className="gbp-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="gbp-drawer gbp-task-drawer" onSubmit={submit}>
      <header><div><span className="gbp-kicker">Nova execução</span><h2>Criar tarefa</h2><p>Transforme a próxima ação em um compromisso claro.</p></div><button type="button" className="gbp-icon-btn" onClick={onClose}><X size={19} /></button></header>
      <div className="gbp-form-grid">
        <label className="wide"><span>Tarefa</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Responder avaliações da semana" required autoFocus /></label>
        <label className="wide"><span>Cliente</span><select value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Sem cliente / Interna</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label><span>Prazo</span><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></label>
        <label><span>Prioridade</span><select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label>
        <label className="wide"><span>Tipo</span><div className="gbp-segmented">{(["none","weekly","monthly"] as Recurrence[]).map(value => <button type="button" key={value} className={recurrence === value ? "active" : ""} onClick={() => setRecurrence(value)}>{value === "none" ? "Pontual" : value === "weekly" ? "Toda semana" : "Todo mês"}</button>)}</div></label>
        <label className="wide"><span>Orientação para execução</span><textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Critério de conclusão, links ou contexto..." /></label>
      </div>
      <footer><button type="button" className="gbp-secondary" onClick={onClose}>Cancelar</button><button className="gbp-primary"><Plus size={16} /> Criar tarefa</button></footer>
    </form>
  </div>;
}

function KeywordForm({ clients, onClose, onSave }: { clients: Client[]; onClose: () => void; onSave: (keyword: Keyword) => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [term, setTerm] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  return <div className="gbp-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="gbp-drawer gbp-keyword-drawer" onSubmit={e => { e.preventDefault(); onSave({ id: crypto.randomUUID(), clientId, term, month, positions: [null,null,null,null] }); }}>
    <header><div><span className="gbp-kicker">SEO local</span><h2>Adicionar palavra-chave</h2><p>Acompanhe a posição nas quatro semanas do mês.</p></div><button type="button" className="gbp-icon-btn" onClick={onClose}><X size={19} /></button></header>
    <div className="gbp-form-grid"><label className="wide"><span>Cliente</span><select value={clientId} onChange={e => setClientId(e.target.value)} required><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="wide"><span>Palavra-chave principal</span><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Ex.: auto body shop near me" required /></label><label><span>Mês de referência</span><input type="month" value={month} onChange={e => setMonth(e.target.value)} required /></label></div>
    <footer><button type="button" className="gbp-secondary" onClick={onClose}>Cancelar</button><button className="gbp-primary">Adicionar palavra-chave</button></footer>
  </form></div>;
}

export default function GBPCRM() {
  const [session, setSession] = useState<Session | null>(null);
  const managerMode = window.location.pathname.startsWith("/gbp/gestao");
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CRMState>(INITIAL);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [taskEditor, setTaskEditor] = useState(false);
  const [keywordEditor, setKeywordEditor] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"open" | "done" | "all">("open");
  const [keywordClient, setKeywordClient] = useState("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).finally(() => setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) { setReady(false); return; }
    const load = async () => {
      try {
        const { data, error } = await supabase.from("dashboard_settings").select("extra_state").eq("user_id", session.user.id).maybeSingle();
        if (error) throw error;
        const saved = data?.extra_state?.gbpCrm as CRMState | undefined;
        setState(normalizeState(saved));
      } catch {
        toast.error("Não foi possível carregar o CRM");
      } finally {
        setReady(true);
      }
    };
    void load();
  }, [session?.user.id]);

  useEffect(() => {
    if (!ready) return;
    if (!session?.user.id) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: readError } = await supabase.from("dashboard_settings").select("extra_state").eq("user_id", session.user.id).maybeSingle();
        if (readError) throw readError;
        const extraState = { ...(data?.extra_state || {}), gbpCrm: state };
        const { error } = await supabase.from("dashboard_settings").upsert({
          user_id: session.user.id,
          revenue_goal: 40000,
          revenue_now: 0,
          safe_meetings_goal: 12,
          meetings_goal: 10,
          budget_br: 2000,
          budget_us: 2000,
          extra_state: extraState,
        });
        if (error) throw error;
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state, ready, session?.user.id]);

  const filteredClients = useMemo(() => state.clients.filter(client => `${client.name} ${client.category} ${client.city}`.toLowerCase().includes(search.toLowerCase())), [state.clients, search]);
  const openTasks = state.tasks.filter(task => !task.done);
  const overdue = openTasks.filter(task => task.dueDate < todayISO()).length;
  const needsAttention = state.clients.filter(client => client.health < 60).length;
  const avgHealth = state.clients.length ? Math.round(state.clients.reduce((sum, client) => sum + client.health, 0) / state.clients.length) : 0;
  const totalReviews = state.clients.reduce((sum, client) => sum + client.reviews, 0);
  const unanswered = state.clients.reduce((sum, client) => sum + client.unansweredReviews, 0);
  const weekTasks = openTasks.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const saveClient = (client: Client) => {
    setState(prev => ({ ...prev, clients: prev.clients.some(c => c.id === client.id) ? prev.clients.map(c => c.id === client.id ? client : c) : [client, ...prev.clients] }));
    setEditing(null); setSelectedClient(client); toast.success("Cliente salvo");
  };
  const toggleTask = (id: string) => setState(prev => {
    const current = prev.tasks.find(task => task.id === id);
    if (!current) return prev;
    const completing = !current.done;
    const tasks = prev.tasks.map(task => task.id === id ? { ...task, done: completing, completedAt: completing ? new Date().toISOString() : undefined } : task);
    if (completing && current.recurrence !== "none") {
      const next = new Date(`${current.dueDate}T12:00:00`);
      if (current.recurrence === "weekly") next.setDate(next.getDate() + 7); else next.setMonth(next.getMonth() + 1);
      tasks.push({ ...current, id: crypto.randomUUID(), done: false, completedAt: undefined, dueDate: next.toISOString().slice(0,10) });
    }
    return { ...prev, tasks };
  });
  const addTask = (client: Client) => {
    const title = window.prompt("Qual é a próxima tarefa?", client.nextAction);
    if (!title) return;
    setState(prev => ({ ...prev, tasks: [{ id: crypto.randomUUID(), title, clientId: client.id, dueDate: client.nextActionDate || todayISO(), priority: "medium", recurrence: "none", done: false }, ...prev.tasks] }));
    toast.success("Tarefa adicionada");
  };
  const saveTask = (task: Task) => { setState(prev => ({ ...prev, tasks: [task, ...prev.tasks] })); setTaskEditor(false); toast.success("Tarefa criada"); };
  const saveKeyword = (keyword: Keyword) => { setState(prev => ({ ...prev, keywords: [keyword, ...prev.keywords] })); setKeywordEditor(false); toast.success("Palavra-chave adicionada"); };
  const updatePosition = (id: string, week: number, value: string) => setState(prev => ({ ...prev, keywords: prev.keywords.map(keyword => keyword.id === id ? { ...keyword, positions: keyword.positions.map((position, index) => index === week ? (value ? Number(value) : null) : position) as Keyword["positions"] } : keyword) }));

  if (!authReady) return <main className="gbp-auth"><Loader2 className="spin" /></main>;
  if (!session) return <Login />;
  if (!ready) return <main className="gbp-auth"><div className="gbp-loading"><Loader2 className="spin" /><span>Preparando sua operação...</span></div></main>;
  if (managerMode) return <ManagerDashboard state={state} saveState={saveState} onSignOut={() => void supabase.auth.signOut()} />;

  return <div className="gbp-app">
    <aside className="gbp-sidebar">
      <div className="gbp-logo gbp-logo-official gbp-logo-grain"><span><img src="/speedy-logo-grain.png" alt="Speedy Media" /></span><small>GBP Operations</small></div>
      <nav>
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><LayoutDashboard size={18} /> Visão geral</button>
        <button className={view === "priorities" ? "active" : ""} onClick={() => setView("priorities")}><Flag size={18} /> Prioridades <em>{openTasks.filter(t => t.priority === "high" || t.dueDate <= todayISO()).length}</em></button>
        <button className={view === "clients" ? "active" : ""} onClick={() => setView("clients")}><Building2 size={18} /> Clientes <em>{state.clients.length}</em></button>
        <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}><ListChecks size={18} /> Tarefas <em>{openTasks.length}</em></button>
        <button className={view === "keywords" ? "active" : ""} onClick={() => setView("keywords")}><KeyRound size={18} /> Palavras-chave <em>{state.keywords.length}</em></button>
      </nav>
      <div className="gbp-sidebar-note"><Sparkles size={17} /><div><strong>Regra da operação</strong><p>Toda conta precisa ter uma próxima ação clara e um prazo.</p></div></div>
      <div className="gbp-user"><div className="gbp-avatar">GB</div><div><strong>Bonatto</strong><small>{session.user.email}</small></div><button onClick={() => void supabase.auth.signOut()} title="Sair"><LogOut size={17} /></button></div>
    </aside>

    <main className="gbp-main">
      <header className="gbp-topbar">
        <div><span className="gbp-eyebrow">Speedy Media / GBP Operations</span><h1>{view === "overview" ? "Bom dia, Bonatto." : view === "priorities" ? "Central de prioridades" : view === "clients" ? "Carteira de clientes" : view === "keywords" ? "Performance local" : "Fila de execução"}</h1><p>{view === "overview" ? "Decida rápido o que merece atenção hoje." : view === "priorities" ? "O que está atrasado, crítico ou bloqueando resultado." : view === "clients" ? "Visão completa das contas sob sua gestão." : view === "keywords" ? "Evolução semanal das palavras-chave que movem cada negócio." : "Planeje, execute e consulte tudo que já foi concluído."}</p></div>
        <div className="gbp-top-actions"><span className={`gbp-save ${saveState}`}>{saveState === "saving" ? "Salvando..." : saveState === "error" ? "Erro ao salvar" : "Sincronizado"}</span>{view === "clients" ? <button className="gbp-primary" onClick={() => setEditing("new")}><Plus size={17} /> Novo cliente</button> : view === "keywords" ? <button className="gbp-primary" onClick={() => setKeywordEditor(true)}><Plus size={17} /> Palavra-chave</button> : <button className="gbp-primary" onClick={() => setTaskEditor(true)}><Plus size={17} /> Nova tarefa</button>}</div>
      </header>

      {view === "overview" && <>
        <section className="gbp-metrics">
          <article><span className="metric-icon blue"><Building2 /></span><div><small>Clientes ativos</small><strong>{state.clients.length}</strong><p><TrendingUp size={13} /> carteira acompanhada</p></div></article>
          <article><span className="metric-icon green"><BarChart3 /></span><div><small>Saúde média</small><strong>{avgHealth}<i>/100</i></strong><p>qualidade operacional</p></div></article>
          <article><span className="metric-icon amber"><AlertTriangle /></span><div><small>Precisam de atenção</small><strong>{needsAttention}</strong><p>{overdue} tarefa{overdue === 1 ? "" : "s"} atrasada{overdue === 1 ? "" : "s"}</p></div></article>
          <article><span className="metric-icon purple"><MessageSquareText /></span><div><small>Avaliações</small><strong>{totalReviews}</strong><p>{unanswered} aguardando resposta</p></div></article>
        </section>

        <section className="gbp-grid-main">
          <div className="gbp-panel gbp-priorities">
            <header><div><span className="gbp-section-kicker">Execução</span><h2>Prioridades da semana</h2></div><button onClick={() => setView("tasks")}>Ver todas <ChevronRight size={15} /></button></header>
            <div className="gbp-task-list">{weekTasks.slice(0, 5).map(task => {
              const client = state.clients.find(c => c.id === task.clientId);
              const isLate = task.dueDate < todayISO();
              return <div className="gbp-task" key={task.id}><button className="task-check" onClick={() => toggleTask(task.id)}><Circle size={19} /></button><div><strong>{task.title}</strong><span>{client?.name || "Cliente removido"}</span></div><span className={`task-date ${isLate ? "late" : ""}`}><Clock3 size={13} /> {isLate ? "Atrasada" : friendlyDate(task.dueDate)}</span><button className="task-more"><MoreHorizontal size={17} /></button></div>;
            })}{weekTasks.length === 0 && <div className="gbp-empty"><CheckCircle2 /><strong>Fila em dia</strong><p>Nenhuma tarefa aberta.</p></div>}</div>
          </div>
          <aside className="gbp-panel gbp-focus">
            <span className="gbp-section-kicker">Foco de hoje</span><h2>{overdue ? `${overdue} ${overdue === 1 ? "pendência crítica" : "pendências críticas"}` : "Operação em dia"}</h2><p>{overdue ? "Resolva os atrasos antes de iniciar novas otimizações. Movimento consistente gera resultado local." : "Use o tempo livre para antecipar publicações e responder avaliações."}</p>
            <div className="focus-progress"><div><span>Progresso semanal</span><b>{state.tasks.length ? Math.round(state.tasks.filter(t => t.done).length / state.tasks.length * 100) : 0}%</b></div><i><span style={{ width: `${state.tasks.length ? state.tasks.filter(t => t.done).length / state.tasks.length * 100 : 0}%` }} /></i></div>
            <button onClick={() => setView("tasks")}>Abrir fila de execução <ChevronRight size={16} /></button>
          </aside>
        </section>

        <section className="gbp-panel gbp-accounts">
          <header><div><span className="gbp-section-kicker">Carteira</span><h2>Saúde das contas</h2></div><button onClick={() => setView("clients")}>Ver carteira <ChevronRight size={15} /></button></header>
          <div className="gbp-account-grid">{state.clients.length === 0 && <div className="gbp-empty gbp-empty-wide"><Building2 /><strong>Comece pela carteira</strong><p>Cadastre o primeiro cliente para organizar a operação.</p><button className="gbp-primary" onClick={() => setEditing("new")}><Plus size={15} /> Cadastrar cliente</button></div>}{state.clients.slice(0, 4).map(client => <button key={client.id} className="gbp-account-card" onClick={() => setSelectedClient(client)}>
            <div className="account-head"><span className="account-avatar">{client.name.slice(0, 2).toUpperCase()}</span><span className={`gbp-stage ${stageMeta[client.stage].className}`}>{stageMeta[client.stage].label}</span></div>
            <h3>{client.name}</h3><p><MapPin size={13} /> {client.city || "Local não informado"}</p>
            <div className="health-row"><span>Saúde da conta</span><b className={client.health < 60 ? "bad" : client.health < 75 ? "warn" : "good"}>{client.health}</b></div>
            <div className="health-bar"><span style={{ width: `${client.health}%` }} className={client.health < 60 ? "bad" : client.health < 75 ? "warn" : "good"} /></div>
            <footer><span><Star size={14} fill="currentColor" /> {client.rating || "—"}</span><span>{client.reviews} avaliações</span><ChevronRight size={16} /></footer>
          </button>)}</div>
        </section>
      </>}

      {view === "priorities" && <section className="gbp-priority-layout">
        <div className="gbp-panel gbp-priority-board">
          <header><div><span className="gbp-section-kicker">Agora</span><h2>Ordem recomendada de execução</h2></div><span>{openTasks.filter(t => t.priority === "high" || t.dueDate <= todayISO()).length} críticas</span></header>
          <div className="gbp-priority-groups">
            {[{title:"Atrasadas",tone:"danger",items:openTasks.filter(t=>t.dueDate<todayISO())},{title:"Para hoje",tone:"today",items:openTasks.filter(t=>t.dueDate===todayISO())},{title:"Alta prioridade",tone:"high",items:openTasks.filter(t=>t.dueDate>todayISO()&&t.priority==="high")}].map(group => <section key={group.title}>
              <header><span className={`priority-dot ${group.tone}`} /><h3>{group.title}</h3><b>{group.items.length}</b></header>
              {group.items.map(task => { const client=state.clients.find(c=>c.id===task.clientId); return <div className="priority-item" key={task.id}><button className="task-check" onClick={()=>toggleTask(task.id)}><Circle size={19}/></button><div><strong>{task.title}</strong><span>{client?.name||"Tarefa interna"}</span></div>{task.recurrence!=="none"&&<Repeat2 size={14}/>}<span>{friendlyDate(task.dueDate)}</span></div> })}
              {!group.items.length&&<p className="priority-empty">Nenhum item aqui.</p>}
            </section>)}
          </div>
        </div>
        <aside className="gbp-panel gbp-priority-insight"><Target size={21}/><span className="gbp-section-kicker">Princípio Speedy</span><h2>Resultado antes de volume.</h2><p>Priorize o que remove bloqueios do cliente: acesso, informação incorreta, avaliações sem resposta e ações com impacto em descoberta local.</p><button className="gbp-primary" onClick={()=>setTaskEditor(true)}><Plus size={16}/> Criar tarefa prioritária</button></aside>
      </section>}

      {view === "clients" && <section className="gbp-panel gbp-client-table-panel">
        <div className="gbp-table-tools"><label><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, cidade ou categoria..." /></label><button className="gbp-secondary"><Settings2 size={16} /> Filtros</button></div>
        <div className="gbp-table"><div className="gbp-tr gbp-th"><span>Cliente</span><span>Etapa</span><span>Saúde</span><span>Presença local</span><span>Próxima ação</span><span /></div>{filteredClients.map(client => <button className="gbp-tr" key={client.id} onClick={() => setSelectedClient(client)}>
          <span className="client-cell"><i>{client.name.slice(0, 2).toUpperCase()}</i><span><strong>{client.name}</strong><small>{client.category} · {client.city}</small></span></span>
          <span><b className={`gbp-stage ${stageMeta[client.stage].className}`}>{stageMeta[client.stage].label}</b></span>
          <span className="table-health"><b className={client.health < 60 ? "bad" : client.health < 75 ? "warn" : "good"}>{client.health}</b><i><span style={{ width: `${client.health}%` }} /></i></span>
          <span className="presence"><b><Star size={13} fill="currentColor" /> {client.rating || "—"}</b><small>{client.reviews} avaliações</small></span>
          <span className="next-cell"><strong>{client.nextAction}</strong><small className={client.nextActionDate < todayISO() ? "late" : ""}>{friendlyDate(client.nextActionDate)}</small></span>
          <ChevronRight size={17} />
        </button>)}</div>
      </section>}

      {view === "tasks" && <section className="gbp-panel gbp-all-tasks">
        <header><div><span className="gbp-section-kicker">Processos</span><h2>Tarefas e histórico</h2></div><span>{openTasks.length} abertas · {state.tasks.filter(t=>t.done).length} concluídas</span></header>
        <div className="gbp-task-toolbar"><div className="gbp-segmented gbp-task-tabs"><button className={taskFilter==="open"?"active":""} onClick={()=>setTaskFilter("open")}><ListChecks size={14}/> Abertas</button><button className={taskFilter==="done"?"active":""} onClick={()=>setTaskFilter("done")}><History size={14}/> Concluídas</button><button className={taskFilter==="all"?"active":""} onClick={()=>setTaskFilter("all")}>Todas</button></div><button className="gbp-secondary" onClick={()=>setTaskEditor(true)}><Plus size={15}/> Tarefa pontual</button></div>
        {[...state.tasks].filter(task=>taskFilter==="all"||taskFilter==="done"?taskFilter==="all"||task.done:!task.done).sort((a,b) => Number(a.done)-Number(b.done) || a.dueDate.localeCompare(b.dueDate)).map(task => { const client = state.clients.find(c => c.id === task.clientId); return <div className={`gbp-task task-full ${task.done ? "completed" : ""}`} key={task.id}><button className={`task-check ${task.done ? "checked" : ""}`} onClick={() => toggleTask(task.id)}>{task.done ? <Check size={15} /> : <Circle size={19} />}</button><div><strong>{task.title}</strong><span>{client?.name || "Tarefa interna"}{task.description?` · ${task.description}`:""}</span></div>{task.recurrence!=="none"?<b className="recurrence-pill"><Repeat2 size={12}/>{task.recurrence==="weekly"?"Semanal":"Mensal"}</b>:<b className={`priority-${task.priority}`}>{task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}</b>}<span className={`task-date ${!task.done && task.dueDate < todayISO() ? "late" : ""}`}><CalendarDays size={14} /> {task.done&&task.completedAt?`Concluída ${new Date(task.completedAt).toLocaleDateString("pt-BR")}`:friendlyDate(task.dueDate)}</span></div> })}
        {!state.tasks.some(task=>taskFilter==="all"||(taskFilter==="done"?task.done:!task.done))&&<div className="gbp-empty"><CheckCircle2/><strong>{taskFilter==="done"?"Nada concluído ainda":"Fila limpa"}</strong><p>Crie uma tarefa para começar.</p></div>}
      </section>}

      {view === "keywords" && <section className="gbp-panel gbp-keywords-panel">
        <header><div><span className="gbp-section-kicker">Ranking local</span><h2>Palavras-chave · Semana 1 a 4</h2></div><span>{state.keywords.length} monitoradas</span></header>
        <div className="gbp-keyword-toolbar"><label><Building2 size={15}/><select value={keywordClient} onChange={e=>setKeywordClient(e.target.value)}><option value="all">Todos os clientes</option>{state.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="gbp-secondary" onClick={()=>setKeywordEditor(true)}><Plus size={15}/> Adicionar</button></div>
        <div className="keyword-table"><div className="keyword-row keyword-head"><span>Palavra-chave / Cliente</span><span>Semana 1</span><span>Semana 2</span><span>Semana 3</span><span>Semana 4</span><span>Variação</span></div>{state.keywords.filter(k=>keywordClient==="all"||k.clientId===keywordClient).map(keyword=>{const client=state.clients.find(c=>c.id===keyword.clientId);const values=keyword.positions.filter((v):v is number=>v!==null);const variation=values.length>1?values[0]-values[values.length-1]:0;return <div className="keyword-row" key={keyword.id}><span><strong>{keyword.term}</strong><small>{client?.name||"Cliente"} · {keyword.month}</small></span>{keyword.positions.map((position,index)=><span key={index}><input type="number" min="1" value={position??""} placeholder="—" onChange={e=>updatePosition(keyword.id,index,e.target.value)}/></span>)}<span className={`keyword-variation ${variation>0?"up":variation<0?"down":""}`}>{variation>0?<ArrowUp/>:variation<0?<ArrowDown/>:<Minus/>}{variation?Math.abs(variation):"—"}</span></div>})}</div>
        {!state.keywords.length&&<div className="gbp-empty"><KeyRound/><strong>Comece a medir evolução</strong><p>Adicione as palavras-chave principais de cada cliente e atualize a posição toda semana.</p><button className="gbp-primary" onClick={()=>setKeywordEditor(true)}>Adicionar primeira palavra-chave</button></div>}
      </section>}
    </main>

    {selectedClient && <div className="gbp-detail-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelectedClient(null)}><aside className="gbp-detail">
      <header><button className="gbp-icon-btn" onClick={() => setSelectedClient(null)}><X size={19} /></button><span className={`gbp-stage ${stageMeta[selectedClient.stage].className}`}>{stageMeta[selectedClient.stage].label}</span></header>
      <div className="detail-title"><span>{selectedClient.name.slice(0, 2).toUpperCase()}</span><div><h2>{selectedClient.name}</h2><p>{selectedClient.category} · {selectedClient.city}</p></div></div>
      <div className="detail-health"><div><span>Saúde da conta</span><strong>{selectedClient.health}<small>/100</small></strong></div><i><span style={{ width: `${selectedClient.health}%` }} /></i></div>
      <div className="detail-stats"><div><Star /><strong>{selectedClient.rating || "—"}</strong><span>Avaliação</span></div><div><MessageSquareText /><strong>{selectedClient.unansweredReviews}</strong><span>Sem resposta</span></div><div><ClipboardCheck /><strong>{selectedClient.postsThisMonth}/{selectedClient.targetPosts}</strong><span>Posts no mês</span></div></div>
      <section><span className="gbp-section-kicker">Próxima ação</span><div className="next-action-box"><div><strong>{selectedClient.nextAction}</strong><span><CalendarDays size={14} /> {friendlyDate(selectedClient.nextActionDate)}</span></div><button onClick={() => addTask(selectedClient)}><Plus size={16} /> Criar tarefa</button></div></section>
      <section><span className="gbp-section-kicker">Checklist do perfil</span><div className="completion"><div><span>Completude</span><b>{selectedClient.profileCompletion}%</b></div><i><span style={{ width: `${selectedClient.profileCompletion}%` }} /></i></div></section>
      <section><span className="gbp-section-kicker">Notas internas</span><p className="detail-notes">{selectedClient.notes || "Nenhuma nota adicionada."}</p></section>
      <footer><button className="gbp-secondary" onClick={() => { setEditing(selectedClient); setSelectedClient(null); }}>Editar conta</button><button className="gbp-primary" onClick={() => addTask(selectedClient)}><Plus size={16} /> Nova tarefa</button></footer>
    </aside></div>}
    {editing && <ClientForm client={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSave={saveClient} />}
    {taskEditor && <TaskForm clients={state.clients} onClose={() => setTaskEditor(false)} onSave={saveTask} />}
    {keywordEditor && <KeywordForm clients={state.clients} onClose={() => setKeywordEditor(false)} onSave={saveKeyword} />}
  </div>;
}
