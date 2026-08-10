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
  StickyNote,
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

type CalendarNote = { id: string; date: string; text: string };
type Insight = { id: string; text: string; category: string; createdAt: string };

type CalendarState = {
  items: ContentItem[];
  pillars: string[];
  notes: CalendarNote[];
  insights: Insight[];
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
const DEFAULT_PILLARS = ["História real", "Análise externa", "Bastidor da Speedy", "Opinião forte", "Fundador pessoal"];
const EMPTY_STATE: CalendarState = { items: [], pillars: DEFAULT_PILLARS, notes: [], insights: [] };

const STORY_PLAN = [
  "Constância",
  "Constância · situação real · decisão",
  "Constância · bastidor · melhoria",
  "Constância · opinião · conclusão",
  "Constância · situação real · decisão",
  "Constância · prova · diagnóstico",
  "Constância",
];

const MONTH_PLAN = [
  { week: 1, weekday: 1, pillar: "História real", title: "O cliente que pediu mais leads", hook: "O cliente me pediu mais leads. Eu disse que esse não era o próximo passo.", body: "Contexto:\nProblema aparente: faltavam leads.\nDescoberta: identificar o verdadeiro gargalo nos números.\nDecisão:\nConclusão:" },
  { week: 1, weekday: 3, pillar: "Análise externa", title: "A oferta de Botox por $7,99", hook: "Essa clínica está anunciando Botox por $7,99. O número parece barato, mas não é isso que torna a oferta forte.", body: "Contexto: mostrar o anúncio.\nProblema aparente: preço baixo.\nDescoberta: mecanismo de curiosidade e apresentação.\nDecisão: o que adaptar e o que não copiar.\nConclusão:" },
  { week: 1, weekday: 5, pillar: "Bastidor da Speedy", title: "O dashboard que virou procrastinação", hook: "Eu construí um dashboard inteiro e percebi que estava usando organização para evitar vender.", body: "Contexto: por que o dashboard foi criado.\nProblema aparente: falta de organização.\nDescoberta: indicadores não tomavam decisões.\nDecisão: o que remover e priorizar.\nConclusão:" },
  { week: 1, weekday: 0, pillar: "Opinião forte", title: "Agências assumem crédito demais", hook: "Agências de tráfego assumem crédito demais pelo crescimento dos clientes.", body: "Contexto:\nProblema aparente: atribuir receita ao anúncio.\nDescoberta: outras partes do negócio participaram.\nDecisão: como apresentar cases com honestidade.\nConclusão:" },
  { week: 2, weekday: 1, pillar: "História real", title: "A campanha que parecia ruim", hook: "Essa campanha parecia ruim até eu parar de olhar o custo por lead.", body: "Contexto: CPL alto.\nProblema aparente: pausar a campanha.\nDescoberta: qualidade, ticket, agendamentos ou receita.\nDecisão:\nConclusão:" },
  { week: 2, weekday: 3, pillar: "Análise externa", title: "A avaliação gratuita que confunde", hook: "Essa empresa oferece avaliação gratuita, mas o anúncio faz parecer que você já ganhou o procedimento.", body: "Contexto: mostrar a oferta.\nProblema aparente: promessa atraente.\nDescoberta: diferença entre o literal e o que o consumidor entende.\nDecisão: alternativa mais clara.\nConclusão:" },
  { week: 2, weekday: 5, pillar: "História real", title: "O anúncio bonito que não vendeu", hook: "Esse foi o anúncio mais bonito da campanha — e um dos piores em resultado.", body: "Contexto: mostrar os dois criativos.\nProblema aparente: estética.\nDescoberta: a peça simples comunicava melhor.\nDecisão:\nConclusão:" },
  { week: 2, weekday: 0, pillar: "Fundador pessoal", title: "Trabalho em inglês, mas ainda travo", hook: "Eu consigo escrever uma campanha para americanos, mas ainda travo numa conversa simples em inglês.", body: "Contexto: situação real.\nContradição: competência técnica x conversação.\nDescoberta: isso não impediu o trabalho.\nDecisão: o que ainda estou desenvolvendo.\nConclusão:" },
  { week: 3, weekday: 1, pillar: "História real", title: "A promoção que eu não deixei publicar", hook: "Essa promoção provavelmente geraria mais leads. Mesmo assim, eu não deixei o cliente publicar.", body: "Contexto: qual era a promoção.\nProblema aparente: gerar volume.\nDescoberta: impacto em público, margem e posicionamento.\nDecisão: o que entrou no lugar.\nConclusão:" },
  { week: 3, weekday: 3, pillar: "Análise externa", title: "Três empresas, o mesmo cliente", hook: "Eu vi três clínicas anunciando o mesmo procedimento. Só uma me deu um motivo para escolher.", body: "Contexto: mostrar três anúncios.\nProblema aparente: ofertas parecidas.\nDescoberta: especificidade, risco e valor percebido.\nDecisão: qual escolher e por quê.\nConclusão:" },
  { week: 3, weekday: 5, pillar: "Bastidor da Speedy", title: "Margem alta pode ser crescimento lento", hook: "Minha empresa tem uma margem muito alta. Isso pode ser um sinal de que estou crescendo devagar.", body: "Contexto: por que guardar lucro parecia certo.\nProblema aparente: proteger margem.\nDescoberta: pouco reinvestimento pode limitar crescimento.\nDecisão: onde reinvestir e como medir risco.\nConclusão:" },
  { week: 3, weekday: 0, pillar: "Opinião forte", title: "Lead barato pode sair caro", hook: "Lead barato pode ser a métrica mais cara de uma campanha.", body: "Contexto: comparar duas campanhas.\nProblema aparente: CPL.\nDescoberta: o que aconteceu depois do formulário.\nDecisão: qual métrica passou a orientar a campanha.\nConclusão:" },
  { week: 4, weekday: 1, pillar: "História real", title: "O resultado não veio só do tráfego", hook: "Esse cliente passou de X para Y — mas seria mentira dizer que foi por causa dos anúncios.", body: "Contexto: situação anterior.\nProblema aparente: atribuição ao tráfego.\nDescoberta: posicionamento, conteúdo, oferta e comercial.\nDecisão:\nConclusão:" },
  { week: 4, weekday: 3, pillar: "Bastidor da Speedy", title: "A aquisição da própria Speedy", hook: "Eu consigo gerar clientes para outras empresas, mas ainda não construí aquisição previsível para a minha.", body: "Contexto: como a Speedy conquista clientes hoje.\nContradição: entregar aquisição sem tê-la previsível internamente.\nDescoberta:\nDecisão: canal, investimento e critério de sucesso.\nConclusão:" },
  { week: 4, weekday: 5, pillar: "História real", title: "O número que mudou minha decisão", hook: "Eu estava pronto para desligar essa campanha. Então encontrei um número que mudou a decisão.", body: "Contexto: o que parecia errado.\nProblema aparente: a métrica inicial.\nDescoberta: a informação que faltava.\nDecisão: manter, mudar ou escalar.\nConclusão:" },
  { week: 4, weekday: 0, pillar: "Fundador pessoal", title: "O operador que inventa sistemas", hook: "Eu digo que preciso sair da operação, mas toda semana invento um novo sistema para construir.", body: "Contexto: por que quero sair da operação.\nContradição: continuo construindo pessoalmente.\nDescoberta: sistemas podem me manter operacional.\nDecisão: o que vou delegar ou deixar de construir.\nConclusão:" },
] as const;

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
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "História real": ["cliente", "campanha", "lead", "anúncio", "resultado", "case", "orçamento", "vendeu", "contato"],
  "Análise externa": ["concorrente", "clínica", "empresa", "perfil", "oferta", "site", "publicidade", "criativo de"],
  "Bastidor da Speedy": ["speedy", "dashboard", "processo", "margem", "aquisição", "contratação", "sistema", "equipe", "agência"],
  "Opinião forte": ["acho", "discordo", "ninguém", "deveria", "erro", "mentira", "métrica", "lead barato", "não funciona"],
  "Fundador pessoal": ["eu", "inglês", "fundador", "operação", "aprendi", "medo", "travei", "minha rotina", "decidi"],
};

function classifyInsight(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, words]) => ({
    category,
    score: words.reduce((total, word) => total + (normalized.includes(word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].category : "Fundador pessoal";
}

function plannedDate(month: Date, week: number, weekday: number) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstMonday = new Date(first);
  firstMonday.setDate(first.getDate() + ((8 - first.getDay()) % 7));
  const result = new Date(firstMonday);
  result.setDate(firstMonday.getDate() + (week - 1) * 7 + ((weekday + 6) % 7));
  return localDate(result);
}

function contentWeek(day: Date, month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstMonday = new Date(first);
  firstMonday.setDate(first.getDate() + ((8 - first.getDay()) % 7));
  const diff = Math.floor((day.getTime() - firstMonday.getTime()) / 86400000);
  const week = Math.floor(diff / 7) + 1;
  return diff >= 0 && week <= 4 ? week : null;
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
  const [noteEditing, setNoteEditing] = useState<CalendarNote | null>(null);
  const [query, setQuery] = useState("");
  const [insightDraft, setInsightDraft] = useState("");
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

  const plannedItems = useMemo(() => MONTH_PLAN.map((plan) => ({ ...plan, date: plannedDate(visibleMonth, plan.week, plan.weekday) })), [visibleMonth]);

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

  const saveNote = (note: CalendarNote) => {
    if (!note.text.trim()) return;
    setCalendar((current) => ({ ...current, notes: [...current.notes.filter((existing) => existing.id !== note.id), note] }));
    setNoteEditing(null);
    toast.success("Anotação salva.");
  };

  const removeNote = (id: string) => {
    setCalendar((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
    setNoteEditing(null);
  };

  const addInsight = (event: FormEvent) => {
    event.preventDefault();
    const text = insightDraft.trim();
    if (!text) return;
    const insight: Insight = { id: crypto.randomUUID(), text, category: classifyInsight(text), createdAt: new Date().toISOString() };
    setCalendar((current) => ({ ...current, insights: [insight, ...current.insights] }));
    setInsightDraft("");
    toast.success(`Insight classificado como ${insight.category}.`);
  };

  const updateInsightCategory = (id: string, category: string) => {
    setCalendar((current) => ({ ...current, insights: current.insights.map((insight) => insight.id === id ? { ...insight, category } : insight) }));
  };

  const removeInsight = (id: string) => {
    setCalendar((current) => ({ ...current, insights: current.insights.filter((insight) => insight.id !== id) }));
  };

  const togglePublished = (item: ContentItem) => {
    const nextStatus: ContentStatus = item.status === "published" ? "scheduled" : "published";
    setCalendar((current) => ({ ...current, items: [...current.items.filter((existing) => existing.id !== item.id), { ...item, status: nextStatus }] }));
    toast.success(nextStatus === "published" ? "Vídeo concluído e registrado." : "Vídeo reaberto no calendário.");
  };

  const itemFromPlan = (plan: (typeof plannedItems)[number]) => ({
    ...emptyItem(plan.date),
    title: plan.title,
    pillar: plan.pillar,
    hook: plan.hook,
    body: plan.body,
    cta: "Quer que eu analise sua operação? Me mande DIAGNÓSTICO.",
  });

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
          <div className="surface content-stat"><span>Planejados no mês</span><strong>16</strong><small>4 Reels por semana</small></div>
          <div className="surface content-stat"><span>Em produção</span><strong>{inProgress}</strong><small>roteiro, gravação ou edição</small></div>
          <div className="surface content-stat"><span>Publicados</span><strong>{published}</strong><small>{Math.round((published / 16) * 100)}% do plano concluído</small></div>
          <div className="surface content-stat highlight"><span>Cadência</span><strong>4</strong><small>seg · qua · sex · dom</small></div>
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
              const notes = calendar.notes.filter((note) => note.date === key);
              const plan = plannedItems.find((planned) => planned.date === key);
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const today = key === localDate(new Date());
              const week = contentWeek(day, visibleMonth);
              return (
                <div className={`calendar-day ${outside ? "outside" : ""} ${today ? "today" : ""} ${week ? `content-week week-${week}` : ""}`} key={key}>
                  {week && day.getDay() === 1 && <span className="week-label">Semana {week}</span>}
                  <div className="day-head"><span>{day.getDate()}</span><div className="day-actions"><button title="Adicionar anotação" aria-label={`Adicionar anotação em ${key}`} onClick={() => setNoteEditing({ id: crypto.randomUUID(), date: key, text: "" })}><StickyNote size={13} /></button><button title="Adicionar conteúdo" aria-label={`Adicionar conteúdo em ${key}`} onClick={() => setEditing(emptyItem(key))}><Plus size={14} /></button></div></div>
                  <div className="day-items">
                    {items.map((item) => <div className="content-entry" key={item.id}><button className={`content-chip ${STATUS[item.status].className}`} onClick={() => setEditing(item)}><span>{item.format}</span><strong>{item.title}</strong></button><button className={`content-check ${item.status === "published" ? "checked" : ""}`} title={item.status === "published" ? "Reabrir vídeo" : "Marcar vídeo como concluído"} aria-label={item.status === "published" ? `Reabrir ${item.title}` : `Concluir ${item.title}`} onClick={() => togglePublished(item)}><Check size={13} /></button></div>)}
                    {!items.length && plan && !outside && <div className="content-entry"><button className="content-chip planned" onClick={() => setEditing(itemFromPlan(plan))}><span>{plan.pillar}</span><strong>{plan.title}</strong></button><button className="content-check" title="Marcar vídeo como concluído" aria-label={`Concluir ${plan.title}`} onClick={() => togglePublished(itemFromPlan(plan))}><Check size={13} /></button></div>}
                    {!outside && <div className="story-plan"><span>Stories</span><strong>{STORY_PLAN[day.getDay()]}</strong></div>}
                    {notes.map((note) => <button className="calendar-note" key={note.id} onClick={() => setNoteEditing(note)}><StickyNote size={11} /><span>{note.text}</span></button>)}
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

        <section className="recording-guide surface">
          <div className="recording-preview"><strong>GANCHO FORTE<br />EM ATÉ 3 LINHAS</strong><div><Camera size={34} /></div><b>legenda automática<br />acompanhando a fala</b></div>
          <div><span className="eyebrow">PADRÃO VISUAL DOS REELS</span><h2>Mateus pensando em voz alta na mesa.</h2><p>Celular vertical e parado, lente 1x na altura dos olhos, vídeo central, gancho no topo e legendas na parte inferior. Use cortes secos apenas para retirar pausas e repetições.</p><div className="recording-tags"><span>40–75 segundos</span><span>Sem teleprompter</span><span>Sem B-roll obrigatório</span><span>4 vídeos em uma sessão</span></div></div>
        </section>

        <section className="insights-panel surface">
          <div className="insights-heading"><div><span className="eyebrow">CAIXA DE CAPTURA</span><h2>Insights e ideias</h2><p>Anote em uma frase. O sistema sugere a categoria automaticamente e você pode corrigir quando quiser.</p></div><span className="insight-count">{calendar.insights.length} {calendar.insights.length === 1 ? "ideia" : "ideias"}</span></div>
          <form className="insight-capture" onSubmit={addInsight}><Lightbulb size={19} /><input value={insightDraft} onChange={(event) => setInsightDraft(event.target.value)} placeholder="Ex.: Cliente queria aumentar o orçamento, mas o problema estava no atendimento..." /><button className="primary-btn" type="submit"><Plus size={16} /> Adicionar insight</button></form>
          <div className="insights-list">
            {!calendar.insights.length && <div className="empty-insights"><Sparkles size={19} /><span>Suas ideias rápidas vão aparecer aqui, sem precisar preencher um roteiro inteiro.</span></div>}
            {calendar.insights.map((insight) => <article className="insight-card" key={insight.id}><div><p>{insight.text}</p><small>{new Date(insight.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></div><div className="insight-actions"><select value={insight.category} onChange={(event) => updateInsightCategory(insight.id, event.target.value)} aria-label={`Categoria de ${insight.text}`}>{calendar.pillars.map((pillar) => <option key={pillar}>{pillar}</option>)}</select><button className="ghost-btn" onClick={() => setEditing({ ...emptyItem(), title: insight.text, pillar: insight.category, hook: insight.text, notes: "Criado a partir da caixa de Insights." })}>Agendar <ArrowRight size={14} /></button><button className="insight-delete" onClick={() => removeInsight(insight.id)} aria-label={`Excluir ${insight.text}`}><Trash2 size={15} /></button></div></article>)}
          </div>
          <div className="classification-note"><strong>Como a categoria é escolhida?</strong><span>Palavras como “cliente”, “campanha” e “resultado” indicam História real; “Speedy”, “processo” e “dashboard” indicam Bastidor; “acho”, “discordo” e “métrica” indicam Opinião. A sugestão nunca é definitiva: o seletor permite alterar.</span></div>
        </section>
      </div>

      {editing && <ContentEditor item={editing} pillars={calendar.pillars} onClose={() => setEditing(null)} onSave={saveItem} onRemove={removeItem} />}
      {noteEditing && <NoteEditor note={noteEditing} onClose={() => setNoteEditing(null)} onSave={saveNote} onRemove={removeNote} />}
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
          <label className="wide"><span>Mapa de gravação</span><textarea value={draft.body} onChange={(e) => update("body", e.target.value)} placeholder={"Contexto:\nProblema aparente:\nDescoberta ou problema verdadeiro:\nDecisão:\nConclusão:"} rows={9} /></label>
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

function NoteEditor({ note, onClose, onSave, onRemove }: { note: CalendarNote; onClose: () => void; onSave: (note: CalendarNote) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState(note.text);
  return (
    <div className="editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="note-editor surface elevated">
        <header><div><span className="editor-kicker"><StickyNote size={15} /> Anotação do dia</span><h2>{new Date(`${note.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva um lembrete, uma ideia rápida ou algo que aconteceu neste dia..." rows={8} />
        <footer>{note.text && <button className="danger-button" onClick={() => onRemove(note.id)}><Trash2 size={15} /> Excluir</button>}<div><button className="ghost-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" onClick={() => onSave({ ...note, text })}><Check size={16} /> Salvar anotação</button></div></footer>
      </aside>
    </div>
  );
}
