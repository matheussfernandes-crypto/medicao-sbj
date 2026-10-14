"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Download,
  Printer,
  History as HistoryIcon,
  Settings,
  LayoutGrid,
  BarChart3,
  CheckSquare,
  X,
  Check,
} from "lucide-react";
import * as actions from "./actions";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  CATEGORIA_LABEL,
  CATEGORIA_ORDER,
  CATEGORIA_COR,
  cellKey,
  type StatusAndamento,
  type CategoriaPavimento,
  type Torre,
  type Pavimento,
  type Unidade,
  type ServicoAndamento,
  type CelulaStatus,
  type HistoricoItem,
  type DadosObra,
  type ObraResumo,
} from "./types";

const STATUS_COR: Record<StatusAndamento, string> = {
  NAO_INICIADO: "#e5e7eb",
  ANDAMENTO: "#2c6975",
  FINALIZADO: "#1f8a4c",
};
const STATUS_TEXTO: Record<StatusAndamento, string> = {
  NAO_INICIADO: "#4b5563",
  ANDAMENTO: "#ffffff",
  FINALIZADO: "#ffffff",
};

type ViewMode = "grid" | "config" | "relatorio" | "historico";

export default function AndamentoObraClient({
  obras,
  dados,
  nomeUsuario,
}: {
  obras: ObraResumo[];
  dados: DadosObra;
  nomeUsuario: string;
}) {
  const router = useRouter();

  const [torres, setTorres] = useState<Torre[]>(dados.torres);
  const [pavimentos, setPavimentos] = useState<Pavimento[]>(dados.pavimentos);
  const [unidades, setUnidades] = useState<Unidade[]>(dados.unidades);
  const [servicos, setServicos] = useState<ServicoAndamento[]>(dados.servicos);
  const [celulas, setCelulas] = useState<Map<string, CelulaStatus>>(
    () => new Map(dados.celulas.map((c) => [cellKey(c.unidade_id, c.servico_id), c]))
  );
  const [historico, setHistorico] = useState<HistoricoItem[]>(dados.historico);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [torreAtivaId, setTorreAtivaId] = useState<string | null>(dados.torres[0]?.id ?? null);
  const [popover, setPopover] = useState<{ unidadeId: string; servicoId: string; x: number; y: number } | null>(null);
  const [obsRascunho, setObsRascunho] = useState("");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<number | null>(null);

  const torreAtiva = torres.find((t) => t.id === torreAtivaId) ?? torres[0] ?? null;
  const pavimentosDaTorre = useMemo(
    () => pavimentos.filter((p) => p.torre_id === torreAtiva?.id).sort((a, b) => a.ordem - b.ordem),
    [pavimentos, torreAtiva]
  );
  const unidadesPorPavimento = useMemo(() => {
    const m = new Map<string, Unidade[]>();
    unidades.forEach((u) => {
      if (!m.has(u.pavimento_id)) m.set(u.pavimento_id, []);
      m.get(u.pavimento_id)!.push(u);
    });
    m.forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));
    return m;
  }, [unidades]);
  const servicosOrdenados = useMemo(() => [...servicos].sort((a, b) => a.ordem - b.ordem), [servicos]);

  const pavById = useMemo(() => new Map(pavimentos.map((p) => [p.id, p])), [pavimentos]);
  const unidadeById = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);
  const servicoById = useMemo(() => new Map(servicos.map((s) => [s.id, s])), [servicos]);

  function todasAsChavesDaObra(): string[] {
    const keys: string[] = [];
    unidades.forEach((u) => servicos.forEach((s) => keys.push(cellKey(u.id, s.id))));
    return keys;
  }
  function contarStatus(keys: string[]) {
    const c = { NAO_INICIADO: 0, ANDAMENTO: 0, FINALIZADO: 0, total: 0 };
    keys.forEach((k) => {
      const cel = celulas.get(k);
      const s = cel?.status ?? "NAO_INICIADO";
      c[s]++;
      c.total++;
    });
    return c;
  }

  function trocarObra(id: string) {
    router.push(`/andamento-obra?obra=${id}`);
  }

  function mudarView(v: ViewMode) {
    setViewMode(v);
    setModoSelecao(false);
    setSelecionadas(new Set());
  }

  // ---------- status / observação ----------

  function abrirPopover(e: React.MouseEvent, unidadeId: string, servicoId: string) {
    const cel = celulas.get(cellKey(unidadeId, servicoId));
    setObsRascunho(cel?.observacao ?? "");
    setPopover({ unidadeId, servicoId, x: e.clientX, y: e.clientY });
  }

  function definirStatusCelula(unidadeId: string, servicoId: string, status: StatusAndamento) {
    const key = cellKey(unidadeId, servicoId);
    const anterior = celulas.get(key);
    setCelulas((prev) => {
      const next = new Map(prev);
      next.set(key, {
        unidade_id: unidadeId,
        servico_id: servicoId,
        status,
        observacao: anterior?.observacao ?? null,
        atualizado_por_nome: nomeUsuario,
        atualizado_em: new Date().toISOString(),
      });
      return next;
    });
    if ((anterior?.status ?? "NAO_INICIADO") !== status) {
      setHistorico((prev) => [
        {
          id: "temp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          unidade_id: unidadeId,
          servico_id: servicoId,
          tipo: "STATUS",
          de: anterior?.status ?? "NAO_INICIADO",
          para: status,
          observacao: null,
          autor_nome: nomeUsuario,
          criado_em: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    actions.definirStatus(unidadeId, servicoId, status).catch((e) => setErro(e.message));
  }

  function aplicarStatus(status: StatusAndamento) {
    if (!popover) return;
    definirStatusCelula(popover.unidadeId, popover.servicoId, status);
  }

  // ---------- seleção múltipla ----------

  function alternarModoSelecao() {
    setModoSelecao((prev) => !prev);
    setSelecionadas(new Set());
    setPopover(null);
  }

  function alternarSelecaoCelula(key: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function aoClicarCelula(e: React.MouseEvent, unidadeId: string, servicoId: string) {
    if (modoSelecao) {
      alternarSelecaoCelula(cellKey(unidadeId, servicoId));
    } else {
      abrirPopover(e, unidadeId, servicoId);
    }
  }

  function aplicarStatusEmMassa(status: StatusAndamento) {
    selecionadas.forEach((key) => {
      const [unidadeId, servicoId] = key.split("__");
      definirStatusCelula(unidadeId, servicoId, status);
    });
    setSelecionadas(new Set());
  }

  function salvarObs() {
    if (!popover) return;
    const { unidadeId, servicoId } = popover;
    const key = cellKey(unidadeId, servicoId);
    const anterior = celulas.get(key);
    setCelulas((prev) => {
      const next = new Map(prev);
      next.set(key, {
        unidade_id: unidadeId,
        servico_id: servicoId,
        status: anterior?.status ?? "NAO_INICIADO",
        observacao: obsRascunho,
        atualizado_por_nome: nomeUsuario,
        atualizado_em: new Date().toISOString(),
      });
      return next;
    });
    if ((anterior?.observacao ?? "") !== obsRascunho && obsRascunho) {
      setHistorico((prev) => [
        {
          id: "temp_" + Date.now(),
          unidade_id: unidadeId,
          servico_id: servicoId,
          tipo: "OBSERVACAO",
          de: null,
          para: null,
          observacao: obsRascunho,
          autor_nome: nomeUsuario,
          criado_em: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    actions.salvarObservacao(unidadeId, servicoId, obsRascunho).catch((e) => setErro(e.message));
    setPopover(null);
  }

  // ---------- config: torres/pavimentos/unidades/serviços ----------

  async function addTorre() {
    setSalvando(true);
    try {
      const nova = await actions.salvarTorre({ obraId: dados.obraId, nome: "Nova torre", ordem: torres.length });
      setTorres((prev) => [...prev, nova as Torre]);
      setTorreAtivaId(nova.id);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function renomearTorre(id: string, nome: string) {
    const t = torres.find((x) => x.id === id);
    if (!t) return;
    setTorres((prev) => prev.map((x) => (x.id === id ? { ...x, nome } : x)));
    await actions.salvarTorre({ id, obraId: dados.obraId, nome, ordem: t.ordem }).catch((e) => setErro(e.message));
  }

  function pedirExclusaoTorre(t: Torre) {
    setConfirmacao({
      label: `Excluir a torre "${t.nome}"? Isso apaga todos os pavimentos, unidades e o andamento registrado nela.`,
      onConfirm: async () => {
        await actions.excluirTorre(t.id).catch((e) => setErro(e.message));
        setTorres((prev) => prev.filter((x) => x.id !== t.id));
        const pavsDaTorre = pavimentos.filter((p) => p.torre_id === t.id).map((p) => p.id);
        setPavimentos((prev) => prev.filter((p) => p.torre_id !== t.id));
        setUnidades((prev) => prev.filter((u) => !pavsDaTorre.includes(u.pavimento_id)));
        setConfirmacao(null);
      },
    });
  }

  async function addPavimento() {
    if (!torreAtiva) return;
    setSalvando(true);
    try {
      const novo = await actions.salvarPavimento({
        torreId: torreAtiva.id,
        nome: "Novo pavimento",
        ordem: pavimentosDaTorre.length,
        categoria: "RESIDENCIAL",
      });
      setPavimentos((prev) => [...prev, novo as Pavimento]);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarPavimento(p: Pavimento, patch: Partial<Pick<Pavimento, "nome" | "categoria">>) {
    const atualizado = { ...p, ...patch };
    setPavimentos((prev) => prev.map((x) => (x.id === p.id ? atualizado : x)));
    await actions
      .salvarPavimento({ id: p.id, torreId: p.torre_id, nome: atualizado.nome, ordem: p.ordem, categoria: atualizado.categoria })
      .catch((e) => setErro(e.message));
  }

  function pedirExclusaoPavimento(p: Pavimento) {
    setConfirmacao({
      label: `Excluir o pavimento "${p.nome}"? Isso apaga as unidades e o andamento registrado nele.`,
      onConfirm: async () => {
        await actions.excluirPavimento(p.id).catch((e) => setErro(e.message));
        setPavimentos((prev) => prev.filter((x) => x.id !== p.id));
        setUnidades((prev) => prev.filter((u) => u.pavimento_id !== p.id));
        setConfirmacao(null);
      },
    });
  }

  async function addUnidade(pavimentoId: string) {
    const existentes = unidadesPorPavimento.get(pavimentoId) ?? [];
    setSalvando(true);
    try {
      const nova = await actions.salvarUnidade({
        pavimentoId,
        nome: "Apto " + (existentes.length + 1),
        ordem: existentes.length,
      });
      setUnidades((prev) => [...prev, nova as Unidade]);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function renomearUnidade(u: Unidade, nome: string) {
    setUnidades((prev) => prev.map((x) => (x.id === u.id ? { ...x, nome } : x)));
    await actions.salvarUnidade({ id: u.id, pavimentoId: u.pavimento_id, nome, ordem: u.ordem }).catch((e) => setErro(e.message));
  }

  function pedirExclusaoUnidade(u: Unidade) {
    setConfirmacao({
      label: `Excluir "${u.nome}"? Isso apaga o andamento registrado nessa unidade.`,
      onConfirm: async () => {
        await actions.excluirUnidade(u.id).catch((e) => setErro(e.message));
        setUnidades((prev) => prev.filter((x) => x.id !== u.id));
        setConfirmacao(null);
      },
    });
  }

  async function addServico() {
    setSalvando(true);
    try {
      const novo = await actions.salvarServico({ obraId: dados.obraId, nome: "Novo serviço", ordem: servicos.length });
      setServicos((prev) => [...prev, novo as ServicoAndamento]);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function renomearServico(s: ServicoAndamento, nome: string) {
    setServicos((prev) => prev.map((x) => (x.id === s.id ? { ...x, nome } : x)));
    await actions.salvarServico({ id: s.id, obraId: s.obra_id, nome, ordem: s.ordem }).catch((e) => setErro(e.message));
  }

  function pedirExclusaoServico(s: ServicoAndamento) {
    setConfirmacao({
      label: `Excluir o serviço "${s.nome}"? Isso apaga o andamento já registrado dele em todas as unidades.`,
      onConfirm: async () => {
        await actions.excluirServico(s.id).catch((e) => setErro(e.message));
        setServicos((prev) => prev.filter((x) => x.id !== s.id));
        setConfirmacao(null);
      },
    });
  }

  async function mover<T extends { id: string; ordem: number }>(
    lista: T[],
    setLista: (fn: (prev: T[]) => T[]) => void,
    id: string,
    dir: -1 | 1,
    salvar: (item: T) => Promise<any>
  ) {
    const ordenada = [...lista].sort((a, b) => a.ordem - b.ordem);
    const idx = ordenada.findIndex((x) => x.id === id);
    const novoIdx = idx + dir;
    if (idx < 0 || novoIdx < 0 || novoIdx >= ordenada.length) return;
    const a = ordenada[idx];
    const b = ordenada[novoIdx];
    const ordemA = a.ordem;
    const ordemB = b.ordem;
    setLista((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, ordem: ordemB } : x.id === b.id ? { ...x, ordem: ordemA } : x))
    );
    await Promise.all([salvar({ ...a, ordem: ordemB }), salvar({ ...b, ordem: ordemA })]).catch((e) => setErro(e.message));
  }

  function confirmarConfiguracao() {
    setSalvoEm(Date.now());
    router.refresh();
  }

  // ---------- export ----------

  function baixarCSV(linhas: string[][], nomeArquivo: string) {
    const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportarCSVAndamento() {
    const linhas = [["Torre", "Pavimento", "Unidade", "Serviço", "Status", "Observação", "Atualizado por", "Atualizado em"]];
    unidades.forEach((u) => {
      const pav = pavById.get(u.pavimento_id);
      const torre = pav ? torres.find((t) => t.id === pav.torre_id) : null;
      servicos.forEach((s) => {
        const cel = celulas.get(cellKey(u.id, s.id));
        linhas.push([
          torre?.nome ?? "",
          pav?.nome ?? "",
          u.nome,
          s.nome,
          STATUS_LABEL[cel?.status ?? "NAO_INICIADO"],
          cel?.observacao ?? "",
          cel?.atualizado_por_nome ?? "",
          cel?.atualizado_em ? new Date(cel.atualizado_em).toLocaleString("pt-BR") : "",
        ]);
      });
    });
    const obraNome = obras.find((o) => o.id === dados.obraId)?.nome ?? "obra";
    baixarCSV(linhas, `andamento-${obraNome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`);
  }

  function exportarHistoricoCSV() {
    const linhas = [["Data/hora", "Autor", "Torre", "Pavimento", "Unidade", "Serviço", "Tipo", "De", "Para", "Observação"]];
    historico.forEach((h) => {
      const u = unidadeById.get(h.unidade_id);
      const pav = u ? pavById.get(u.pavimento_id) : null;
      const torre = pav ? torres.find((t) => t.id === pav.torre_id) : null;
      const serv = servicoById.get(h.servico_id);
      linhas.push([
        new Date(h.criado_em).toLocaleString("pt-BR"),
        h.autor_nome ?? "",
        torre?.nome ?? "",
        pav?.nome ?? "",
        u?.nome ?? "",
        serv?.nome ?? "",
        h.tipo === "STATUS" ? "Status" : "Observação",
        h.de ? STATUS_LABEL[h.de as StatusAndamento] ?? h.de : "",
        h.para ? STATUS_LABEL[h.para as StatusAndamento] ?? h.para : "",
        h.observacao ?? "",
      ]);
    });
    const obraNome = obras.find((o) => o.id === dados.obraId)?.nome ?? "obra";
    baixarCSV(linhas, `historico-${obraNome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`);
  }

  // ---------- render ----------

  const keysGeral = todasAsChavesDaObra();
  const cGeral = contarStatus(keysGeral);
  const pctGeral = cGeral.total ? Math.round((cGeral.FINALIZADO / cGeral.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {erro && (
        <div className="card bg-red-50 border-red-200 text-danger text-sm flex items-center justify-between">
          <span>{erro}</span>
          <button className="text-xs underline" onClick={() => setErro(null)}>
            fechar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs text-ink-500 mb-1">Obra</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm min-w-[220px]"
            value={dados.obraId}
            onChange={(e) => trocarObra(e.target.value)}
          >
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <TabButton active={viewMode === "grid"} onClick={() => mudarView("grid")} icon={<LayoutGrid className="w-4 h-4" />}>
            Andamento
          </TabButton>
          <TabButton active={viewMode === "config"} onClick={() => mudarView("config")} icon={<Settings className="w-4 h-4" />}>
            Pavimentos e serviços
          </TabButton>
          <TabButton active={viewMode === "relatorio"} onClick={() => mudarView("relatorio")} icon={<BarChart3 className="w-4 h-4" />}>
            Relatório
          </TabButton>
          <TabButton active={viewMode === "historico"} onClick={() => mudarView("historico")} icon={<HistoryIcon className="w-4 h-4" />}>
            Histórico
          </TabButton>
        </div>
      </div>

      {(viewMode === "grid" || viewMode === "config") && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Índice geral de andamento" value={`${pctGeral}%`} corBarra="#1f8a4c" pct={pctGeral} />
          <StatTile
            label="Em andamento"
            value={String(cGeral.ANDAMENTO)}
            corBarra="#2c6975"
            pct={cGeral.total ? Math.round((cGeral.ANDAMENTO / cGeral.total) * 100) : 0}
          />
          <StatTile
            label="Não iniciados"
            value={String(cGeral.NAO_INICIADO)}
            corBarra="#d1d5db"
            pct={cGeral.total ? Math.round((cGeral.NAO_INICIADO / cGeral.total) * 100) : 0}
          />
        </div>
      )}

      {viewMode === "grid" && (
        <>
          {torres.length === 0 ? (
            <div className="card text-center text-sm text-ink-500 py-10">
              Nenhuma torre cadastrada ainda para esta obra. Vá em <b>Pavimentos e serviços</b> pra começar.
            </div>
          ) : servicosOrdenados.length === 0 ? (
            <div className="card text-center text-sm text-ink-500 py-10">
              Nenhum serviço cadastrado ainda. Vá em <b>Pavimentos e serviços</b> pra adicionar as fases do fluxograma (Estrutura,
              Alvenaria, Reboco...).
            </div>
          ) : (
            <>
              {torres.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {torres
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTorreAtivaId(t.id);
                          setSelecionadas(new Set());
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                          t.id === torreAtiva?.id ? "bg-primary text-white border-primary" : "bg-white border-border text-ink-700"
                        }`}
                      >
                        {t.nome}
                      </button>
                    ))}
                </div>
              )}

              {pavimentosDaTorre.length === 0 ? (
                <div className="card text-center text-sm text-ink-500 py-10">
                  {torreAtiva?.nome} ainda não tem pavimentos cadastrados. Vá em <b>Pavimentos e serviços</b> pra adicionar.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-xs text-ink-500 flex-wrap">
                    {STATUS_ORDER.map((s) => (
                      <span key={s} className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded" style={{ background: STATUS_COR[s] }} />
                        {STATUS_LABEL[s]}
                      </span>
                    ))}
                    <span className="ml-auto">
                      {modoSelecao
                        ? "Clique nas células pra marcar — depois escolha o status lá embaixo pra aplicar em todas de uma vez"
                        : "Clique numa célula pra apontar o status do serviço naquela unidade"}
                    </span>
                    <button
                      onClick={alternarModoSelecao}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                        modoSelecao ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border text-ink-700"
                      }`}
                    >
                      {modoSelecao ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                      {modoSelecao ? "Sair da seleção" : "Selecionar várias"}
                    </button>
                  </div>

                  <div className="card-table overflow-auto" style={{ maxHeight: "66vh" }}>
                <table className="border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-surface-subtle px-3 py-2 text-left min-w-[130px] border-b border-r border-border">
                        Pavimento
                      </th>
                      <th className="sticky top-0 left-[130px] z-30 bg-surface-subtle px-2 py-2 text-left min-w-[70px] border-b border-r border-border">
                        Unidade
                      </th>
                      {servicosOrdenados.map((s) => (
                        <th
                          key={s.id}
                          className="sticky top-0 z-20 bg-surface-subtle px-1 py-2 border-b border-r border-border font-semibold text-primaryDark"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 130 }}
                          title={s.nome}
                        >
                          {s.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pavimentosDaTorre.map((pav) => {
                      const unidadesDoPav = unidadesPorPavimento.get(pav.id) ?? [];
                      return unidadesDoPav.map((u, idx) => (
                        <tr key={u.id} className={idx % 2 === 1 ? "bg-surface-subtle/50" : ""}>
                          {idx === 0 && (
                            <td
                              className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-r border-border font-semibold whitespace-nowrap align-top"
                              rowSpan={unidadesDoPav.length}
                            >
                              {pav.nome}
                              {pav.categoria !== "RESIDENCIAL" && (
                                <span
                                  className="ml-1.5 inline-block text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full align-middle"
                                  style={{ background: CATEGORIA_COR[pav.categoria] }}
                                >
                                  {CATEGORIA_LABEL[pav.categoria]}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="sticky left-[130px] z-10 bg-white px-2 py-1.5 border-b border-r border-border text-ink-500 whitespace-nowrap">
                            {u.nome}
                          </td>
                          {servicosOrdenados.map((s) => {
                            const key = cellKey(u.id, s.id);
                            const cel = celulas.get(key);
                            const status = cel?.status ?? "NAO_INICIADO";
                            const selecionada = selecionadas.has(key);
                            return (
                              <td
                                key={s.id}
                                onClick={(e) => aoClicarCelula(e, u.id, s.id)}
                                title={`${pav.nome} · ${u.nome} · ${s.nome}: ${STATUS_LABEL[status]}`}
                                className="border-b border-r border-border cursor-pointer relative hover:brightness-95"
                                style={{
                                  background: STATUS_COR[status],
                                  width: 26,
                                  height: 26,
                                  minWidth: 26,
                                  boxShadow: selecionada ? "inset 0 0 0 2px #f4dd3d" : undefined,
                                }}
                              >
                                {selecionada && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                    <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                                  </span>
                                )}
                                {!selecionada && cel?.observacao && (
                                  <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-primaryDark" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {viewMode === "config" && (
        <ConfigPanel
          torres={torres}
          pavimentosDaTorre={pavimentosDaTorre}
          torreAtiva={torreAtiva}
          setTorreAtivaId={setTorreAtivaId}
          unidadesPorPavimento={unidadesPorPavimento}
          servicos={servicosOrdenados}
          confirmacao={confirmacao}
          setConfirmacao={setConfirmacao}
          salvando={salvando}
          salvoEm={salvoEm}
          onAddTorre={addTorre}
          onRenomearTorre={renomearTorre}
          onExcluirTorre={pedirExclusaoTorre}
          onMoverTorre={(id, dir) => mover(torres, setTorres, id, dir, (t) => actions.salvarTorre({ id: t.id, obraId: dados.obraId, nome: t.nome, ordem: t.ordem }))}
          onAddPavimento={addPavimento}
          onAtualizarPavimento={atualizarPavimento}
          onExcluirPavimento={pedirExclusaoPavimento}
          onMoverPavimento={(id, dir) =>
            mover(pavimentosDaTorre, setPavimentos, id, dir, (p) =>
              actions.salvarPavimento({ id: p.id, torreId: p.torre_id, nome: p.nome, ordem: p.ordem, categoria: p.categoria })
            )
          }
          onAddUnidade={addUnidade}
          onRenomearUnidade={renomearUnidade}
          onExcluirUnidade={pedirExclusaoUnidade}
          onMoverUnidade={(lista, id, dir) =>
            mover(lista, setUnidades, id, dir, (u) => actions.salvarUnidade({ id: u.id, pavimentoId: u.pavimento_id, nome: u.nome, ordem: u.ordem }))
          }
          onAddServico={addServico}
          onRenomearServico={renomearServico}
          onExcluirServico={pedirExclusaoServico}
          onMoverServico={(id, dir) =>
            mover(servicosOrdenados, setServicos, id, dir, (s) => actions.salvarServico({ id: s.id, obraId: s.obra_id, nome: s.nome, ordem: s.ordem }))
          }
          onConfirmar={confirmarConfiguracao}
        />
      )}

      {viewMode === "relatorio" && (
        <RelatorioPanel
          obraNome={obras.find((o) => o.id === dados.obraId)?.nome ?? ""}
          nomeUsuario={nomeUsuario}
          torres={torres}
          pavimentos={pavimentos}
          unidades={unidades}
          servicos={servicosOrdenados}
          celulas={celulas}
          onExportarCSV={exportarCSVAndamento}
        />
      )}

      {viewMode === "historico" && (
        <HistoricoPanel
          historico={historico}
          unidadeById={unidadeById}
          pavById={pavById}
          torres={torres}
          servicoById={servicoById}
          onExportarCSV={exportarHistoricoCSV}
        />
      )}

      {modoSelecao && selecionadas.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primaryDark text-white rounded-xl shadow-panel px-4 py-3 flex items-center gap-3 flex-wrap justify-center">
          <span className="text-sm font-medium">
            {selecionadas.size} célula{selecionadas.size > 1 ? "s" : ""} selecionada{selecionadas.size > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-white/60">Aplicar:</span>
          <div className="flex gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => aplicarStatusEmMassa(s)}
                className="rounded-md py-1.5 px-3 text-xs font-semibold"
                style={{ background: STATUS_COR[s], color: STATUS_TEXTO[s] }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelecionadas(new Set())}
            className="text-xs text-white/70 hover:text-white underline ml-1"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {popover && (
        <Popover
          popover={popover}
          celula={celulas.get(cellKey(popover.unidadeId, popover.servicoId))}
          pavimento={(() => {
            const u = unidadeById.get(popover.unidadeId);
            return u ? pavById.get(u.pavimento_id) : undefined;
          })()}
          unidade={unidadeById.get(popover.unidadeId)}
          servico={servicoById.get(popover.servicoId)}
          obsRascunho={obsRascunho}
          setObsRascunho={setObsRascunho}
          onStatus={aplicarStatus}
          onSalvarObs={salvarObs}
          onFechar={() => setPopover(null)}
        />
      )}
    </div>
  );
}

// ============================================================================

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
        active ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border text-ink-700 hover:bg-surface-subtle"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatTile({ label, value, corBarra, pct }: { label: string; value: string; corBarra: string; pct: number }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="h-1.5 rounded bg-gray-200 overflow-hidden mt-1">
        <div className="h-full" style={{ width: `${pct}%`, background: corBarra }} />
      </div>
    </div>
  );
}

function Popover({
  popover,
  celula,
  pavimento,
  unidade,
  servico,
  obsRascunho,
  setObsRascunho,
  onStatus,
  onSalvarObs,
  onFechar,
}: {
  popover: { x: number; y: number };
  celula?: CelulaStatus;
  pavimento?: Pavimento;
  unidade?: Unidade;
  servico?: ServicoAndamento;
  obsRascunho: string;
  setObsRascunho: (v: string) => void;
  onStatus: (s: StatusAndamento) => void;
  onSalvarObs: () => void;
  onFechar: () => void;
}) {
  if (typeof window === "undefined") return null;
  const left = Math.min(popover.x + 10, window.innerWidth - 270);
  const top = Math.min(popover.y + 10, window.innerHeight - 260);
  const status = celula?.status ?? "NAO_INICIADO";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onFechar} />
      <div
        className="fixed z-50 bg-white border border-border rounded-xl shadow-panel p-3 w-[250px]"
        style={{ left: Math.max(left, 10), top: Math.max(top, 10) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-ink-500 mb-2 leading-snug">
          <b className="text-ink-900">{pavimento?.nome}</b> · {unidade?.nome}
          <br />
          <b className="text-ink-900">{servico?.nome}</b>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={`rounded-md py-1.5 px-1 text-[11px] font-semibold text-center ${status === s ? "ring-2 ring-primaryDark" : ""}`}
              style={{ background: STATUS_COR[s], color: STATUS_TEXTO[s] }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <textarea
          value={obsRascunho}
          onChange={(e) => setObsRascunho(e.target.value)}
          placeholder="Observação (opcional)..."
          className="w-full text-xs border border-border rounded-md p-1.5 min-h-[50px]"
        />
        {celula?.atualizado_em && (
          <div className="text-[10px] text-ink-400 mt-1.5">
            Última atualização: {celula.atualizado_por_nome} em {new Date(celula.atualizado_em).toLocaleString("pt-BR")}
          </div>
        )}
        <div className="flex justify-between items-center mt-2">
          <button className="text-xs px-2 py-1 border border-border rounded-md" onClick={onFechar}>
            Fechar
          </button>
          <button className="text-xs px-2 py-1 bg-primary text-white rounded-md" onClick={onSalvarObs}>
            Salvar observação
          </button>
        </div>
      </div>
    </>
  );
}

function ConfigPanel(props: {
  torres: Torre[];
  pavimentosDaTorre: Pavimento[];
  torreAtiva: Torre | null;
  setTorreAtivaId: (id: string) => void;
  unidadesPorPavimento: Map<string, Unidade[]>;
  servicos: ServicoAndamento[];
  confirmacao: { label: string; onConfirm: () => void } | null;
  setConfirmacao: (v: { label: string; onConfirm: () => void } | null) => void;
  salvando: boolean;
  salvoEm: number | null;
  onAddTorre: () => void;
  onRenomearTorre: (id: string, nome: string) => void;
  onExcluirTorre: (t: Torre) => void;
  onMoverTorre: (id: string, dir: -1 | 1) => void;
  onAddPavimento: () => void;
  onAtualizarPavimento: (p: Pavimento, patch: Partial<Pick<Pavimento, "nome" | "categoria">>) => void;
  onExcluirPavimento: (p: Pavimento) => void;
  onMoverPavimento: (id: string, dir: -1 | 1) => void;
  onAddUnidade: (pavimentoId: string) => void;
  onRenomearUnidade: (u: Unidade, nome: string) => void;
  onExcluirUnidade: (u: Unidade) => void;
  onMoverUnidade: (lista: Unidade[], id: string, dir: -1 | 1) => void;
  onAddServico: () => void;
  onRenomearServico: (s: ServicoAndamento, nome: string) => void;
  onExcluirServico: (s: ServicoAndamento) => void;
  onMoverServico: (id: string, dir: -1 | 1) => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="space-y-4">
      {props.confirmacao && (
        <div className="card bg-red-50 border-red-200 flex items-center justify-between gap-3 text-sm">
          <span className="text-danger">{props.confirmacao.label}</span>
          <div className="flex gap-2 shrink-0">
            <button className="px-3 py-1.5 bg-danger text-white rounded-md text-xs font-semibold" onClick={props.confirmacao.onConfirm}>
              Sim, excluir
            </button>
            <button className="px-3 py-1.5 border border-border rounded-md text-xs" onClick={() => props.setConfirmacao(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primaryDark">Torres</h2>
          <button
            onClick={props.onAddTorre}
            disabled={props.salvando}
            className="flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-md disabled:opacity-50 disabled:cursor-wait"
          >
            <Plus className="w-3.5 h-3.5" /> Nova torre
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.torres
            .sort((a, b) => a.ordem - b.ordem)
            .map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${t.id === props.torreAtiva?.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <input
                  value={t.nome}
                  onChange={(e) => props.onRenomearTorre(t.id, e.target.value)}
                  onFocus={() => props.setTorreAtivaId(t.id)}
                  className="text-sm bg-transparent outline-none w-28"
                />
                <button onClick={() => props.onMoverTorre(t.id, -1)}>
                  <ChevronUp className="w-3.5 h-3.5 text-ink-400" />
                </button>
                <button onClick={() => props.onMoverTorre(t.id, 1)}>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-400" />
                </button>
                <button onClick={() => props.onExcluirTorre(t)}>
                  <Trash2 className="w-3.5 h-3.5 text-danger" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {props.torreAtiva && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-primaryDark">Pavimentos — {props.torreAtiva.nome}</h2>
          </div>
          <p className="text-xs text-ink-500 mb-3">
            De baixo pra cima, com a área de cada pavimento e as unidades dele. Isso serve de base pra montar obras futuras também.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-ink-400">
                <th className="pb-1">Pavimento</th>
                <th className="pb-1">Área</th>
                <th className="pb-1">Unidades</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {props.pavimentosDaTorre.map((p, idx) => {
                const unidadesDoPav = props.unidadesPorPavimento.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="py-2 pr-2">
                      <input
                        value={p.nome}
                        onChange={(e) => props.onAtualizarPavimento(p, { nome: e.target.value })}
                        className="text-sm border-b border-transparent hover:border-border focus:border-border outline-none bg-transparent w-32"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={p.categoria}
                        onChange={(e) => props.onAtualizarPavimento(p, { categoria: e.target.value as CategoriaPavimento })}
                        className="text-xs border border-border rounded-md px-1.5 py-1"
                      >
                        {CATEGORIA_ORDER.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORIA_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {unidadesDoPav.map((u) => (
                          <div key={u.id} className="flex items-center gap-0.5 border border-border rounded px-1">
                            <input
                              value={u.nome}
                              onChange={(e) => props.onRenomearUnidade(u, e.target.value)}
                              className="text-xs bg-transparent outline-none w-14"
                            />
                            <button onClick={() => props.onExcluirUnidade(u)}>
                              <Trash2 className="w-3 h-3 text-danger" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => props.onAddUnidade(p.id)}
                          disabled={props.salvando}
                          className="text-xs px-1.5 border border-dashed border-border rounded text-ink-500 disabled:opacity-50 disabled:cursor-wait"
                        >
                          + unidade
                        </button>
                      </div>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <button onClick={() => props.onMoverPavimento(p.id, -1)} disabled={idx === 0}>
                        <ChevronUp className="w-4 h-4 text-ink-400" />
                      </button>
                      <button onClick={() => props.onMoverPavimento(p.id, 1)} disabled={idx === props.pavimentosDaTorre.length - 1}>
                        <ChevronDown className="w-4 h-4 text-ink-400" />
                      </button>
                      <button onClick={() => props.onExcluirPavimento(p)}>
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            onClick={props.onAddPavimento}
            disabled={props.salvando}
            className="mt-3 flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-md disabled:opacity-50 disabled:cursor-wait"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar pavimento
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-primaryDark mb-3">Serviços (ordem de execução)</h2>
        <table className="w-full text-sm max-w-lg">
          <tbody>
            {props.servicos.map((s, idx) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-1.5 pr-2 w-full">
                  <input
                    value={s.nome}
                    onChange={(e) => props.onRenomearServico(s, e.target.value)}
                    className="text-sm w-full bg-transparent outline-none border-b border-transparent hover:border-border focus:border-border"
                  />
                </td>
                <td className="py-1.5 whitespace-nowrap">
                  <button onClick={() => props.onMoverServico(s.id, -1)} disabled={idx === 0}>
                    <ChevronUp className="w-4 h-4 text-ink-400" />
                  </button>
                  <button onClick={() => props.onMoverServico(s.id, 1)} disabled={idx === props.servicos.length - 1}>
                    <ChevronDown className="w-4 h-4 text-ink-400" />
                  </button>
                  <button onClick={() => props.onExcluirServico(s)}>
                    <Trash2 className="w-4 h-4 text-danger" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={props.onAddServico}
          disabled={props.salvando}
          className="mt-3 flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-md disabled:opacity-50 disabled:cursor-wait"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar serviço
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={props.onConfirmar} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          💾 Salvar alterações
        </button>
        {props.salvoEm && <span className="text-xs text-success">Salvo às {new Date(props.salvoEm).toLocaleTimeString("pt-BR")}</span>}
      </div>
    </div>
  );
}

function donutPath(cGeral: { NAO_INICIADO: number; ANDAMENTO: number; FINALIZADO: number; total: number }) {
  const total = cGeral.total || 1;
  const order: (keyof typeof cGeral)[] = ["FINALIZADO", "ANDAMENTO", "NAO_INICIADO"];
  const cores: Record<string, string> = { FINALIZADO: "#1f8a4c", ANDAMENTO: "#2c6975", NAO_INICIADO: "#e5e7eb" };
  const r = 52,
    cx = 70,
    cy = 70,
    circ = 2 * Math.PI * r;
  let acc = 0;
  const segs = order.map((k) => {
    const frac = (cGeral[k] as number) / total;
    const dash = frac * circ;
    const el =
      frac > 0 ? (
        <circle
          key={k}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={cores[k as string]}
          strokeWidth={20}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={-acc * circ}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ) : null;
    acc += frac;
    return el;
  });
  const pct = Math.round((cGeral.FINALIZADO / total) * 100);
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f1" strokeWidth={20} />
      {segs}
      <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight={800} fill="#1c474f">
        {pct}%
      </text>
      <text x={70} y={84} textAnchor="middle" fontSize={10.5} fill="#65707d">
        finalizado
      </text>
    </svg>
  );
}

function RelatorioPanel({
  obraNome,
  nomeUsuario,
  torres,
  pavimentos,
  unidades,
  servicos,
  celulas,
  onExportarCSV,
}: {
  obraNome: string;
  nomeUsuario: string;
  torres: Torre[];
  pavimentos: Pavimento[];
  unidades: Unidade[];
  servicos: ServicoAndamento[];
  celulas: Map<string, CelulaStatus>;
  onExportarCSV: () => void;
}) {
  function contar(keys: string[]) {
    const c = { NAO_INICIADO: 0, ANDAMENTO: 0, FINALIZADO: 0, total: 0 };
    keys.forEach((k) => {
      const s = celulas.get(k)?.status ?? "NAO_INICIADO";
      c[s]++;
      c.total++;
    });
    return c;
  }
  const unidadesPorPav = new Map<string, Unidade[]>();
  unidades.forEach((u) => {
    if (!unidadesPorPav.has(u.pavimento_id)) unidadesPorPav.set(u.pavimento_id, []);
    unidadesPorPav.get(u.pavimento_id)!.push(u);
  });

  const keysGeral: string[] = [];
  unidades.forEach((u) => servicos.forEach((s) => keysGeral.push(cellKey(u.id, s.id))));
  const cGeral = contar(keysGeral);
  const pctGeral = cGeral.total ? Math.round((cGeral.FINALIZADO / cGeral.total) * 100) : 0;

  const porPavimento = pavimentos.map((p) => {
    const us = unidadesPorPav.get(p.id) ?? [];
    const keys: string[] = [];
    us.forEach((u) => servicos.forEach((s) => keys.push(cellKey(u.id, s.id))));
    const c = contar(keys);
    return { pav: p, c, pct: c.total ? Math.round((c.FINALIZADO / c.total) * 100) : 0 };
  });

  const porServico = servicos.map((s) => {
    const keys = unidades.map((u) => cellKey(u.id, s.id));
    const c = contar(keys);
    return { serv: s, c, pct: c.total ? Math.round((c.FINALIZADO / c.total) * 100) : 0 };
  });

  const porCategoria = CATEGORIA_ORDER.map((cat) => {
    const pavsCat = pavimentos.filter((p) => p.categoria === cat);
    if (!pavsCat.length) return null;
    const keys: string[] = [];
    pavsCat.forEach((p) => (unidadesPorPav.get(p.id) ?? []).forEach((u) => servicos.forEach((s) => keys.push(cellKey(u.id, s.id)))));
    const c = contar(keys);
    return { cat, qtd: pavsCat.length, pct: c.total ? Math.round((c.FINALIZADO / c.total) * 100) : 0 };
  }).filter(Boolean) as { cat: CategoriaPavimento; qtd: number; pct: number }[];

  const geradoEm = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 print:hidden">
        <button onClick={onExportarCSV} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm">
          <Printer className="w-4 h-4" /> Imprimir / salvar PDF
        </button>
      </div>

      <div
        className="rounded-xl text-white p-5 flex justify-between items-center flex-wrap gap-4"
        style={{ background: "linear-gradient(135deg,#1c474f,#2c6975)" }}
      >
        <div className="flex items-center gap-4">
          <img src="/logo-topbar.png" alt="SBJ" className="h-10 w-auto" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[#cfe3e5]">Engenharia SBJ · Relatório de andamento de obra</div>
            <h1 className="text-xl font-semibold">{obraNome}</h1>
            <div className="text-xs text-[#d7e7e8] mt-0.5">
              Gerado em {geradoEm} · por {nomeUsuario}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-extrabold leading-none">{pctGeral}%</div>
          <div className="text-[10px] uppercase text-[#d7e7e8]">concluído no geral</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Visão geral</h2>
          <div className="flex items-center gap-4">
            {donutPath(cGeral)}
            <div className="text-xs space-y-1 flex-1">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: STATUS_COR[s] }} />
                    {STATUS_LABEL[s]}
                  </span>
                  <b>
                    {cGeral[s]} ({cGeral.total ? Math.round((cGeral[s] / cGeral.total) * 100) : 0}%)
                  </b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Andamento por área</h2>
          <div className="space-y-2">
            {porCategoria.map(({ cat, qtd, pct }) => (
              <div key={cat} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "150px 1fr 34px" }}>
                <span className="flex items-center gap-1.5 truncate">
                  <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: CATEGORIA_COR[cat] }} />
                  {CATEGORIA_LABEL[cat]} <span className="text-ink-400">({qtd})</span>
                </span>
                <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: CATEGORIA_COR[cat] }} />
                </div>
                <span className="text-right font-semibold">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Andamento por pavimento</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-400">
                <th className="pb-1">Pavimento</th>
                <th className="pb-1">%</th>
                <th className="pb-1 text-right">Final.</th>
                <th className="pb-1 text-right">Andam.</th>
                <th className="pb-1 text-right">Não in.</th>
              </tr>
            </thead>
            <tbody>
              {porPavimento.map(({ pav, c, pct }) => (
                <tr key={pav.id} className="border-t border-border">
                  <td className="py-1">{pav.nome}</td>
                  <td className="py-1">{pct}%</td>
                  <td className="py-1 text-right">{c.FINALIZADO}</td>
                  <td className="py-1 text-right">{c.ANDAMENTO}</td>
                  <td className="py-1 text-right">{c.NAO_INICIADO}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Andamento por serviço</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-400">
                <th className="pb-1">Serviço</th>
                <th className="pb-1">%</th>
                <th className="pb-1 text-right">Final.</th>
                <th className="pb-1 text-right">Andam.</th>
                <th className="pb-1 text-right">Não in.</th>
              </tr>
            </thead>
            <tbody>
              {porServico.map(({ serv, c, pct }) => (
                <tr key={serv.id} className="border-t border-border">
                  <td className="py-1">{serv.nome}</td>
                  <td className="py-1">{pct}%</td>
                  <td className="py-1 text-right">{c.FINALIZADO}</td>
                  <td className="py-1 text-right">{c.ANDAMENTO}</td>
                  <td className="py-1 text-right">{c.NAO_INICIADO}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          header,
          aside,
          .print\\:hidden {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          main {
            padding: 0 !important;
          }
          .card {
            padding: 8px 10px !important;
            box-shadow: none !important;
            border-radius: 6px !important;
          }
          h1 {
            font-size: 16px !important;
          }
          table {
            font-size: 8.5px !important;
          }
          th,
          td {
            padding: 2px 5px !important;
          }
        }
      `}</style>
    </div>
  );
}

function HistoricoPanel({
  historico,
  unidadeById,
  pavById,
  torres,
  servicoById,
  onExportarCSV,
}: {
  historico: HistoricoItem[];
  unidadeById: Map<string, Unidade>;
  pavById: Map<string, Pavimento>;
  torres: Torre[];
  servicoById: Map<string, ServicoAndamento>;
  onExportarCSV: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onExportarCSV} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm">
          <Download className="w-4 h-4" /> Exportar histórico (CSV)
        </button>
        <span className="text-xs text-ink-500">
          Registro de quem apontou cada status ou observação — uso interno do engenheiro, não entra no relatório visual.
        </span>
      </div>
      <div className="card-table">
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left sticky top-0 bg-surface-subtle text-[10px] uppercase text-ink-400">
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Quem</th>
                <th className="px-3 py-2">Onde</th>
                <th className="px-3 py-2">O que mudou</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-ink-400 py-10">
                    Nenhuma atualização registrada ainda nesta obra.
                  </td>
                </tr>
              )}
              {historico.map((h) => {
                const u = unidadeById.get(h.unidade_id);
                const pav = u ? pavById.get(u.pavimento_id) : undefined;
                const torre = pav ? torres.find((t) => t.id === pav.torre_id) : undefined;
                const serv = servicoById.get(h.servico_id);
                return (
                  <tr key={h.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-ink-500">{new Date(h.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{h.autor_nome ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {torre?.nome} · {pav?.nome} · {u?.nome} · {serv?.nome}
                    </td>
                    <td className="px-3 py-2">
                      {h.tipo === "STATUS" ? (
                        <>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#e7f0f1] text-primaryDark mr-1">Status</span>
                          {h.de ? STATUS_LABEL[h.de as StatusAndamento] ?? h.de : "—"} → <b>{h.para ? STATUS_LABEL[h.para as StatusAndamento] ?? h.para : ""}</b>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f3ede1] text-[#8a6d3b] mr-1">Observação</span>
                          {h.observacao}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
