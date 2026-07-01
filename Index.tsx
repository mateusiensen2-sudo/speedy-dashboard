import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  DollarSign,
  RefreshCw,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseStateAdapter } from "./src/lib/persistence";
import { supabase } from "./src/lib/supabase";

const BRL = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "-";

const NUM = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR") : "-");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_OPTIONS = ["Junho 2026", "Julho 2026", "Agosto 2026", "Setembro 2026", "Outubro 2026", "Novembro 2026", "Dezembro 2026"];

const getCurrentMonthSheetName = () => {
  const now = new Date();
  return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
};

const monthKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Task = { id: string; label: string; done: boolean };

type Funnel = {
  investment: number;
  leads: number;
  qualified: number;
  scheduled: number;
  meetings: number;
  clients: number;
  ticket: number;
};

type Market = Funnel & { budget: number };

type MonthRow = {
  month: string;
  revenue: number;
  meetings: number;
  clients: number;
  lost: number;
  ticket: number;
};

type RevenueBase = {
  monthSheet: string;
  totalRevenue: number;
  recurringRevenue: number;
  oneOffRevenue: number;
  activeClients: number;
  averageTicket: number;
};

type AppState = {
  selectedMonth: string;
  revenueGoal: number;
  revenueNow: number;
  meetingsGoal: number;
  budgetBR: number;
  budgetUS: number;
  br: Market;
  us: Market;
  decisions: string;
  commercial: { safeMeetings: number; closeRate: number; averageTicket: number };
  months: MonthRow[];
  tasks: Task[];
  revenueBase: RevenueBase;
};

const blankFunnel: Funnel = {
  investment: 0,
  leads: 0,
  qualified: 0,
  scheduled: 0,
  meetings: 0,
  clients: 0,
  ticket: 0,
};

const DEFAULT_REVENUE_BASE: RevenueBase = {
  monthSheet: getCurrentMonthSheetName(),
  totalRevenue: 0,
  recurringRevenue: 0,
  oneOffRevenue: 0,
  activeClients: 0,
  averageTicket: 0,
};

const DEFAULT_STATE: AppState = {
  selectedMonth: getCurrentMonthSheetName(),
  revenueGoal: 40000,
  revenueNow: 0,
  meetingsGoal: 10,
  budgetBR: 2000,
  budgetUS: 2000,
  br: { ...blankFunnel, budget: 2000 },
  us: { ...blankFunnel, budget: 2000 },
  revenueBase: DEFAULT_REVENUE_BASE,
  commercial: { safeMeetings: 10, closeRate: 25, averageTicket: 2500 },
  decisions: "Gerar mais reuniões qualificadas.\nRevisar oferta principal.\nPriorizar leads com maior chance de fechamento.",
  tasks: [
    { id: "t1", label: "Definir foco de prospecção da semana", done: false },
    { id: "t2", label: "Escolher a oferta/mensagem principal", done: false },
    { id: "t3", label: "Separar contas para follow-up", done: false },
    { id: "t4", label: "Definir lista de leads prioritários", done: true },
    { id: "t5", label: "Reativar leads antigos", done: true },
    { id: "t6", label: "Ajustar abordagem comercial", done: true },
  ],
  months: MONTH_NAMES.map((month) => ({
    month,
    revenue: 0,
    meetings: 0,
    clients: 0,
    lost: 0,
    ticket: 0,
  })),
};

const COMMERCIAL_SHEET = {
  id: "158zITytJmMky2kzdeAGRpLC5HOK31Y_veaQsYrkyOfM",
  brRange: "D77:P77",
  usRange: "D116:P116",
};

const REVENUE_SHEET = {
  id: "1xR-fHWaqlMezbu2jQFDQ1hqeDrPH_zIS",
  range: "C:F",
};

const mergeState = (saved: Partial<AppState> | null): AppState => {
  const selectedMonth = saved?.selectedMonth || getCurrentMonthSheetName();

  return {
    ...DEFAULT_STATE,
    ...saved,
    selectedMonth,
    br: { ...DEFAULT_STATE.br, ...saved?.br },
    us: { ...DEFAULT_STATE.us, ...saved?.us },
    commercial: { ...DEFAULT_STATE.commercial, ...saved?.commercial },
    revenueBase: { ...DEFAULT_REVENUE_BASE, monthSheet: selectedMonth, ...saved?.revenueBase },
    months: saved?.months?.length ? saved.months : DEFAULT_STATE.months,
    tasks: saved?.tasks?.length ? saved.tasks : DEFAULT_STATE.tasks,
  };
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;

  const cleaned = String(value || "")
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isRecurringContract = (value: unknown) => {
  const contract = normalizeText(value);

  if (!contract || contract === "x") return false;
  if (contract.includes("encerrado")) return false;
  if (contract.includes("avulso")) return false;
  if (contract.includes("pontual")) return false;
  if (contract.includes("ebook") || contract.includes("e-book")) return false;
  if (contract.includes("/")) return false;

  return ["mensal", "bimestral", "trimestral", "semestral", "anual", "recorrente", "contrato"].some((term) =>
    contract.includes(term),
  );
};

const readGoogleRows = async (spreadsheetId: string, sheet: string, range: string): Promise<unknown[][]> => {
  const callbackName = "googleSheetCallback_" + Math.random().toString(36).slice(2);
  const query = new URLSearchParams({ sheet, range, tqx: "out:json;responseHandler:" + callbackName });
  const url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/gviz/tq?" + query.toString();

  return new Promise((resolve, reject) => {
    const target = window as Window & typeof globalThis & Record<string, (payload: any) => void>;
    const script = document.createElement("script");

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("A planilha demorou para responder."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      delete target[callbackName];
      script.remove();
    };

    target[callbackName] = (payload: any) => {
      try {
        const rows = payload?.table?.rows || [];
        resolve(rows.map((row: any) => (row.c || []).map((cell: any) => cell?.v ?? cell?.f ?? "")));
      } catch (error) {
        reject(error);
      } finally {
        cleanup();
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível acessar a planilha. Verifique se ela está pública para leitura."));
    };

    script.src = url;
    document.head.appendChild(script);
  });
};

const readGoogleRange = async (spreadsheetId: string, sheet: string, range: string) => {
  const rows = await readGoogleRows(spreadsheetId, sheet, range);
  return rows[0] || [];
};

const sheetTotalToMarket = (row: unknown[]): Market => ({
  investment: parseNumber(row[0]),
  leads: parseNumber(row[1]),
  qualified: parseNumber(row[2]),
  scheduled: parseNumber(row[3]),
  meetings: parseNumber(row[4]),
  clients: parseNumber(row[5]),
  ticket: parseNumber(row[6]),
  budget: 2000,
});

const rowsToRevenueBase = (rows: unknown[][], monthSheet: string): RevenueBase => {
  const activeNames = new Set<string>();
  let totalRevenue = 0;
  let recurringRevenue = 0;

  rows.forEach((row) => {
    const name = String(row[0] || "").trim();
    const fee = parseNumber(row[1]);

    if (!fee || fee <= 0) return;

    totalRevenue += fee;

    if (name && isRecurringContract(row[2])) {
      activeNames.add(normalizeText(name));
      recurringRevenue += fee;
    }
  });

  const activeClients = activeNames.size;

  return {
    monthSheet,
    totalRevenue,
    recurringRevenue,
    oneOffRevenue: Math.max(0, totalRevenue - recurringRevenue),
    activeClients,
    averageTicket: activeClients ? recurringRevenue / activeClients : 0,
  };
};

function NumberField({
  value,
  onChange,
  prefix,
}: {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
}) {
  return (
    <label className="number-field">
      {prefix ? <span>{prefix}</span> : null}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MoneyField({
  value,
  onChange,
  hidden,
}: {
  value: number;
  onChange: (value: number) => void;
  hidden?: boolean;
}) {
  if (hidden) return <span className="masked-value">***</span>;

  return (
    <span className="money-edit">
      <span className="money-prefix">R$</span>
      <NumberField value={value} onChange={onChange} />
    </span>
  );
}

function TextArea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} />;
}

function StatCard({
  label,
  value,
  helper,
  hidden,
}: {
  label: string;
  value: string;
  helper?: string;
  hidden?: boolean;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{hidden ? "***" : value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <span style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </div>
  );
}

function FunnelCard({
  label,
  title,
  value,
  helper,
  hidden,
}: {
  label: string;
  title: string;
  value: string;
  helper?: string;
  hidden?: boolean;
}) {
  return (
    <div className="funnel-card">
      <span>{label}</span>
      <strong>{title}</strong>
      <p>{hidden ? "***" : value}</p>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showValues, setShowValues] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession((currentSession) => {
        if (currentSession?.user.id !== nextSession?.user.id) {
          setReady(false);
        }

        return nextSession;
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;

    let active = true;
    const adapter = createSupabaseStateAdapter<AppState>(supabase, session.user.id);

    adapter
      .load()
      .then((saved) => {
        if (!active) return;
        setState(mergeState(saved));
      })
      .catch(() => toast.error("Não foi possível carregar os dados salvos."))
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!ready || !session?.user.id) return;

    const timeout = window.setTimeout(() => {
      const adapter = createSupabaseStateAdapter<AppState>(supabase, session.user.id);

      setSaving(true);

      adapter
        .save(state)
        .catch(() => toast.error("Não foi possível salvar no Supabase."))
        .finally(() => setSaving(false));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [ready, session?.user.id, state]);

  const syncGoogleSheets = async (showToast = true) => {
    const sheetName = state.selectedMonth || getCurrentMonthSheetName();

    setSyncing(true);
    setSyncError("");

    try {
      const [brRow, usRow, revenueRows] = await Promise.all([
        readGoogleRange(COMMERCIAL_SHEET.id, sheetName, COMMERCIAL_SHEET.brRange),
        readGoogleRange(COMMERCIAL_SHEET.id, sheetName, COMMERCIAL_SHEET.usRange),
        readGoogleRows(REVENUE_SHEET.id, sheetName, REVENUE_SHEET.range),
      ]);

      const br = sheetTotalToMarket(brRow);
      const us = sheetTotalToMarket(usRow);
      const revenueBase = rowsToRevenueBase(revenueRows, sheetName);
      const selectedMonthName = sheetName.split(" ")[0];

      setState((current) => ({
        ...current,
        br: { ...br, budget: current.budgetBR },
        us: { ...us, budget: current.budgetUS },
        revenueNow: revenueBase.totalRevenue,
        revenueBase,
        months: current.months.map((row) =>
          monthKey(row.month) === monthKey(selectedMonthName)
            ? {
                ...row,
                revenue: revenueBase.totalRevenue,
                meetings: br.meetings + us.meetings,
                clients: br.clients + us.clients,
                ticket: revenueBase.averageTicket || row.ticket,
              }
            : row,
        ),
      }));

      setLastSync(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

      if (showToast) toast.success("Planilha atualizada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar a planilha.";
      setSyncError(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!ready || !session?.user.id) return;
    void syncGoogleSheets(false);
  }, [ready, session?.user.id, state.selectedMonth]);

  const login = async (event: FormEvent) => {
    event.preventDefault();

    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(false);

    if (error) toast.error("Não foi possível entrar. Confira e-mail e senha.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setReady(false);
  };

  const set = <K extends keyof AppState>(key: K, value: AppState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const hidden = !showValues;
  const revenuePct = pct(state.revenueNow, state.revenueGoal);
  const meetingsNow = state.br.meetings + state.us.meetings;
  const meetingGap = Math.max(0, state.meetingsGoal - meetingsNow);
  const sheetStatus = syncError ? "erro" : lastSync ? "ok" : "quiet";
  const sheetLabel = syncError || (lastSync ? "Planilha atualizada às " + lastSync : "Planilha ainda não atualizada");
  const brCpl = state.br.leads > 0 ? state.br.investment / state.br.leads : 0;
  const brCac = state.br.clients > 0 ? state.br.investment / state.br.clients : 0;
  const usCpl = state.us.leads > 0 ? state.us.investment / state.us.leads : 0;
  const usCac = state.us.clients > 0 ? state.us.investment / state.us.clients : 0;

  const leverDescription = useMemo(() => {
    if (meetingGap <= 0) return "Meta de reuniões atingida. Agora o foco é proteger qualidade e transformar conversas em clientes.";
    if (state.br.qualified + state.us.qualified === 0) return "Ainda não há leads qualificados suficientes registrados. O topo do funil precisa gerar volume com qualidade para abrir mais reuniões.";
    if (state.br.scheduled + state.us.scheduled < state.meetingsGoal) return "O gargalo provável está entre lead qualificado e reunião agendada. Priorize follow-up, oferta e velocidade de resposta.";
    return "Há reuniões agendadas, mas ainda faltam realizadas. O foco agora é reduzir ausência e confirmar presença antes do horário.";
  }, [meetingGap, state.br.qualified, state.us.qualified, state.br.scheduled, state.us.scheduled, state.meetingsGoal]);

  if (authLoading) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <span className="brand-dot">Speedy Media OS</span>
          <h1>Carregando dashboard...</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={login}>
          <span className="brand-dot">Speedy Media OS</span>
          <h1>Acessar dashboard</h1>
          <p>Entre com o usuário criado no Supabase para editar e salvar os dados do painel.</p>

          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>

          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>

          <button className="primary-button" type="submit">Entrar</button>
        </form>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <span className="brand-dot">Speedy Media OS</span>
          <h1>Carregando dashboard...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="page-wrap">
        <header className="hero">
          <div>
            <span className="brand-line"><span /> Speedy Media OS</span>
            <h1>Sistema Operacional Speedy</h1>
            <p>Meta macro: <strong>{hidden ? "***" : BRL(state.revenueGoal) + "/mês"}</strong> até dezembro de 2026</p>
          </div>

          <div className="hero-actions">
            <label className="month-select">
              <span>Mês</span>
              <select value={state.selectedMonth} onChange={(event) => set("selectedMonth", event.target.value)}>
                {MONTH_OPTIONS.map((month) => <option key={month} value={month}>{month}</option>)}
              </select>
            </label>

            <button className="ghost-button compact" onClick={() => setShowValues(!showValues)} type="button">
              {showValues ? <EyeOff size={14} /> : <Eye size={14} />} {showValues ? "Ocultar" : "Mostrar"}
            </button>

            <button className="primary-button compact" onClick={() => window.print()} type="button">
              <FileDown size={14} /> PDF
            </button>

            <button className="ghost-button compact" onClick={() => void syncGoogleSheets()} type="button">
              <RefreshCw size={14} className={syncing ? "spin" : ""} /> Atualizar
            </button>

            <button className="ghost-button compact" onClick={() => navigator.clipboard.writeText("Resumo Speedy: " + BRL(state.revenueNow) + " de " + BRL(state.revenueGoal))} type="button">
              <Copy size={14} /> Resumo
            </button>

            <button className="ghost-button compact" onClick={logout} type="button">Sair</button>

            <small className={"sheet-status " + sheetStatus}>{sheetLabel}</small>
          </div>
        </header>

        <section className="revenue-panel">
          <div className="metric-lead">
            <div className="metric-icon"><DollarSign size={18} /></div>
            <div className="metric-copy">
              <span>Faturamento atual</span>
              <strong><MoneyField value={state.revenueNow} onChange={(value) => set("revenueNow", value)} hidden={hidden} /></strong>
            </div>
          </div>

          <div className="metric-right">
            <span>Meta</span>
            <strong><MoneyField value={state.revenueGoal} onChange={(value) => set("revenueGoal", value)} hidden={hidden} /></strong>
          </div>

          <div className="revenue-progress">
            <ProgressBar value={revenuePct} />
            <span>{hidden ? "***" : revenuePct + "% da meta"}</span>
          </div>

          <div className="tiny-stats">
            <StatCard label="Clientes ativos" value={NUM(state.revenueBase.activeClients)} hidden={hidden} />
            <StatCard label="Ticket médio" value={BRL(state.revenueBase.averageTicket)} hidden={hidden} />
            <StatCard label="Recorrente" value={BRL(state.revenueBase.recurringRevenue)} hidden={hidden} />
            <StatCard label="Avulsos/pontuais" value={BRL(state.revenueBase.oneOffRevenue)} hidden={hidden} />
          </div>
        </section>

        <section className="focus-panel">
          <div className="focus-copy">
            <span>Alavanca principal</span>
            <h2>Gerar mais reuniões qualificadas</h2>
            <p>{leverDescription}</p>
          </div>

          <div className="focus-number">
            <span>Faltam reuniões</span>
            <strong>{hidden ? "***" : meetingGap}</strong>
            <small>{hidden ? "***" : meetingsNow + " feitas de " + state.meetingsGoal + " planejadas"}</small>
            <ProgressBar value={pct(meetingsNow, state.meetingsGoal)} />
          </div>
        </section>

        <section className="grid-two">
          <article className="panel">
            <div className="section-title"><Target size={17} /><h2>Decisões da semana</h2></div>
            <TextArea value={state.decisions} onChange={(value) => set("decisions", value)} />

            <div className="task-list">
              {state.tasks.map((task) => (
                <button
                  key={task.id}
                  className={task.done ? "task done" : "task"}
                  type="button"
                  onClick={() => set("tasks", state.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}
                >
                  {task.done ? <CheckCircle2 size={15} /> : <Circle size={15} />} {task.label}
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-title"><Activity size={17} /><h2>Indicadores da Alavanca Principal</h2></div>

            <div className="stats-grid">
              <StatCard label="Meta reuniões" value={NUM(state.meetingsGoal)} />
              <StatCard label="Realizadas" value={NUM(meetingsNow)} hidden={hidden} />
              <StatCard label="Faltam" value={NUM(meetingGap)} hidden={hidden} />
            </div>

            <label className="inline-edit">
              Meta de reuniões
              <NumberField value={state.meetingsGoal} onChange={(value) => set("meetingsGoal", value)} />
            </label>
          </article>
        </section>

        <section className="panel">
          <div className="section-title"><Activity size={17} /><h2>Funil Comercial BR</h2></div>

          <div className="funnel-grid">
            <FunnelCard label="Etapa 1" title="Investimento" value={BRL(state.br.investment)} hidden={hidden} />
            <FunnelCard label="Etapa 2" title="Leads gerados" value={NUM(state.br.leads)} hidden={hidden} />
            <FunnelCard label="Etapa 3" title="Leads qualificados" value={NUM(state.br.qualified)} helper="qualificação: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 4" title="Reuniões agendadas" value={NUM(state.br.scheduled)} helper="lead -> reunião: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 5" title="Reuniões realizadas" value={NUM(state.br.meetings)} helper="show-up: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 6" title="Clientes fechados" value={NUM(state.br.clients)} helper="reunião -> cliente: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 7" title="Ticket" value={BRL(state.br.ticket)} hidden={hidden} />
          </div>
        </section>

        <section className="panel">
          <div className="section-title"><Activity size={17} /><h2>Funil Comercial EUA</h2></div>

          <div className="funnel-grid">
            <FunnelCard label="Etapa 1" title="Investimento" value={BRL(state.us.investment)} hidden={hidden} />
            <FunnelCard label="Etapa 2" title="Leads gerados" value={NUM(state.us.leads)} hidden={hidden} />
            <FunnelCard label="Etapa 3" title="Leads qualificados" value={NUM(state.us.qualified)} helper="qualificação: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 4" title="Reuniões agendadas" value={NUM(state.us.scheduled)} helper="lead -> reunião: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 5" title="Reuniões realizadas" value={NUM(state.us.meetings)} helper="show-up: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 6" title="Clientes fechados" value={NUM(state.us.clients)} helper="reunião -> cliente: Em validação" hidden={hidden} />
            <FunnelCard label="Etapa 7" title="Ticket" value={BRL(state.us.ticket)} hidden={hidden} />
          </div>
        </section>

        <section className="grid-two">
          <article className="panel market-card">
            <div className="market-head"><strong><span>BR</span> Brasil</strong><small>Dados do Funil Comercial BR</small></div>

            <div className="stats-grid">
              <StatCard label="Meta de investimento" value={BRL(state.budgetBR)} />
              <StatCard label="Investimento" value={BRL(state.br.investment)} hidden={hidden} />
              <StatCard label="Leads gerados" value={NUM(state.br.leads)} hidden={hidden} />
              <StatCard label="Leads qualificados" value={NUM(state.br.qualified)} hidden={hidden} />
              <StatCard label="Reuniões realizadas" value={NUM(state.br.meetings)} hidden={hidden} />
              <StatCard label="Clientes fechados" value={NUM(state.br.clients)} hidden={hidden} />
              <StatCard label="CPL" value={BRL(brCpl)} helper="Em validação" hidden={hidden} />
              <StatCard label="CAC" value={BRL(brCac)} helper="Em validação" hidden={hidden} />
            </div>
          </article>

          <article className="panel market-card">
            <div className="market-head"><strong><span>EUA</span> Estados Unidos</strong><small>Dados do Funil Comercial EUA</small></div>

            <div className="stats-grid">
              <StatCard label="Meta de investimento" value={BRL(state.budgetUS)} />
              <StatCard label="Investimento" value={BRL(state.us.investment)} hidden={hidden} />
              <StatCard label="Leads gerados" value={NUM(state.us.leads)} hidden={hidden} />
              <StatCard label="Leads qualificados" value={NUM(state.us.qualified)} hidden={hidden} />
              <StatCard label="Reuniões realizadas" value={NUM(state.us.meetings)} hidden={hidden} />
              <StatCard label="Clientes fechados" value={NUM(state.us.clients)} hidden={hidden} />
              <StatCard label="CPL" value={BRL(usCpl)} helper="Em validação" hidden={hidden} />
              <StatCard label="CAC" value={BRL(usCac)} helper="Em validação" hidden={hidden} />
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="section-title"><BarChart3 size={17} /><h2>Scoreboard mensal 2026</h2></div>

          <div className="scoreboard">
            <div className="score-head">
              <span>Mês</span>
              <span>Receita</span>
              <span>Reuniões</span>
              <span>Clientes</span>
              <span>Perdidos</span>
              <span>Ticket</span>
            </div>

            {state.months.map((row, index) => (
              <div className="score-row" key={row.month}>
                <strong>{row.month}</strong>
                <NumberField value={row.revenue} onChange={(value) => set("months", state.months.map((item, i) => i === index ? { ...item, revenue: value } : item))} prefix="R$" />
                <NumberField value={row.meetings} onChange={(value) => set("months", state.months.map((item, i) => i === index ? { ...item, meetings: value } : item))} />
                <NumberField value={row.clients} onChange={(value) => set("months", state.months.map((item, i) => i === index ? { ...item, clients: value } : item))} />
                <NumberField value={row.lost} onChange={(value) => set("months", state.months.map((item, i) => i === index ? { ...item, lost: value } : item))} />
                <NumberField value={row.ticket} onChange={(value) => set("months", state.months.map((item, i) => i === index ? { ...item, ticket: value } : item))} prefix="R$" />
              </div>
            ))}
          </div>
        </section>

        <footer>Dados da aba {state.selectedMonth}. {saving ? "Salvando..." : ""}</footer>
      </div>
    </main>
  );
}
