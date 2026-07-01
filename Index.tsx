import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  Crosshair,
  DollarSign,
  Flag,
  Megaphone,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseStateAdapter } from "./src/lib/persistence";
import { supabase } from "./src/lib/supabase";

const BRL = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const NUM = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const statusFromPct = (p: number, hasGoal: boolean) => {
  if (!hasGoal) return "validation";
  if (p >= 100) return "ok";
  if (p >= 70) return "warn";
  return "bad";
};

const statusLabel = {
  ok: "Dentro da meta",
  warn: "Atenção",
  bad: "Abaixo da meta",
  validation: "Em validação",
} as const;

type Status = keyof typeof statusLabel;
type Funnel = {
  investment: number;
  leads: number;
  qualified: number;
  meetingsBooked: number;
  meetingsDone: number;
  proposals: number;
  closed: number;
  ticket: number;
};
type Market = Funnel;
type MonthRow = {
  month: string;
  revenue: number;
  investment: number;
  leads: number;
  qualified: number;
  meetings: number;
  proposals: number;
  closed: number;
  lost: number;
  ticket: number;
  notes: string;
};
type Task = { id: string; label: string; done: boolean };
type AppState = {
  revenueNow: number;
  revenueGoal: number;
  leads: { goal: number; done: number };
  meetings: { goal: number; done: number };
  creatives: { goal: number; done: number };
  budgetBR: number;
  budgetUS: number;
  commercial: {
    newClientsGoal: number;
    ticketMin: number;
    conversion: number;
    meetingsToClose: number;
    churn: number;
    safeMeetings: number;
  };
  funnel: Funnel;
  br: Market;
  us: Market;
  months: MonthRow[];
  tasks: Task[];
};

const defaultMonths: MonthRow[] = [
  "Junho/2026",
  "Julho/2026",
  "Agosto/2026",
  "Setembro/2026",
  "Outubro/2026",
  "Novembro/2026",
  "Dezembro/2026",
].map((month, i) => ({
  month,
  revenue: i === 0 ? 22170 : 0,
  investment: 0,
  leads: 0,
  qualified: 0,
  meetings: 0,
  proposals: 0,
  closed: 0,
  lost: 0,
  ticket: 2000,
  notes: "",
}));

const ACTIVE_CLIENTS = [
  { name: "Jessica Bruns", value: 4350 },
  { name: "Dra. Mirella", value: 1800 },
  { name: "Braga Legal", value: 3220 },
  { name: "Miranda Skin", value: 2700 },
  { name: "Favela Beats", value: 3500 },
  { name: "Diamond X", value: 1000 },
  { name: "Excellence Detail", value: 2000 },
  { name: "CellStory", value: 1800 },
  { name: "Evox Performance", value: 1800 },
];

const activeClientCount = ACTIVE_CLIENTS.length;
const activeRecurringRevenue = ACTIVE_CLIENTS.reduce((sum, client) => sum + client.value, 0);
const activeAverageTicket = activeRecurringRevenue / activeClientCount;

const DEFAULTS: AppState = {
  revenueNow: activeRecurringRevenue,
  revenueGoal: 40000,
  leads: { goal: 0, done: 0 },
  meetings: { goal: 10, done: 0 },
  creatives: { goal: 20, done: 0 },
  budgetBR: 2000,
  budgetUS: 2000,
  commercial: {
    newClientsGoal: 2,
    ticketMin: 2000,
    conversion: 20,
    meetingsToClose: 10,
    churn: 0.5,
    safeMeetings: 12,
  },
  funnel: { investment: 0, leads: 0, qualified: 0, meetingsBooked: 0, meetingsDone: 0, proposals: 0, closed: 0, ticket: 0 },
  br: { investment: 0, leads: 0, qualified: 0, meetingsBooked: 0, meetingsDone: 0, proposals: 0, closed: 0, ticket: 0 },
  us: { investment: 0, leads: 0, qualified: 0, meetingsBooked: 0, meetingsDone: 0, proposals: 0, closed: 0, ticket: 0 },
  months: defaultMonths,
  tasks: [
    { id: "t1", label: "Definir foco de prospecção da semana", done: false },
    { id: "t2", label: "Escolher a oferta/mensagem principal", done: false },
    { id: "t3", label: "Separar contas para follow-up", done: false },
  ],
};

const SUGGESTIONS = [
  "Definir foco de prospecção da semana",
  "Escolher a oferta/mensagem principal",
  "Separar contas para follow-up",
  "Definir lista de leads prioritários",
  "Reativar leads antigos",
  "Ajustar abordagem comercial",
];

const SHEET_CONFIG = {
  id: "158zITytJmMky2kzdeAGRpLC5HOK31Y_veaQsYrkyOfM",
  gid: "917809113",
  brTotalRange: "D77:P77",
  usTotalRange: "D116:P116",
};

type SheetStatus = "idle" | "loading" | "success" | "error";

type GoogleCell = { v?: unknown; f?: string } | null;
type GoogleResponse = { table?: { rows?: Array<{ c?: GoogleCell[] }> } };

const parseSheetNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const normalized = value
    .split("R$").join("")
    .split(" ").join("")
    .split(".").join("")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

function readGoogleRange(range: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const callbackName = "__speedySheet" + Date.now() + Math.round(Math.random() * 100000);
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao ler a planilha."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete (window as any)[callbackName];
    };

    (window as any)[callbackName] = (response: GoogleResponse) => {
      cleanup();
      const cells = response.table?.rows?.[0]?.c || [];
      resolve(cells.map((cell) => cell?.v ?? cell?.f ?? ""));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível acessar a planilha."));
    };

    const params = new URLSearchParams({
      gid: SHEET_CONFIG.gid,
      range,
      tqx: "out:json;responseHandler:" + callbackName,
    });
    script.src = "https://docs.google.com/spreadsheets/d/" + SHEET_CONFIG.id + "/gviz/tq?" + params.toString();
    document.body.appendChild(script);
  });
}

function sheetTotalToMarket(row: unknown[]): Market {
  return {
    investment: parseSheetNumber(row[1]),
    leads: parseSheetNumber(row[2]),
    qualified: parseSheetNumber(row[4]),
    meetingsDone: parseSheetNumber(row[5]),
    meetingsBooked: parseSheetNumber(row[6]),
    proposals: 0,
    closed: parseSheetNumber(row[7]),
    ticket: parseSheetNumber(row[8]),
  };
}

const STORAGE_KEY = "speedy-os-v5";

function normalizeState(parsed: Partial<AppState>): AppState {
  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks.map((task: any) => ({
        id: task?.id || crypto.randomUUID(),
        label: String(task?.label || "Nova decisão"),
        done: Boolean(task?.done),
      }))
    : DEFAULTS.tasks;

  return {
    ...DEFAULTS,
    ...parsed,
    leads: { ...DEFAULTS.leads, ...parsed.leads },
    meetings: { ...DEFAULTS.meetings, ...parsed.meetings },
    creatives: { ...DEFAULTS.creatives, ...parsed.creatives },
    commercial: { ...DEFAULTS.commercial, ...parsed.commercial },
    funnel: { ...DEFAULTS.funnel, ...parsed.funnel },
    br: { ...DEFAULTS.br, ...parsed.br },
    us: { ...DEFAULTS.us, ...parsed.us },
    months: Array.isArray(parsed.months) ? parsed.months : DEFAULTS.months,
    tasks,
  };
}

function NumberField({
  value,
  onChange,
  prefix,
  suffix,
  className = "",
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    setText(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <span className={"number-field " + className}>
      {prefix && <span className="field-affix">{prefix}</span>}
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? "0"}
        onChange={(event) => {
          const raw = event.target.value;
          const n = Number.parseFloat(raw.replace(",", "."));
          setText(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
      {suffix && <span className="field-affix">{suffix}</span>}
    </span>
  );
}

function ProgressBar({ value, tone = "ok" }: { value: number; tone?: Status }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-track">
      <div className={"progress-fill tone-" + tone} style={{ width: width + "%" }} />
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return <span className={"status-pill tone-" + status}>{statusLabel[status]}</span>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Activity; title: string }) {
  return (
    <div className="section-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="mini-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function LeverCard({
  icon: Icon,
  title,
  description,
  goal,
  done,
  onGoal,
  onDone,
  unit = "",
}: {
  icon: typeof Users;
  title: string;
  description: string;
  goal: number;
  done: number;
  onGoal: (n: number) => void;
  onDone: (n: number) => void;
  unit?: string;
}) {
  const hasGoal = goal > 0;
  const progress = pct(done, goal);
  const status = statusFromPct(progress, hasGoal) as Status;

  return (
    <div className="surface lever-card">
      <div className="card-head">
        <div className="title-cluster">
          <div className="icon-box"><Icon size={20} /></div>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="two-cols">
        <label>
          <span>Meta mensal</span>
          <NumberField value={goal} onChange={onGoal} suffix={unit} />
        </label>
        <label>
          <span>Realizado</span>
          <NumberField value={done} onChange={onDone} suffix={unit} />
        </label>
      </div>
      <div>
        <div className="progress-caption">
          <span>{hasGoal ? progress + "% da meta" : "Sem meta definida"}</span>
          <span>{NUM(done)} / {hasGoal ? NUM(goal) : "—"}</span>
        </div>
        <ProgressBar value={progress} tone={status} />
      </div>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Não foi possível entrar. Confira e-mail e senha.");
      return;
    }

    toast.success("Login realizado.");
  };

  return (
    <main className="app-shell auth-shell">
      <form className="auth-card surface elevated" onSubmit={login}>
        <div className="brand-line"><span /> Speedy Media OS</div>
        <h1>Acessar dashboard</h1>
        <p>Entre com o usuário criado no Supabase para editar e salvar os dados do painel.</p>

        <label className="auth-field">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label className="auth-field">
          <span>Senha</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function LoadingScreen({ label = "Carregando dashboard..." }: { label?: string }) {
  return (
    <main className="app-shell auth-shell">
      <div className="auth-card surface elevated loading-card">
        <div className="brand-line"><span /> Speedy Media OS</div>
        <h1>{label}</h1>
      </div>
    </main>
  );
}

export default function Index() {
  const [state, setState] = useState<AppState>(DEFAULTS);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [hideFinancials, setHideFinancials] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<SheetStatus>("idle");
  const [sheetUpdatedAt, setSheetUpdatedAt] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setAuthReady(true));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!session?.user.id) {
      setState(DEFAULTS);
      setReady(true);
      return;
    }

    const adapter = createSupabaseStateAdapter<AppState>(supabase, session.user.id);
    setReady(false);
    adapter.load()
      .then((saved) => {
        setState(saved ? normalizeState(saved) : DEFAULTS);
      })
      .catch(() => toast.error("Não foi possível carregar os dados do Supabase."))
      .finally(() => setReady(true));
  }, [authReady, session?.user.id]);

  useEffect(() => {
    if (!ready || !session?.user.id) return;

    const adapter = createSupabaseStateAdapter<AppState>(supabase, session.user.id);
    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      adapter.save(state)
        .then(() => setSaveStatus("saved"))
        .catch(() => {
          setSaveStatus("error");
          toast.error("Não foi possível salvar no Supabase.");
        });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [ready, state, session?.user.id]);

  useEffect(() => {
    if (ready && session?.user.id) void syncGoogleSheets(false);
  }, [ready, session?.user.id]);

  if (!authReady) return <LoadingScreen label="Conectando ao Supabase..." />;
  if (!session) return <AuthScreen />;
  if (!ready) return <LoadingScreen />;

  const moneyClass = hideFinancials ? "money-value is-hidden" : "money-value";
  const userEmail = session.user.email || "Usuário";
  const saveLabel = saveStatus === "saving" ? "Salvando..." : saveStatus === "error" ? "Erro ao salvar" : "Salvo no Supabase";

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.info("Sessão encerrada.");
  };

  const set = <K extends keyof AppState>(key: K, value: AppState[K]) => setState((current) => ({ ...current, [key]: value }));
  const setNested = <K extends keyof AppState>(key: K, sub: string, value: number) =>
    setState((current) => ({ ...current, [key]: { ...(current[key] as object), [sub]: value } as AppState[K] }));

  const syncGoogleSheets = async (showToast = false) => {
    setSheetStatus("loading");
    try {
      const [brRow, usRow] = await Promise.all([
        readGoogleRange(SHEET_CONFIG.brTotalRange),
        readGoogleRange(SHEET_CONFIG.usTotalRange),
      ]);
      const nextBr = sheetTotalToMarket(brRow);
      const nextUs = sheetTotalToMarket(usRow);

      setState((current) => ({
        ...current,
        br: nextBr,
        us: nextUs,
      }));
      setSheetUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setSheetStatus("success");
      if (showToast) toast.success("Dados da planilha atualizados.");
    } catch {
      setSheetStatus("error");
      if (showToast) toast.error("Não foi possível ler a planilha.");
    }
  };

  const combinedFunnel: Funnel = {
    investment: state.br.investment + state.us.investment,
    leads: state.br.leads + state.us.leads,
    qualified: state.br.qualified + state.us.qualified,
    meetingsBooked: state.br.meetingsBooked + state.us.meetingsBooked,
    meetingsDone: state.br.meetingsDone + state.us.meetingsDone,
    proposals: state.br.proposals + state.us.proposals,
    closed: state.br.closed + state.us.closed,
    ticket: (state.br.closed + state.us.closed) > 0
      ? ((state.br.ticket * state.br.closed) + (state.us.ticket * state.us.closed)) / (state.br.closed + state.us.closed)
      : 0,
  };
  const actualMeetings = combinedFunnel.meetingsDone;
  const revenuePct = pct(state.revenueNow, state.revenueGoal);
  const revenueStatus = statusFromPct(revenuePct, state.revenueGoal > 0) as Status;
  const revenueGap = Math.max(0, state.revenueGoal - state.revenueNow);
  const projectedClients = (actualMeetings * state.commercial.conversion) / 100;
  const projectedRevenue = projectedClients * state.commercial.ticketMin;
  const clientsGap = Math.max(0, state.commercial.newClientsGoal - projectedClients);
  const meetingsGap = Math.max(0, state.commercial.safeMeetings - actualMeetings);
  const doneTasks = state.tasks.filter((task) => task.done).length;
  const taskPct = state.tasks.length ? pct(doneTasks, state.tasks.length) : 0;
  const totalClosed = state.months.reduce((sum, row) => sum + row.closed, 0);
  const totalRevenue = state.months.reduce((sum, row) => sum + row.revenue, 0);
  const totalInvestment = state.months.reduce((sum, row) => sum + row.investment, 0);
  const blendedCac = totalClosed > 0 ? totalInvestment / totalClosed : null;
  const averageTicket = totalClosed > 0 ? totalRevenue / totalClosed : state.commercial.ticketMin;

  const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "Em validação");
  const renderFunnel = (marketKey: "br" | "us", title: string) => {
    const market = state[marketKey];
    const steps = [
      { key: "investment", label: "Investimento", money: true, conv: null, convLabel: "" },
      { key: "leads", label: "Leads gerados", conv: null, convLabel: "" },
      { key: "qualified", label: "Leads qualificados", conv: conv(market.qualified, market.leads), convLabel: "qualificação" },
      { key: "meetingsBooked", label: "Reuniões agendadas", conv: conv(market.meetingsBooked, market.qualified), convLabel: "lead → reunião" },
      { key: "meetingsDone", label: "Reuniões realizadas", conv: conv(market.meetingsDone, market.meetingsBooked), convLabel: "show-up" },
      { key: "closed", label: "Clientes fechados", conv: conv(market.closed, market.meetingsDone), convLabel: "reunião → cliente" },
      { key: "ticket", label: "Ticket", money: true, conv: null, convLabel: "" },
    ];

    return (
      <section>
        <SectionTitle icon={Activity} title={title} />
        <div className="surface table-scroll funnel-strip funnel-strip-six">
          {steps.map((step, index) => (
            <div className="funnel-step" key={step.key}>
              <span>Etapa {index + 1}</span>
              <strong>{step.label}</strong>
              <span className={step.money ? moneyClass : undefined}><NumberField value={market[step.key as keyof Market]} onChange={(v) => setNested(marketKey, step.key, v)} prefix={step.money ? "R$" : undefined} /></span>
              {step.conv && <small>{step.convLabel}: <b>{step.conv}</b></small>}
            </div>
          ))}
        </div>
      </section>
    );
  };

  const diagnosis = useMemo(() => {
    const qOk = state.leads.goal > 0 ? combinedFunnel.qualified >= state.leads.goal * 0.7 : combinedFunnel.qualified >= 10;
    const mOk = combinedFunnel.meetingsDone >= state.meetings.goal * 0.7;
    const cOk = combinedFunnel.closed >= state.commercial.newClientsGoal;

    if (!qOk) return {
      tone: "bad" as Status,
      title: "Gargalo provável: geração de leads qualificados.",
      detail: "O topo do funil está abaixo do necessário. Foque em criativos, oferta e investimento em tráfego.",
    };
    if (qOk && !mOk) return {
      tone: "warn" as Status,
      title: "Gargalo provável: conversão de lead em reunião.",
      detail: "Leads chegam, mas não viram reunião. Revise qualificação, abordagem e velocidade de resposta.",
    };
    if (mOk && !cOk) return {
      tone: "warn" as Status,
      title: "Gargalo provável: fechamento comercial/oferta.",
      detail: "As reuniões acontecem, mas não fecham. Trabalhe oferta, proposta, prova e processo comercial.",
    };
    return {
      tone: "ok" as Status,
      title: "Sistema dentro do planejado.",
      detail: "Todos os principais indicadores estão saudáveis. Mantenha o ritmo de testes e follow-ups.",
    };
  }, [state, combinedFunnel]);

  const operatingPlan = useMemo(() => [
    {
      title: "Proteger a agenda comercial",
      detail: meetingsGap > 0
        ? "Faltam " + NUM(meetingsGap) + " reuniões para a meta segura. Priorize follow-up, reativação e resposta rápida."
        : "A agenda está no ritmo. Use a sobra de energia para melhorar proposta e fechamento.",
      tone: meetingsGap > 0 ? "bad" as Status : "ok" as Status,
    },
    {
      title: "Fechar o gap de faturamento",
      detail: revenueGap > 0
        ? "Ainda faltam " + BRL(revenueGap) + " para a meta macro. Use reuniões qualificadas como alavanca central."
        : "Meta macro alcançada. Agora o foco é manter margem, qualidade e previsibilidade.",
      tone: revenueGap > 0 ? "warn" as Status : "ok" as Status,
    },
  ], [meetingsGap, revenueGap]);

  const exportPdf = () => {
    toast.info("A janela de impressão será aberta. Escolha salvar como PDF.");
    window.setTimeout(() => window.print(), 100);
  };

  const exportSummary = async () => {
    const lines = [
      "RESUMO - Sistema Operacional Speedy",
      "Faturamento atual: " + BRL(state.revenueNow) + " / Meta " + BRL(state.revenueGoal) + " (" + revenuePct + "%)",
      "",
      "BASE JULHO",
      "Clientes ativos: " + NUM(activeClientCount),
      "Receita recorrente: " + BRL(activeRecurringRevenue),
      "Ticket médio: " + BRL(activeAverageTicket),
      "",
      "ALAVANCA PRINCIPAL",
      "Reuniões qualificadas: " + NUM(actualMeetings) + " / " + NUM(state.meetings.goal),
      "Faltam reuniões: " + NUM(Math.max(0, state.meetings.goal - actualMeetings)),
      "Investimento realizado: " + BRL(combinedFunnel.investment) + " (BR " + BRL(state.br.investment) + " + EUA " + BRL(state.us.investment) + ")",
      "",
      "META COMERCIAL",
      "Clientes projetados: " + projectedClients.toFixed(1) + " (gap " + clientsGap.toFixed(1) + ")",
      "Receita projetada: " + BRL(projectedRevenue),
      "Reuniões necessárias: " + state.commercial.safeMeetings + " (gap " + meetingsGap + ")",
      "",
      "DIAGNÓSTICO: " + diagnosis.title,
      diagnosis.detail,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      toast.success("Resumo copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o resumo.");
    }
  };

  return (
    <main className={"app-shell" + (hideFinancials ? " hide-financials" : "")}>
      <div className="page-wrap">
        <header className="hero">
          <div className="hero-copy">
            <div className="brand-line"><span /> Speedy Media OS</div>
            <h1>Sistema Operacional Speedy</h1>
            <p>Meta macro: <strong>R$ 40.000/mês</strong> até dezembro de 2026.</p>
          </div>
          <div className="hero-actions">
            <span className="user-chip">{userEmail}</span>
            <button className="ghost-btn" onClick={signOut}>Sair</button>
            <button className="ghost-btn" onClick={() => setHideFinancials((current) => !current)}>{hideFinancials ? <Eye size={12} /> : <EyeOff size={12} />} {hideFinancials ? "Mostrar" : "Ocultar"}</button>
            <button className="ghost-btn" onClick={() => syncGoogleSheets(true)} disabled={sheetStatus === "loading"}><RefreshCw size={12} /> {sheetStatus === "loading" ? "Atualizando" : "Atualizar planilha"}</button>
            <button className="primary-btn" onClick={exportPdf}><FileDown size={12} /> Exportar PDF</button>
            <button className="ghost-btn" onClick={exportSummary}><Copy size={12} /> Copiar resumo</button>
          </div>
        </header>

        <div className={"sheet-status tone-" + sheetStatus}>{sheetStatus === "success" ? "Planilha atualizada" + (sheetUpdatedAt ? " às " + sheetUpdatedAt : "") : sheetStatus === "error" ? "Não foi possível ler a planilha" : "Dados comerciais vinculados à planilha"} · {saveLabel}</div>

        <section className="revenue-panel surface elevated">
          <div className="revenue-grid">
            <div className="metric-lead">
              <div className="icon-box large"><DollarSign size={22} /></div>
              <div>
                <span>Faturamento atual</span>
                <strong className={moneyClass}><NumberField value={state.revenueNow} onChange={(v) => set("revenueNow", v)} prefix="R$" /></strong>
              </div>
            </div>
            <div className="metric-right">
              <span>Meta</span>
              <strong className={moneyClass}><NumberField value={state.revenueGoal} onChange={(v) => set("revenueGoal", v)} prefix="R$" /></strong>
            </div>
          </div>
          <div className="progress-caption"><span>Progresso até a meta macro</span><strong className="progress-percent">{revenuePct}%</strong></div>
          <ProgressBar value={revenuePct} tone={revenueStatus} />
          <div className="revenue-context">
            <MiniStat label="Clientes ativos" value={<span className={moneyClass}>{NUM(activeClientCount)}</span>} />
            <MiniStat label="Receita recorrente" value={<span className={moneyClass}>{BRL(activeRecurringRevenue)}</span>} />
            <MiniStat label="Ticket médio" value={<span className={moneyClass}>{BRL(activeAverageTicket)}</span>} />
          </div>
        </section>

        <section className="clean-summary">
          <MiniStat label="Gap para a meta" value={<span className={moneyClass}>{BRL(revenueGap)}</span>} sub="faturamento restante" />
          <MiniStat label="Faltam reuniões" value={NUM(meetingsGap)} sub={"meta segura " + state.commercial.safeMeetings} />
          <MiniStat label="Decisões da semana" value={taskPct + "%"} sub={doneTasks + " de " + state.tasks.length + " definidas"} />
        </section>

        <section className="main-lever-section">
          <div className="primary-lever-panel surface">
            <div className="primary-lever-copy">
              <span className="eyebrow">Alavanca principal</span>
              <h2>Gerar mais reuniões qualificadas</h2>
              <p>{diagnosis.detail}</p>
            </div>
            <div className="primary-lever-score">
              <span>Faltam reuniões</span>
              <strong>{NUM(Math.max(0, state.meetings.goal - actualMeetings))}</strong>
              <small>{NUM(actualMeetings)} feitas de {NUM(state.meetings.goal)} planejadas</small>
              <ProgressBar value={pct(actualMeetings, state.meetings.goal)} tone={statusFromPct(pct(actualMeetings, state.meetings.goal), state.meetings.goal > 0) as Status} />
            </div>
          </div>
        </section>

        <details className="advanced-section">
          <summary>Dados avançados</summary>
          <section>
            <SectionTitle icon={Target} title="Meta Comercial" />
          <div className="cards-grid six">
            <MiniStat label="Clientes novos/mês" value={<NumberField value={state.commercial.newClientsGoal} onChange={(v) => setNested("commercial", "newClientsGoal", v)} />} />
            <MiniStat label="Ticket médio mínimo" value={<span className={moneyClass}><NumberField value={state.commercial.ticketMin} onChange={(v) => setNested("commercial", "ticketMin", v)} prefix="R$" /></span>} />
            <MiniStat label="Taxa de conversão" value={<NumberField value={state.commercial.conversion} onChange={(v) => setNested("commercial", "conversion", v)} suffix="%" />} sub="reunião → cliente" />
            <MiniStat label="Reuniões p/ 2 clientes" value={<NumberField value={state.commercial.meetingsToClose} onChange={(v) => setNested("commercial", "meetingsToClose", v)} />} />
            <MiniStat label="Churn esperado" value={<NumberField value={state.commercial.churn} onChange={(v) => setNested("commercial", "churn", v)} />} sub="cliente/mês" />
            <MiniStat label="Meta segura reuniões" value={<NumberField value={state.commercial.safeMeetings} onChange={(v) => setNested("commercial", "safeMeetings", v)} />} />
          </div>
          <div className="cards-grid four compact-top">
            <MiniStat label="Clientes projetados" value={projectedClients.toFixed(1)} sub={"baseado em " + actualMeetings + " reuniões"} />
            <MiniStat label="Receita projetada" value={<span className={moneyClass}>{BRL(projectedRevenue)}</span>} />
            <MiniStat label="Faltam clientes" value={clientsGap.toFixed(1)} sub={"meta " + state.commercial.newClientsGoal} />
            <MiniStat label="Faltam reuniões" value={NUM(meetingsGap)} sub={"meta segura " + state.commercial.safeMeetings} />
          </div>
        </section>

        {renderFunnel("br", "Funil Comercial BR")}
        {renderFunnel("us", "Funil Comercial EUA")}

        <section>
          <SectionTitle icon={TrendingUp} title="Aquisição por Mercado" />
          <div className="cards-grid two">
            {[
              { key: "br", budgetKey: "budgetBR", code: "BR", title: "Brasil", status: "Dados do Funil Comercial BR" },
              { key: "us", budgetKey: "budgetUS", code: "EUA", title: "Estados Unidos", status: "Dados do Funil Comercial EUA" },
            ].map(({ key, budgetKey, code, title, status }) => {
              const market = state[key as "br" | "us"];
              const cpl = market.leads > 0 ? market.investment / market.leads : null;
              const cac = market.closed > 0 ? market.investment / market.closed : null;
              const budgetValue = state[budgetKey as "budgetBR" | "budgetUS"];
              return (
                <div className="surface market-card" key={key}>
                  <div className="market-head"><h3><span>{code}</span>{title}</h3><em>{status}</em></div>
                  <div className="market-grid">
                    <label className="metric-box"><span>Meta de investimento</span><span className={moneyClass}><NumberField value={budgetValue} onChange={(v) => set(budgetKey as "budgetBR" | "budgetUS", v)} prefix="R$" /></span></label>
                    <div className="metric-box"><span>Investimento</span><strong className={moneyClass}>{BRL(market.investment)}</strong></div>
                    <div className="metric-box"><span>Leads gerados</span><strong>{NUM(market.leads)}</strong></div>
                    <div className="metric-box"><span>Leads qualificados</span><strong>{NUM(market.qualified)}</strong></div>
                    <div className="metric-box"><span>Reuniões realizadas</span><strong>{NUM(market.meetingsDone)}</strong></div>
                    <div className="metric-box"><span>Clientes fechados</span><strong>{NUM(market.closed)}</strong></div>
                    <div className="metric-box"><span>Ticket</span><strong className={moneyClass}>{market.ticket ? BRL(market.ticket) : "Em validação"}</strong></div>
                    <div className="metric-box"><span>CPL</span><strong className={moneyClass}>{cpl ? BRL(cpl) : "Em validação"}</strong></div>
                    <div className="metric-box"><span>CAC</span><strong className={moneyClass}>{cac ? BRL(cac) : "Em validação"}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle icon={BarChart3} title="Scoreboard Mensal 2026" />
          <div className="surface table-scroll scoreboard-wrap">
            <table className="scoreboard-table">
              <colgroup>
                <col className="month-col" />
                <col />
                <col />
                <col className="small-col" />
                <col className="small-col" />
                <col className="small-col" />
                <col className="small-col" />
                <col className="small-col" />
                <col className="small-col" />
                <col className="ticket-col" />
                <col />
                <col className="notes-col" />
              </colgroup>
              <thead><tr>{["Mês", "Faturamento", "Investimento", "Leads", "Qualificados", "Reuniões", "Fechados", "Perdidos", "Saldo", "Ticket", "CAC", "Obs."].map((head) => <th key={head}>{head}</th>)}</tr></thead>
              <tbody>
                {state.months.map((row, index) => {
                  const saldo = row.closed - row.lost;
                  const cac = row.closed > 0 ? row.investment / row.closed : null;
                  const update = (key: keyof MonthRow, value: string | number) => {
                    const next = [...state.months];
                    next[index] = { ...next[index], [key]: value } as MonthRow;
                    set("months", next);
                  };
                  return (
                    <tr key={row.month}>
                      <td><strong>{row.month}</strong></td>
                      <td className={moneyClass}><NumberField value={row.revenue} onChange={(v) => update("revenue", v)} prefix="R$" /></td>
                      <td className={moneyClass}><NumberField value={row.investment} onChange={(v) => update("investment", v)} prefix="R$" /></td>
                      <td><NumberField value={row.leads} onChange={(v) => update("leads", v)} /></td>
                      <td><NumberField value={row.qualified} onChange={(v) => update("qualified", v)} /></td>
                      <td><NumberField value={row.meetings} onChange={(v) => update("meetings", v)} /></td>
                      <td><NumberField value={row.closed} onChange={(v) => update("closed", v)} /></td>
                      <td><NumberField value={row.lost} onChange={(v) => update("lost", v)} /></td>
                      <td className={saldo > 0 ? "positive" : saldo < 0 ? "negative" : ""}>{saldo}</td>
                      <td className={"ticket-cell " + moneyClass}><NumberField value={row.ticket} onChange={(v) => update("ticket", v)} prefix="R$" /></td>
                      <td className={moneyClass}>{cac ? BRL(cac) : "—"}</td>
                      <td><input className="text-cell" value={row.notes} placeholder="—" onChange={(event) => update("notes", event.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        </details>

        <section className="cards-grid two align-start clean-bottom">
          <div>
            <SectionTitle icon={CheckCircle2} title="Decisões da semana" />
            <div className="surface task-panel">
              {state.tasks.length === 0 && <p className="empty">Nenhuma decisão definida. Adicione uma abaixo ou escolha uma sugestão.</p>}
              {state.tasks.map((task) => {
                const updateTask = (patch: Partial<Task>) => set("tasks", state.tasks.map((item) => item.id === task.id ? { ...item, ...patch } : item));
                const removeTask = () => set("tasks", state.tasks.filter((item) => item.id !== task.id));
                return (
                  <div className="task-row" key={task.id}>
                    <button onClick={() => updateTask({ done: !task.done })} aria-label="Concluir decisão">{task.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
                    <input className={task.done ? "done" : ""} value={task.label} onChange={(event) => updateTask({ label: event.target.value })} />
                    <button onClick={removeTask} aria-label="Excluir decisão"><X size={16} /></button>
                  </div>
                );
              })}
              <form className="add-task" onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const label = String(data.get("newTask") || "").trim();
                if (!label) return;
                set("tasks", [...state.tasks, { id: crypto.randomUUID(), label, done: false }]);
                form.reset();
              }}>
                <input name="newTask" placeholder="Adicionar nova decisão..." />
                <button className="primary-btn"><Plus size={16} /> Adicionar</button>
              </form>
              <div className="suggestions">
                {SUGGESTIONS.map((suggestion) => {
                  const exists = state.tasks.some((task) => task.label.toLowerCase() === suggestion.toLowerCase());
                  return <button key={suggestion} disabled={exists} title={exists ? "Já adicionada" : "Adicionar decisão"} onClick={() => set("tasks", [...state.tasks, { id: crypto.randomUUID(), label: suggestion, done: false }])}>{exists ? <CheckCircle2 size={12} /> : <Plus size={12} />} {suggestion}</button>;
                })}
              </div>
            </div>
          </div>

          <div>
            <SectionTitle icon={ArrowUpRight} title="Plano recomendado" />
            <div className="surface action-plan">
              {operatingPlan.map((item) => (
                <div className={"action-item tone-border-" + item.tone} key={item.title}>
                  <div className="title-cluster"><div className={"dot tone-" + item.tone} /><div><h3>{item.title}</h3><p>{item.detail}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer>Sistema Operacional Speedy · Dados salvos localmente no navegador</footer>
      </div>
    </main>
  );
}
