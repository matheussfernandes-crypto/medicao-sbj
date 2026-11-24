"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FileText, Pencil, Plus, Trees } from "lucide-react";
import { AMBIENTES_LAZER, GRUPOS, fold, tituloAmbiente, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import { FASE_PREDIO } from "@/lib/especificacoes/predios";
import { salvarLazer } from "../../../actions";
import { DesenhoVidro, Miniatura } from "../../../comum";
import { btnPrim, btnSec, campo, erroCls, rotulo } from "../../../ui";

export type ProjetoPredio = { id: string; codigo: string | null; titulo: string; cliente: string | null; tipo: string; ambientes: string[] | null };
export type ItemPredio = {
  id: string; projeto_id: string; grupo: Grupo; ambiente: string; material: string; referencia: string; medidas: string; qtd: number; img: string; ordem: number; vidro: Vidro | null;
};

export default function VistaPredio({
  predio, projetos, itens, assinadas, grupoInicial, abrirLazer,
}: {
  predio: { id: string; nome: string; fase: string | null }; projetos: ProjetoPredio[]; itens: ItemPredio[];
  assinadas: Record<string, string>; grupoInicial: Grupo; abrirLazer: boolean;
}) {
  const [grupo, setGrupoState] = useState<Grupo>(grupoInicial);
  const lazer = projetos.find((p) => p.tipo === "lazer");
  const [editarLazer, setEditarLazer] = useState(abrirLazer || false);
  const g = GRUPOS.find((x) => x.id === grupo)!;

  function setGrupo(x: Grupo) {
    setGrupoState(x);
    window.history.replaceState(null, "", `?grupo=${x}`);
  }
  const contagem = (x: Grupo) => itens.filter((i) => i.grupo === x).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/arquitetura/especificacoes" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Especificações
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primaryDark">
            <Building2 className="h-5 w-5 text-primary" /> {predio.nome}
          </h1>
          <p className="text-sm text-ink-500">
            {predio.fase ? `${FASE_PREDIO[predio.fase] ?? predio.fase} · ` : ""}
            {projetos.filter((p) => p.tipo !== "lazer").length} unidade(s) · {lazer ? `lazer com ${(lazer.ambientes ?? []).length} ambiente(s)` : "sem lazer cadastrado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lazer ? (
            <>
              <Link href={`/arquitetura/especificacoes/${lazer.id}`} className={btnSec}>
                <Trees className="h-4 w-4" /> Abrir lazer
              </Link>
              <button type="button" className={btnSec} onClick={() => setEditarLazer((x) => !x)}>
                <Pencil className="h-4 w-4" /> Ambientes do lazer
              </button>
            </>
          ) : (
            <button type="button" className={btnSec} onClick={() => setEditarLazer(true)}>
              <Trees className="h-4 w-4" /> Cadastrar lazer
            </button>
          )}
          <a href={`/imprimir/especificacoes/predio/${predio.id}?grupo=${grupo}`} target="_blank" rel="noopener" className={btnSec} title="Só o grupo aberto, em A3 paisagem">
            <FileText className="h-4 w-4" /> PDF · {g.curto}
          </a>
          <a href={`/imprimir/especificacoes/predio/${predio.id}?grupo=todos`} target="_blank" rel="noopener" className={btnPrim} title="Os três grupos, em A3 paisagem">
            <FileText className="h-4 w-4" /> PDF completo do prédio
          </a>
        </div>
      </div>

      {editarLazer && <FormLazer predioId={predio.id} inicial={lazer?.ambientes ?? null} onFechar={() => setEditarLazer(false)} />}

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {GRUPOS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setGrupo(x.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
              x.id === grupo ? "border-primary text-primary" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {x.curto} <span className="ml-1 text-xs font-normal text-ink-400">{contagem(x.id)}</span>
          </button>
        ))}
      </div>

      {!projetos.length && (
        <div className="card py-6 text-center text-sm text-ink-500">
          Nenhuma unidade deste prédio ainda. Cadastre em <Link href="/arquitetura/especificacoes" className="text-primary hover:underline">Especificações › Novo projeto</Link>.
        </div>
      )}

      {projetos.map((p) => {
        const meus = itens.filter((i) => i.projeto_id === p.id && i.grupo === grupo).sort((a, b) => a.ordem - b.ordem);
        const amb = new Map<string, ItemPredio[]>();
        for (const i of meus) {
          const k = i.ambiente || "Sem ambiente";
          if (!amb.has(k)) amb.set(k, []);
          amb.get(k)!.push(i);
        }
        if (p.tipo === "lazer") for (const a of p.ambientes ?? []) if (!Array.from(amb.keys()).some((k) => fold(k) === fold(a))) amb.set(a, []);
        return (
          <div key={p.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                {p.tipo === "lazer" ? <Trees className="h-4 w-4 self-center text-success" /> : p.codigo && <span className="text-xs font-semibold text-ink-400">{p.codigo}</span>}
                <h2 className="font-semibold text-primaryDark">{p.tipo === "lazer" ? "Lazer" : p.titulo}</h2>
                {p.cliente && <span className="text-xs text-ink-500">{p.cliente}</span>}
              </div>
              <Link href={`/arquitetura/especificacoes/${p.id}?grupo=${grupo}`} className={btnSec}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </div>
            {!amb.size && <p className="text-sm text-ink-500">Nada especificado em {g.curto.toLowerCase()}.</p>}
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from(amb.entries()).map(([a, lista]) => (
                <div key={a} className="rounded-[10px] border border-border">
                  <div className="border-b border-border bg-surface-subtle px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primaryDark">{a}</div>
                  {!lista.length && <p className="px-3 py-2 text-xs text-ink-400">Nenhum item ainda.</p>}
                  <ul className="divide-y divide-border">
                    {lista.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                        {grupo === "vidros" && !i.img ? (
                          <DesenhoVidro material={i.material} vidro={i.vidro ?? {}} tam="h-10 w-14" />
                        ) : (
                          <Miniatura img={i.img} assinadas={assinadas} tam="h-10 w-10" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-ink-400">
                            {i.material}
                            {i.qtd > 1 && <span className="ml-2 rounded bg-surface-subtle px-1.5 text-primaryDark">{i.qtd} un.</span>}
                          </div>
                          <div className={`text-sm ${i.referencia ? "text-ink-900" : "italic text-ink-400"}`}>{i.referencia || "Falta definir o modelo"}</div>
                          {g.medidas && i.medidas && <div className="whitespace-pre-line text-xs text-ink-500">{i.medidas}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Lista de ambientes do lazer do prédio: os padrões marcáveis e os criados pela arquitetura. */
function FormLazer({ predioId, inicial, onFechar }: { predioId: string; inicial: string[] | null; onFechar: () => void }) {
  const router = useRouter();
  const base = inicial ?? AMBIENTES_LAZER;
  const extras = (inicial ?? []).filter((a) => !AMBIENTES_LAZER.some((p) => fold(p) === fold(a)));
  const [opcoes, setOpcoes] = useState<string[]>([...AMBIENTES_LAZER, ...extras]);
  const [marcados, setMarcados] = useState<string[]>(base);
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const marcado = (a: string) => marcados.some((m) => fold(m) === fold(a));

  function criar() {
    const nome = tituloAmbiente(novo);
    if (!nome) return;
    setNovo("");
    if (!opcoes.some((o) => fold(o) === fold(nome))) setOpcoes((o) => [...o, nome]);
    if (!marcado(nome)) setMarcados((m) => [...m, nome]);
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const lista = opcoes.filter(marcado);
      const id = await salvarLazer(predioId, lista);
      if (!inicial) router.push(`/arquitetura/especificacoes/${id}`);
      else {
        onFechar();
        router.refresh();
      }
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-primaryDark"><Trees className="h-4 w-4 text-success" /> Lazer do prédio</h2>
        <p className="text-sm text-ink-500">Marque os ambientes de lazer que este prédio tem. Dá para criar outros.</p>
      </div>
      {erro && <div className={erroCls}>{erro}</div>}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((a) => (
          <label key={a} className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-1.5 text-sm ${marcado(a) ? "border-primary bg-[#e8f1f3] text-primaryDark" : "border-border text-ink-600"}`}>
            <input
              type="checkbox"
              className="accent-[#1c474f]"
              checked={marcado(a)}
              onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, a] : m.filter((x) => fold(x) !== fold(a))))}
            />
            {a}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className={rotulo}>Novo ambiente de lazer</span>
          <input
            className={campo}
            placeholder="Ex.: Espaço Gourmet, Sauna, Quadra"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), criar())}
          />
        </label>
        <button type="button" className={btnSec} onClick={criar} disabled={!novo.trim()}>
          <Plus className="h-4 w-4" /> Criar ambiente
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btnPrim} onClick={salvar} disabled={salvando || !opcoes.some(marcado)}>
          {salvando ? "Salvando…" : inicial ? "Salvar ambientes" : "Criar lazer"}
        </button>
        <button type="button" className={btnSec} onClick={onFechar}>Cancelar</button>
      </div>
    </div>
  );
}
