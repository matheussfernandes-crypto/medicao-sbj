"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, ChevronLeft, ChevronRight, LayoutGrid, List, X } from "lucide-react";
import * as acoes from "./acoesAndamento";
import Grade, { type LinhaGrade } from "./Grade";
import FachadaView from "./FachadaView";
import { Barra, BotoesStatus, IconeX, Legenda, PopupCelula, fmtPct, fmtPct0 } from "./ui";
import {
  COR_STATUS,
  ROTULO_STATUS,
  acumular,
  chaveAp,
  juntar,
  mapaApontamentos,
  montarIndice,
  pct,
  somaZero,
  somarAlvo,
  type Soma,
} from "./calculo";
import type { Apontamento, Categoria, DadosAndamento, Local, Servico, SistemaItem, Status } from "./types";

type Modo = "geral" | "pav" | "tipo" | "sis";
type Cel = { alvo: string; servico: string };
type PopupInfo = { x: number; y: number; cels: Cel[]; alvoId: string | null; servicoId: string; titulo: string; subtitulo: string };

export default function AndamentoClient({ dados }: { dados: DadosAndamento }) {
  const router = useRouter();
  const { obra, obras, categorias, servicos, vinculos, pavimentos, locais, sistemas, itens, usuario } = dados;
  const podeApontar = usuario.setor === "ADMIN" || usuario.setor === "ESTAGIARIO";

  const idx = useMemo(() => montarIndice(categorias, servicos, vinculos), [categorias, servicos, vinculos]);
  const [ap, setAp] = useState<Map<string, Apontamento>>(() => mapaApontamentos(dados.apontamentos));
  useEffect(() => setAp(mapaApontamentos(dados.apontamentos)), [dados.apontamentos]);

  const [modo, setModo] = useState<Modo>("geral");
  const [pavSel, setPavSel] = useState<string | null>(pavimentos[0]?.id ?? null);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [sisSel, setSisSel] = useState<string | null>(sistemas[0]?.id ?? null);
  const [visual, setVisual] = useState<"grade" | "lista">("grade");
  const [modoSel, setModoSel] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [chipId, setChipId] = useState<string | null>(null);
  const [soFalta, setSoFalta] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 760) setVisual("lista");
  }, []);

  // ---------- estrutura derivada ----------
  const pavs = useMemo(() => [...pavimentos].sort((a, b) => a.ordem - b.ordem), [pavimentos]);
  const locaisPorPav = useMemo(() => {
    const m = new Map<string, Local[]>();
    locais.forEach((l) => m.set(l.pavimento_id, [...(m.get(l.pavimento_id) ?? []), l]));
    m.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
    return m;
  }, [locais]);
  const itensPorSis = useMemo(() => {
    const m = new Map<string, SistemaItem[]>();
    itens.forEach((i) => m.set(i.sistema_id, [...(m.get(i.sistema_id) ?? []), i]));
    m.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
    return m;
  }, [itens]);
  const pavPorId = useMemo(() => new Map(pavs.map((p) => [p.id, p])), [pavs]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, l])), [locais]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const sisPorId = useMemo(() => new Map(sistemas.map((s) => [s.id, s])), [sistemas]);

  // ---------- somas ponderadas ----------
  const somaPorAlvo = useMemo(() => {
    const m = new Map<string, Soma>();
    locais.forEach((l) => m.set(l.id, somarAlvo(l.id, l.categoria_id, idx, ap)));
    itens.forEach((i) => m.set(i.id, somarAlvo(i.id, i.categoria_id, idx, ap)));
    return m;
  }, [locais, itens, idx, ap]);

  const agregados = useMemo(() => {
    const obraS = somaZero(),
      locaisS = somaZero(),
      sisTodos = somaZero();
    const porPav = new Map<string, Soma>(),
      porCat = new Map<string, Soma>(),
      porSis = new Map<string, Soma>();
    const mais = (m: Map<string, Soma>, k: string, s: Soma) => m.set(k, juntar(m.get(k) ?? somaZero(), s));
    locais.forEach((l) => {
      const s = somaPorAlvo.get(l.id)!;
      Object.assign(obraS, juntar(obraS, s));
      Object.assign(locaisS, juntar(locaisS, s));
      mais(porPav, l.pavimento_id, s);
      mais(porCat, l.categoria_id, s);
    });
    itens.forEach((i) => {
      const s = somaPorAlvo.get(i.id)!;
      Object.assign(obraS, juntar(obraS, s));
      Object.assign(sisTodos, juntar(sisTodos, s));
      mais(porSis, i.sistema_id, s);
      mais(porCat, i.categoria_id, s);
    });
    return { obraS, locaisS, sisTodos, porPav, porCat, porSis };
  }, [locais, itens, somaPorAlvo]);

  const pctGeral = pct(agregados.obraS);

  // ---------- apontar ----------
  function expandir(alvoId: string, servicoId: string): Cel[] {
    const s = idx.servicoPorId.get(servicoId);
    const l = localPorId.get(alvoId);
    if (s && l && s.vale_pavimento_inteiro) {
      return (locaisPorPav.get(l.pavimento_id) ?? [])
        .filter((x) => (idx.servicosDaCat.get(x.categoria_id) ?? []).some((v) => v.servico.id === s.id))
        .map((x) => ({ alvo: x.id, servico: s.id }));
    }
    return [{ alvo: alvoId, servico: servicoId }];
  }

  async function aplicar(cels: Cel[], status: Status) {
    if (!podeApontar || cels.length === 0) return;
    const unicas = Array.from(new Map(cels.map((c) => [chaveAp(c.alvo, c.servico), c])).values());
    const agora = new Date().toISOString();
    setAp((prev) => {
      const prox = new Map(prev);
      unicas.forEach((c) => {
        const k = chaveAp(c.alvo, c.servico);
        const antes = prev.get(k);
        prox.set(k, { alvo: c.alvo, servico_id: c.servico, status, observacao: antes?.observacao ?? null, por: usuario.nome, em: agora });
      });
      return prox;
    });
    try {
      await acoes.apontarLote(
        obra.id,
        unicas.map((c) => (localPorId.has(c.alvo) ? { l: c.alvo, s: c.servico } : { i: c.alvo, s: c.servico })),
        status
      );
    } catch (e: any) {
      setErro(e.message ?? "Não foi possível salvar.");
      router.refresh();
    }
  }

  function aplicarSelecao(status: Status) {
    const cels = Array.from(sel).flatMap((k) => {
      const [alvo, servico] = k.split("|");
      return expandir(alvo, servico);
    });
    setSel(new Set());
    aplicar(cels, status);
  }

  function abrirCelula(e: React.MouseEvent, alvoId: string, servicoId: string) {
    const l = localPorId.get(alvoId);
    const i = itemPorId.get(alvoId);
    const s = idx.servicoPorId.get(servicoId)!;
    const nomePav = l ? pavPorId.get(l.pavimento_id)?.nome : sisPorId.get(i!.sistema_id)?.nome;
    setPopup({
      x: e.clientX,
      y: e.clientY,
      cels: expandir(alvoId, servicoId),
      alvoId,
      servicoId,
      titulo: `${nomePav} · ${l?.nome ?? i?.nome}`,
      subtitulo: s.nome + (s.vale_pavimento_inteiro && l ? " (vale para o pavimento inteiro)" : ""),
    });
  }

  async function salvarObs(texto: string) {
    if (!popup || !popup.alvoId) return;
    const alvoId = popup.alvoId;
    const servicoId = popup.servicoId;
    const k = chaveAp(alvoId, servicoId);
    setAp((prev) => {
      const prox = new Map(prev);
      const a = prev.get(k);
      prox.set(k, { alvo: alvoId, servico_id: servicoId, status: a?.status ?? 0, observacao: texto.trim() || null, por: usuario.nome, em: new Date().toISOString() });
      return prox;
    });
    setPopup(null);
    try {
      await acoes.salvarObservacao(obra.id, localPorId.has(alvoId) ? { l: alvoId } : { i: alvoId }, servicoId, texto);
    } catch (e: any) {
      setErro(e.message);
      router.refresh();
    }
  }

  const alternarModoSel = () => {
    setModoSel((v) => !v);
    setSel(new Set());
    setPopup(null);
  };
  const irPara = (m: Modo) => {
    setModo(m);
    setSel(new Set());
    setPopup(null);
  };

  // ---------- peças de apresentação ----------
  const servicosDaCategoria = (cat: Categoria, semPavInteiro: boolean): Servico[] =>
    (idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico).filter((s) => !(semPavInteiro && s.vale_pavimento_inteiro));

  const categoriasPresentes = (lista: Local[]) => categorias.filter((c) => lista.some((l) => l.categoria_id === c.id));

  const BarraLinha = ({ nome, s, onClick, extra }: { nome: string; s: Soma; onClick?: () => void; extra?: React.ReactNode }) => (
    <button type="button" onClick={onClick} className="w-full text-left py-1.5 px-1 rounded hover:bg-surface-subtle">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium w-28 truncate">{nome}</span>
        <div className="flex-1">
          <Barra s={s} h={9} />
        </div>
        <span className="w-10 text-right font-semibold tabular-nums">{fmtPct0(pct(s))}%</span>
        {extra}
      </div>
    </button>
  );

  const Etiqueta = ({ cat }: { cat: Categoria }) => (
    <span className="inline-block text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: cat.cor }}>
      {cat.nome}
    </span>
  );

  const botaoSel = (
    <button
      type="button"
      onClick={alternarModoSel}
      disabled={!podeApontar}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border ${modoSel ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border text-ink-700"}`}
    >
      {modoSel ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
      {modoSel ? "Sair da seleção" : "Selecionar várias"}
    </button>
  );
  const dicaSel = modoSel ? <span className="text-xs text-ink-500">Clique ou arraste nas células; clique no nome do serviço (coluna) ou do local (linha).</span> : null;

  // ---------- Pavimentos ----------
  function FaixaPavInteiro({ pavId }: { pavId: string }) {
    const locs = locaisPorPav.get(pavId) ?? [];
    const mapa = new Map<string, Servico>();
    locs.forEach((l) => (idx.servicosDaCat.get(l.categoria_id) ?? []).forEach((x) => x.servico.vale_pavimento_inteiro && mapa.set(x.servico.id, x.servico)));
    const lista = Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem);
    if (!lista.length) return null;
    return (
      <div className="border border-border rounded-lg p-3 bg-white">
        <p className="text-xs font-semibold text-primaryDark mb-2">Vale para o pavimento inteiro</p>
        <div className="space-y-2">
          {lista.map((s) => {
            const alvos = locs.filter((l) => (idx.servicosDaCat.get(l.categoria_id) ?? []).some((x) => x.servico.id === s.id));
            const sts = new Set(alvos.map((l) => (ap.get(chaveAp(l.id, s.id))?.status ?? 0) as Status));
            const unico = sts.size === 1 ? Array.from(sts)[0] : null;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium w-44">{s.nome}</span>
                <div className="w-72 max-w-full">
                  <BotoesStatus atual={unico} onSet={(st) => aplicar(alvos.map((l) => ({ alvo: l.id, servico: s.id })), st)} />
                </div>
                {unico === null && <span className="text-[11px] text-ink-500">estados diferentes entre os locais</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function ViewPavimentos() {
    const pav = (pavSel && pavPorId.get(pavSel)) || pavs[0];
    if (!pav) return <div className="card text-sm text-ink-500">Nenhum pavimento cadastrado. Cadastre em "Pavimentos e serviços".</div>;
    const locs = locaisPorPav.get(pav.id) ?? [];
    const cats = categoriasPresentes(locs);
    const sPav = agregados.porPav.get(pav.id) ?? somaZero();
    return (
      <div className="grid lg:grid-cols-[230px_1fr] gap-4 items-start">
        <div className="card p-2 lg:sticky lg:top-2 hidden lg:block max-h-[80vh] overflow-auto">
          {pavs.map((p) => {
            const s = agregados.porPav.get(p.id) ?? somaZero();
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPavSel(p.id);
                  setSel(new Set());
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md ${p.id === pav.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-surface-subtle"}`}
              >
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{p.nome}</span>
                  <span className="tabular-nums font-semibold">{fmtPct0(pct(s))}%</span>
                </div>
                <Barra s={s} h={5} />
              </button>
            );
          })}
        </div>
        <div className="space-y-3 min-w-0">
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-primaryDark">{pav.nome}</h2>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "#2c6975" }}>
                {fmtPct(pct(sPav))}%
              </span>
              <div className="w-40">
                <Barra s={sPav} h={10} />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex border border-border rounded-md overflow-hidden">
                  <button className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${visual === "lista" ? "bg-primaryDark text-white" : "bg-white"}`} onClick={() => setVisual("lista")}>
                    <List className="w-3.5 h-3.5" /> Lista
                  </button>
                  <button className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${visual === "grade" ? "bg-primaryDark text-white" : "bg-white"}`} onClick={() => setVisual("grade")}>
                    <LayoutGrid className="w-3.5 h-3.5" /> Grade
                  </button>
                </div>
                {visual === "grade" && botaoSel}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <Legenda />
              {dicaSel}
            </div>
          </div>

          {visual === "lista" ? (
            ListaPavimento()
          ) : (
            <>
              <FaixaPavInteiro pavId={pav.id} />
              {cats.map((c) => {
                const linhas: LinhaGrade[] = locs.filter((l) => l.categoria_id === c.id).map((l) => ({ alvoId: l.id, rotulo: l.nome }));
                const cols = servicosDaCategoria(c, true);
                const sc = linhas.reduce((a, l) => juntar(a, somaPorAlvo.get(l.alvoId) ?? somaZero()), somaZero());
                return (
                  <div key={c.id} className="border border-border rounded-lg bg-white p-3" style={{ borderLeft: `5px solid ${c.cor}` }}>
                    <div className="flex items-center gap-3 mb-2">
                      <Etiqueta cat={c} />
                      <div className="w-32">
                        <Barra s={sc} h={7} cor={c.cor} />
                      </div>
                      <b className="text-sm" style={{ color: c.cor }}>
                        {fmtPct0(pct(sc))}%
                      </b>
                    </div>
                    <Grade linhas={linhas} colunas={cols} ap={ap} somaPorAlvo={somaPorAlvo} modoSel={modoSel} sel={sel} setSel={setSel} onCelula={abrirCelula} corDestaque={c.cor} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- modo Lista (celular): um local por vez, botões grandes ----------
  function ListaPavimento() {
    const pavIdx = Math.max(0, pavs.findIndex((p) => p.id === pavSel));
    const pav = pavs[pavIdx];
    const locs = pav ? locaisPorPav.get(pav.id) ?? [] : [];
    const chips: { id: string; rotulo: string; alvos: Local[]; cat: Categoria }[] = [];
    categoriasPresentes(locs).forEach((c) => {
      const l = locs.filter((x) => x.categoria_id === c.id);
      if (l.length > 1) chips.push({ id: "todos:" + c.id, rotulo: `Todos · ${c.nome}`, alvos: l, cat: c });
      l.forEach((x) => chips.push({ id: x.id, rotulo: x.nome, alvos: [x], cat: c }));
    });
    const chip = chips.find((c) => c.id === chipId) ?? chips[0];
    if (!pav) return null;
    const lista = chip ? servicosDaCategoria(chip.cat, true) : [];
    return (
      <div className="space-y-3">
        <FaixaPavInteiro pavId={pav.id} />
        <div className="flex items-center gap-2">
          <button className="w-12 h-12 rounded-lg border border-border bg-white flex items-center justify-center disabled:opacity-40" disabled={pavIdx === 0} onClick={() => { setPavSel(pavs[pavIdx - 1].id); setChipId(null); }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <select value={pav.id} onChange={(e) => { setPavSel(e.target.value); setChipId(null); }} className="flex-1 h-12 border border-border rounded-lg px-3 text-base bg-white">
            {pavs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {fmtPct0(pct(agregados.porPav.get(p.id) ?? somaZero()))}%
              </option>
            ))}
          </select>
          <button className="w-12 h-12 rounded-lg border border-border bg-white flex items-center justify-center disabled:opacity-40" disabled={pavIdx === pavs.length - 1} onClick={() => { setPavSel(pavs[pavIdx + 1].id); setChipId(null); }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setChipId(c.id)}
              className={`px-3 py-2 rounded-full text-sm border flex items-center gap-1.5 ${chip?.id === c.id ? "bg-primary text-white border-primary" : "bg-white border-border"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.cat.cor }} />
              {c.rotulo}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soFalta} onChange={(e) => setSoFalta(e.target.checked)} /> Só o que falta
        </label>
        {chip && (
          <div className="space-y-2">
            {lista.map((s) => {
              const sts = chip.alvos.map((l) => (ap.get(chaveAp(l.id, s.id))?.status ?? 0) as Status);
              const unico = new Set(sts).size === 1 ? sts[0] : null;
              const fin = sts.filter((x) => x === 2).length;
              if (soFalta && fin === sts.length) return null;
              const cor = unico !== null ? COR_STATUS[unico] : "#f0a020";
              return (
                <div key={s.id} className="bg-white border border-border rounded-lg p-3" style={{ borderLeft: `6px solid ${cor === "#ffffff" ? "#cbd5e1" : cor}` }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-sm">{s.nome}</span>
                    {chip.alvos.length > 1 && (
                      <span className="text-xs text-ink-500">
                        {fin}/{chip.alvos.length} finalizados
                      </span>
                    )}
                  </div>
                  <BotoesStatus grande atual={unico} incluirAusencia={false} onSet={(st) => aplicar(chip.alvos.map((l) => ({ alvo: l.id, servico: s.id })), st)} />
                  <button
                    className="mt-2 text-xs text-primary underline"
                    onClick={(e) => {
                      const a = chip.alvos[0];
                      setPopup({
                        x: e.clientX,
                        y: e.clientY,
                        cels: chip.alvos.map((l) => ({ alvo: l.id, servico: s.id })),
                        alvoId: chip.alvos.length === 1 ? a.id : null,
                        servicoId: s.id,
                        titulo: `${pav.nome} · ${chip.rotulo}`,
                        subtitulo: s.nome,
                      });
                    }}
                  >
                    Obs. / ausência
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Tipos de local ----------
  function ViewTipos() {
    const comLocais = categoriasPresentes(locais);
    const cat = comLocais.find((c) => c.id === catSel) ?? comLocais[0];
    if (!cat) return <div className="card text-sm text-ink-500">Nenhum local cadastrado.</div>;
    const sCat = agregados.porCat.get(cat.id) ?? somaZero();
    const pavsCat = pavs.filter((p) => (locaisPorPav.get(p.id) ?? []).some((l) => l.categoria_id === cat.id));
    const linhas: LinhaGrade[] = pavsCat.flatMap((p) =>
      (locaisPorPav.get(p.id) ?? []).filter((l) => l.categoria_id === cat.id).map((l) => ({ alvoId: l.id, rotulo: l.nome, grupoId: p.id, grupoRotulo: p.nome }))
    );
    const colsInteiro = servicosDaCategoria(cat, false).filter((s) => s.vale_pavimento_inteiro);
    const cols = servicosDaCategoria(cat, true);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {comLocais.map((c) => {
            const s = agregados.porCat.get(c.id) ?? somaZero();
            return (
              <button key={c.id} onClick={() => { setCatSel(c.id); setSel(new Set()); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${c.id === cat.id ? "bg-primary/10 border-primary font-semibold" : "bg-white border-border"}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.cor }} />
                {c.nome} · {fmtPct0(pct(s))}%
              </button>
            );
          })}
        </div>
        <div className="card">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-primaryDark">{cat.nome}</h2>
            <span className="text-xs text-ink-500">em {pavsCat.length} pavimentos, de cima para baixo</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: cat.cor }}>
              {fmtPct(pct(sCat))}%
            </span>
            <div className="ml-auto">{botaoSel}</div>
          </div>
          <div className="mt-2 flex items-center gap-4 flex-wrap">
            <Legenda />
            {dicaSel}
          </div>
        </div>

        {colsInteiro.length > 0 && (
          <div className="border border-border rounded-lg bg-white p-3">
            <p className="text-xs font-semibold text-primaryDark mb-2">Pavimento inteiro</p>
            <div className="overflow-auto">
              <table className="border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1 border-b border-r border-border">Pavimento</th>
                    {colsInteiro.map((s) => (
                      <th key={s.id} className="px-2 py-1 border-b border-r border-border font-semibold text-primaryDark">
                        {s.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pavsCat.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 py-1 border-b border-r border-border font-medium whitespace-nowrap">{p.nome}</td>
                      {colsInteiro.map((s) => {
                        const alvos = (locaisPorPav.get(p.id) ?? []).filter((l) => (idx.servicosDaCat.get(l.categoria_id) ?? []).some((x) => x.servico.id === s.id));
                        const sts = alvos.map((l) => (ap.get(chaveAp(l.id, s.id))?.status ?? 0) as Status);
                        const unico = new Set(sts).size === 1 ? sts[0] : null;
                        return (
                          <td
                            key={s.id}
                            className="border-b border-r border-border text-center cursor-pointer"
                            style={{ background: unico === null ? "repeating-linear-gradient(45deg,#f0a020,#f0a020 4px,#e3e7e9 4px,#e3e7e9 8px)" : COR_STATUS[unico], height: 30, minWidth: 90 }}
                            title={`${p.nome} · ${s.nome}`}
                            onClick={(e) =>
                              podeApontar &&
                              setPopup({
                                x: e.clientX,
                                y: e.clientY,
                                cels: alvos.map((l) => ({ alvo: l.id, servico: s.id })),
                                alvoId: null,
                                servicoId: s.id,
                                titulo: p.nome,
                                subtitulo: `${s.nome} — aplica no pavimento todo`,
                              })
                            }
                          >
                            {unico === 3 && <IconeX />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border border-border rounded-lg bg-white p-3" style={{ borderLeft: `5px solid ${cat.cor}` }}>
          <p className="text-xs font-semibold text-primaryDark mb-2">{cat.nome} em todos os pavimentos</p>
          <Grade linhas={linhas} colunas={cols} ap={ap} somaPorAlvo={somaPorAlvo} modoSel={modoSel} sel={sel} setSel={setSel} onCelula={abrirCelula} corDestaque={cat.cor} />
        </div>
      </div>
    );
  }

  // ---------- Sistemas ----------
  function ViewSistemas() {
    const sis = (sisSel && sisPorId.get(sisSel)) || sistemas[0];
    if (!sis) return <div className="card text-sm text-ink-500">Nenhum sistema cadastrado.</div>;
    const its = itensPorSis.get(sis.id) ?? [];
    const sSis = agregados.porSis.get(sis.id) ?? somaZero();
    const cats = categorias.filter((c) => its.some((i) => i.categoria_id === c.id));
    const reservatorios = its.length > 0 && its.every((i) => ["cxf", "cxc"].includes(idx.catPorId.get(i.categoria_id)?.chave ?? ""));
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {sistemas.map((s) => (
            <button key={s.id} onClick={() => { setSisSel(s.id); setSel(new Set()); }} className={`px-3 py-1.5 rounded-full text-xs border ${s.id === sis.id ? "bg-primary/10 border-primary font-semibold" : "bg-white border-border"}`}>
              {s.nome} · {fmtPct0(pct(agregados.porSis.get(s.id) ?? somaZero()))}%
            </button>
          ))}
        </div>
        {sis.tipo === "fachada" ? (
          <FachadaView
            dados={dados}
            idx={idx}
            ap={ap}
            sistema={sis}
            itens={its}
            pavs={pavs}
            locaisPorPav={locaisPorPav}
            soma={sSis}
            podeApontar={podeApontar}
            aplicar={aplicar}
            modoSel={modoSel}
            alternarModoSel={alternarModoSel}
            sel={sel}
            setSel={setSel}
          />
        ) : (
          <>
            <div className="card">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-primaryDark">{sis.nome}</h2>
                <span className="text-2xl font-bold tabular-nums text-primary">{fmtPct(pct(sSis))}%</span>
                <div className="ml-auto">{botaoSel}</div>
              </div>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                <Legenda />
                {dicaSel}
              </div>
              {reservatorios && podeApontar && (
                <div className="mt-3 space-y-2">
                  {its.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium w-48">{i.nome}</span>
                      <div className="flex border border-border rounded-md overflow-hidden">
                        {([["cxf", "Fibra"], ["cxc", "Concreto armado"]] as const).map(([k, nome]) => (
                          <button
                            key={k}
                            className={`px-3 py-1.5 text-xs ${idx.catPorId.get(i.categoria_id)?.chave === k ? "bg-primaryDark text-white" : "bg-white"}`}
                            onClick={async () => {
                              try {
                                await acoes.trocarReservatorio(i.id, k);
                                router.refresh();
                              } catch (e: any) {
                                setErro(e.message);
                              }
                            }}
                          >
                            {nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cats.map((c) => {
              const linhas: LinhaGrade[] = its.filter((i) => i.categoria_id === c.id).map((i) => ({ alvoId: i.id, rotulo: i.nome }));
              return (
                <div key={c.id} className="border border-border rounded-lg bg-white p-3" style={{ borderLeft: `5px solid ${c.cor}` }}>
                  <div className="mb-2">
                    <Etiqueta cat={c} />
                  </div>
                  <Grade linhas={linhas} colunas={servicosDaCategoria(c, false)} ap={ap} somaPorAlvo={somaPorAlvo} modoSel={modoSel} sel={sel} setSel={setSel} onCelula={abrirCelula} tituloLinha="Item" corDestaque={c.cor} />
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ---------- Visão geral ----------
  function ViewGeral() {
    const comLocais = categoriasPresentes(locais);
    return (
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Pavimentos</h2>
          <div className="space-y-0.5">
            {pavs.map((p) => {
              const cs = categoriasPresentes(locaisPorPav.get(p.id) ?? []);
              return (
                <BarraLinha
                  key={p.id}
                  nome={p.nome}
                  s={agregados.porPav.get(p.id) ?? somaZero()}
                  onClick={() => { setPavSel(p.id); irPara("pav"); }}
                  extra={
                    <span className="hidden sm:flex gap-0.5 w-16 justify-end">
                      {cs.map((c) => (
                        <i key={c.id} className="w-2 h-2 rounded-full" style={{ background: c.cor }} title={c.nome} />
                      ))}
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-primaryDark mb-2">Sistemas</h2>
            {sistemas.map((s) => (
              <BarraLinha key={s.id} nome={s.nome} s={agregados.porSis.get(s.id) ?? somaZero()} onClick={() => { setSisSel(s.id); irPara("sis"); }} />
            ))}
          </div>
          <div className="card">
            <h2 className="font-semibold text-primaryDark mb-2">Tipos de local</h2>
            {comLocais.map((c) => (
              <button key={c.id} type="button" onClick={() => { setCatSel(c.id); irPara("tipo"); }} className="w-full text-left py-1.5 px-1 rounded hover:bg-surface-subtle">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.cor }} />
                  <span className="font-medium w-32 truncate">{c.nome}</span>
                  <div className="flex-1">
                    <Barra s={agregados.porCat.get(c.id) ?? somaZero()} h={9} cor={c.cor} />
                  </div>
                  <span className="w-10 text-right font-semibold tabular-nums">{fmtPct0(pct(agregados.porCat.get(c.id) ?? somaZero()))}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- cartões do topo ----------
  const cartoes: { k: Modo; nome: string; s: Soma; resumo: string }[] = [
    { k: "geral", nome: "Visão geral", s: agregados.obraS, resumo: `${pavs.length} pavimentos · ${sistemas.length} sistemas` },
    { k: "pav", nome: "Pavimentos", s: agregados.locaisS, resumo: `${locais.length} locais` },
    { k: "tipo", nome: "Tipos de local", s: agregados.obraS, resumo: `${categoriasPresentes(locais).length} categorias` },
    { k: "sis", nome: "Sistemas", s: agregados.sisTodos, resumo: `${itens.length} itens` },
  ];

  const popAtual = popup && popup.cels.length ? ((): Status => {
    const sts = new Set(popup.cels.map((c) => (ap.get(chaveAp(c.alvo, c.servico))?.status ?? 0) as Status));
    return sts.size === 1 ? Array.from(sts)[0] : 0;
  })() : 0;
  const popAp = popup?.alvoId ? ap.get(chaveAp(popup.alvoId, popup.servicoId)) : undefined;

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

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="block text-xs text-ink-500 mb-1">Obra</label>
          <select className="border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] bg-white" value={obra.id} onChange={(e) => router.push(`/andamento-novo?obra=${e.target.value}`)}>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-5 text-sm">
          <div>
            <div className="text-[11px] uppercase text-ink-500">Índice geral</div>
            <b className="text-xl text-primaryDark">{fmtPct(pctGeral)}%</b>
          </div>
          <div>
            <div className="text-[11px] uppercase text-ink-500">Em andamento</div>
            <b className="text-xl text-amber-600">{agregados.obraS.and}</b>
          </div>
          <div>
            <div className="text-[11px] uppercase text-ink-500">Não iniciados</div>
            <b className="text-xl text-ink-700">{agregados.obraS.nao}</b>
            <span className="text-[11px] text-ink-500 ml-1">de {agregados.obraS.tot} etapas</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 print:hidden">
        {cartoes.map((c) => (
          <button
            key={c.k}
            onClick={() => irPara(c.k)}
            className={`min-w-[170px] flex-1 text-left rounded-xl border p-3 bg-white ${modo === c.k ? "border-primary bg-primary/5" : "border-border"}`}
            style={modo === c.k ? { borderTop: "4px solid #2c6975" } : { borderTop: "4px solid transparent" }}
          >
            <div className="text-xs text-ink-500">{c.nome}</div>
            <div className="text-2xl font-bold text-primaryDark tabular-nums">{fmtPct(pct(c.s))}%</div>
            <Barra s={c.s} h={6} />
            <div className="text-[11px] text-ink-500 mt-1">{c.resumo}</div>
          </button>
        ))}
      </div>

      {modo === "geral" && ViewGeral()}
      {modo === "pav" && ViewPavimentos()}
      {modo === "tipo" && ViewTipos()}
      {modo === "sis" && ViewSistemas()}

      {modoSel && sel.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primaryDark text-white rounded-xl shadow-panel px-4 py-3 flex items-center gap-3 flex-wrap justify-center">
          <span className="text-sm font-medium">
            {sel.size} célula{sel.size > 1 ? "s" : ""} selecionada{sel.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-1.5">
            {([0, 1, 2, 3] as Status[]).map((s) => (
              <button key={s} onClick={() => aplicarSelecao(s)} className="rounded-md py-1.5 px-3 text-xs font-semibold" style={{ background: COR_STATUS[s], color: s === 3 || s === 0 ? "#374151" : s === 1 ? "#3b2a00" : "#fff" }}>
                {ROTULO_STATUS[s]}
              </button>
            ))}
          </div>
          <button onClick={() => setSel(new Set())} className="text-xs text-white/70 hover:text-white underline">
            Limpar seleção
          </button>
          <button onClick={alternarModoSel} className="text-xs text-white/70 hover:text-white underline">
            Sair
          </button>
        </div>
      )}

      {popup && podeApontar && (
        <PopupCelula
          x={popup.x}
          y={popup.y}
          titulo={popup.titulo}
          subtitulo={popup.subtitulo}
          atual={popAtual}
          observacao={popAp?.observacao ?? ""}
          autor={popAp?.por ? `${popAp.por}${popAp.em ? " em " + new Date(popAp.em).toLocaleString("pt-BR") : ""}` : null}
          onStatus={(s) => {
            aplicar(popup.cels, s);
          }}
          onObs={salvarObs}
          onFechar={() => setPopup(null)}
        />
      )}
    </div>
  );
}
