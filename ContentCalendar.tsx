import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "./src/lib/supabase";

type ContentStatus = "idea" | "writing" | "recording" | "editing" | "scheduled" | "published";
type ContentFormat = "Reel" | "Carrossel" | "Story" | "Foto" | "Live";

type ContentItem = {
  id: string;
  title: string;
  date: string;
  status: ContentStatus;
  format: ContentFormat;
  pillar: string;
  hook: string;
  body: string;
  cta: string;
  notes: string;
};

type CalendarState = {
  items: ContentItem[];
  pillars: string[];
};

const STATUS: Record<ContentStatus, { label: string; className: string }> = {
  idea: { label: "Ideia", className: "idea" },
  writing: { label: "Roteiro", className: "writing" },
  recording: { label: "Gravação", className: "recording" },
  editing: { label: "Edição", className: "editing" },
  scheduled: { label: "Agendado", className: "scheduled" },
  published: { label: "Publicado", className: "published" },
};

const FORMATS: ContentFormat[] = ["Reel", "Carrossel", "Story", "Foto", "Live"];
const DEFAULT_PILLARS = ["Founder story", "Bastidores", "Educação", "Opinião", "Prova social"];
const EMPTY_STATE: CalendarState = { items: [], pillars: DEFAULT_PILLARS };

const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthTitle = (date: Date) =>
  date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (letter) => letter.toUpperCase());

function emptyItem(date = localDate(new Date())): ContentItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    date,
    status: "idea",
    format: "Reel",
    pillar: DEFAULT_PILLARS[0],
    hook: "",
    body: "",
    cta: "",
    notes: "",
  };
}

function normalizeCalendar(raw: unknown): CalendarState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const parsed = raw as Partial<CalendarState>;
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    pillars: Array.isArray(parsed.pillars) && parsed.pillars.length ? parsed.pillars : DEFAULT_PILLARS,
  };
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error("Não foi possível entrar. Confira e-mail e senha.");
  };

  return (
    <main className="app-shell auth-shell">
      <form className="auth-card surface elevated" onSubmit={submit}>
        <div className="brand-line"><span /> Speedy Media OS</div>
        <h1>Founder Content</h1>
        <p>Seu calendário editorial, do insight à publicação.</p>
        <label className="auth-field"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="auth-field"><span>Senha</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="primary-btn" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}

export default function ContentCalendar() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [calendar, setCalendar] = useState<CalendarState>(EMPTY_STATE);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).finally(() => setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) { setReady(true); return; }
    setReady(false);
    const loadCalendar = async () => {
      try {
        const { data, error } = await supabase.from("dashboard_settings").select("extra_state").eq("user_id", session.user.id).maybeSingle();
        if (error) throw error;
        setCalendar(normalizeCalendar(data?.extra_state?.contentCalendar));
      } catch {
        toast.error("Não foi possível carregar o calendário.");
      } finally {
        setReady(true);
      }
    };
    void loadCalendar();
  }, [session?.user.id]);

  useEffect(() => {
    if (!ready || !session?.user.id) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: loadError } = await supabase.from("dashboard_settings").select("extra_state").eq("user_id", session.user.id).maybeSingle();
        if (loadError) throw loadError;
        const extraState = { ...(data?.extra_state || {}), contentCalendar: calendar };
        const { error } = await supabase.from("dashboard_settings").upsert({
          user_id: session.user.id,
          revenue_goal: extraState.revenueGoal ?? 40000,
          revenue_now: extraState.revenueNow ?? 0,
          safe_meetings_goal: extraState.commercial?.safeMeetings ?? 12,
          meetings_goal: extraState.meetings?.goal ?? 10,
          budget_br: extraState.budgetBR ?? 2000,
          budget_us: extraState.budgetUS ?? 2000,
          extra_state: extraState,
        });
        if (error) throw error;
        setSaveState("saved");
      } catch {
        setSaveState("error");
        toast.error("Não foi possível salvar no Supabase.");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [calendar, ready, session?.user.id]);

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [visibleMonth]);

  const filteredItems = useMemo(() => calendar.items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const haystack = `${item.title} ${item.pillar} ${item.hook}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [calendar.items, query, statusFilter]);

  const monthItems = calendar.items.filter((item) => item.date.startsWith(`${visibleMonth.getFullYear()}-${pad(visibleMonth.getMonth() + 1)}`));
  const published = monthItems.filter((item) => item.status === "published").length;
  const inProgress = monthItems.filter((item) => ["writing", "recording", "editing"].includes(item.status)).length;

  const saveItem = (item: ContentItem) => {
    if (!item.title.trim()) { toast.error("Dê um título para o conteúdo."); return; }
    setCalendar((current) => ({ ...current, items: [...current.items.filter((existing) => existing.id !== item.id), item] }));
    setEditing(null);
    toast.success("Conteúdo salvo.");
  };

  const removeItem = (id: string) => {
    setCalendar((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setEditing(null);
    toast.info("Conteúdo removido.");
  };

  if (!authReady || !ready) return <main className="app-shell auth-shell"><div className="auth-card surface loading-card"><div className="brand-line"><span /> Speedy Media OS</div><h1>Carregando calendário...</h1></div></main>;
  if (!session) return <Login />;

  return (
    <main className="app-shell content-app">
      <div className="content-wrap">
        <header className="content-header">
          <div>
            <div className="brand-line"><span /> Speedy Media OS</div>
            <h1>Founder Content</h1>
            <p>Transforme sua experiência em conteúdo que gera autoridade e demanda.</p>
          </div>
          <div className="content-header-actions">
            <span className={`save-indicator ${saveState}`}>{saveState === "saving" ? "Salvando..." : saveState === "error" ? "Erro ao salvar" : "Salvo no Supabase"}</span>
            <a className="ghost-btn" href="/"><ArrowLeft size={15} /> Dashboard</a>
            <button className="ghost-btn" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sair</button>
          </div>
        </header>

        <section className="content-stats">
          <div className="surface content-stat"><span>Planejados no mês</span><strong>{monthItems.length}</strong><small>conteúdos no calendário</small></div>
          <div className="surface content-stat"><span>Em produção</span><strong>{inProgress}</strong><small>roteiro, gravação ou edição</small></div>
          <div className="surface content-stat"><span>Publicados</span><strong>{published}</strong><small>{monthItems.length ? Math.round((published / monthItems.length) * 100) : 0}% do plano concluído</small></div>
          <div className="surface content-stat highlight"><span>Cadência</span><strong>{(monthItems.length / 4.3).toFixed(1)}</strong><small>conteúdos por semana</small></div>
        </section>

        <section className="calendar-toolbar surface">
          <div className="month-nav">
            <button aria-label="Mês anterior" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><ChevronLeft /></button>
            <h2>{monthTitle(visibleMonth)}</h2>
            <button aria-label="Próximo mês" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><ChevronRight /></button>
            <button className="today-btn" onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
          </div>
          <div className="calendar-actions">
            <label className="calendar-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conteúdo" /></label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ContentStatus | "all")}><option value="all">Todos os status</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
            <button className="primary-btn" onClick={() => setEditing(emptyItem())}><Plus size={16} /> Novo conteúdo</button>
          </div>
        </section>

        <section className="calendar-shell surface">
          <div className="weekday-row">{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {days.map((day) => {
              const key = localDate(day);
              const items = filteredItems.filter((item) => item.date === key);
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const today = key === localDate(new Date());
              return (
                <div className={`calendar-day ${outside ? "outside" : ""} ${today ? "today" : ""}`} key={key}>
                  <div className="day-head"><span>{day.getDate()}</span><button aria-label={`Adicionar conteúdo em ${key}`} onClick={() => setEditing(emptyItem(key))}><Plus size={14} /></button></div>
                  <div className="day-items">
                    {items.map((item) => <button className={`content-chip ${STATUS[item.status].className}`} key={item.id} onClick={() => setEditing(item)}><span>{item.format}</span><strong>{item.title}</strong></button>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="workflow surface">
          <div><Sparkles size={18} /><div><strong>Seu fluxo Founder-led Growth</strong><p>Capture a ideia, transforme em roteiro, grave, edite e publique sem perder o contexto.</p></div></div>
          <div className="workflow-steps">{Object.entries(STATUS).map(([key, value], index) => <span key={key}><i className={value.className}>{index + 1}</i>{value.label}{index < 5 && <ArrowRight size={13} />}</span>)}</div>
        </section>
      </div>

      {editing && <ContentEditor item={editing} pillars={calendar.pillars} onClose={() => setEditing(null)} onSave={saveItem} onRemove={removeItem} />}
    </main>
  );
}

function ContentEditor({ item, pillars, onClose, onSave, onRemove }: { item: ContentItem; pillars: string[]; onClose: () => void; onSave: (item: ContentItem) => void; onRemove: (id: string) => void }) {
  const [draft, setDraft] = useState(item);
  const update = <K extends keyof ContentItem>(key: K, value: ContentItem[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="editor-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="content-editor surface elevated">
        <header><div><span className="editor-kicker"><Camera size={15} /> Conteúdo Founder-led</span><h2>{item.title ? "Editar conteúdo" : "Nova ideia"}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <div className="editor-form">
          <label className="wide"><span>Título do conteúdo</span><input autoFocus value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex.: O erro que quase quebrou minha agência" /></label>
          <label><span>Data de publicação</span><input type="date" value={draft.date} onChange={(e) => update("date", e.target.value)} /></label>
          <label><span>Status</span><select value={draft.status} onChange={(e) => update("status", e.target.value as ContentStatus)}>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <label><span>Formato</span><select value={draft.format} onChange={(e) => update("format", e.target.value as ContentFormat)}>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select></label>
          <label><span>Pilar</span><select value={draft.pillar} onChange={(e) => update("pillar", e.target.value)}>{pillars.map((pillar) => <option key={pillar}>{pillar}</option>)}</select></label>
          <label className="wide"><span><Lightbulb size={13} /> Gancho</span><textarea value={draft.hook} onChange={(e) => update("hook", e.target.value)} placeholder="A primeira frase que vai prender a atenção..." rows={2} /></label>
          <label className="wide"><span>Roteiro / desenvolvimento</span><textarea value={draft.body} onChange={(e) => update("body", e.target.value)} placeholder="Organize a história, os pontos principais e a entrega..." rows={7} /></label>
          <label className="wide"><span>CTA</span><input value={draft.cta} onChange={(e) => update("cta", e.target.value)} placeholder="O que a pessoa deve fazer depois de consumir o conteúdo?" /></label>
          <label className="wide"><span>Notas de produção</span><textarea value={draft.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Cenas, referências, local, assets..." rows={3} /></label>
        </div>
        <footer>
          {item.title && <button className="danger-button" onClick={() => onRemove(item.id)}><Trash2 size={15} /> Excluir</button>}
          <div><button className="ghost-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" onClick={() => onSave(draft)}><Check size={16} /> Salvar conteúdo</button></div>
        </footer>
      </aside>
    </div>
  );
}
