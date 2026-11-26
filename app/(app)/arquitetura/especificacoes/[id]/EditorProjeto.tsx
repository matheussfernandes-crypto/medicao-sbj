"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Building2, ChevronDown, FileText, ListChecks, Pencil, Plus, Trash2, Trees, Type } from "lucide-react";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";
import Selecao from "@/components/ui/Selecao";
import {
  AMBIENTES_LAZER, AMBIENTES_SUGERIDOS, GRUPOS, GRUPOS_ARQ, VID, descVidro, ehInterior, fold, medidasVidro, refDoModelo, temQtd, tituloAmbiente, type Grupo, type Vidro,
} from "@/lib/especificacoes/regras";
import { gerarInterior } from "@/lib/especificacoes/interiores";
import { CamposInterior, DesenhoInterior, FaltaPreencher, PreviaInterior, herdarParede } from "./FormInteriores";
import { sugestoesDoAmbiente } from "@/lib/especificacoes/texto";
import {
  adicionarAmbienteLazer, criarItens, excluirAmbiente, excluirItem, moverItem, removerAmbienteLazer, renomearAmbiente, salvarItem, salvarNota,
} from "../../actions";
import { DesenhoVidro, FotoCampo, Janela, Miniatura, SeletorModelo, type Modelo } from "../../comum";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../../ui";
import TextoLivre from "./TextoLivre";

export type Item = {
  id: string; grupo: Grupo; ambiente: string; material: string; referencia: string; medidas: string; qtd: number; img: string; ordem: number; vidro: Vidro | null;
  campos: Record<string, unknown> | null;
};
export type Nota = { grupo: Grupo; obs: string; rev: string; papel: string };
type Projeto = {
  id: string; codigo: string | null; titulo: string; cliente: string | null; unidade: string | null;
  obraId: string | null; predio: string | null; lazer: boolean; ambientesLazer: string[];
};
type Escolha = { ambiente: string; existente: boolean; itens: { n: string; on: boolean }[] };
type Rascunho = Omit<Item, "id" | "ordem"> & { id?: string };

export default function EditorProjeto({
  projeto, itens, notas, modelos, assinadas, grupoInicial,
}: { projeto: Projeto; itens: Item[]; notas: Nota[]; modelos: Modelo[]; assinadas: Record<string, string>; grupoInicial: Grupo }) {
  const router = useRouter();
  const [grupo, setGrupoState] = useState<Grupo>(grupoInicial);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [novosAmbientes, setNovosAmbientes] = useState<Record<string, string[]>>({});
  const [novoAmb, setNovoAmb] = useState("");
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [texto, setTexto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const g = GRUPOS.find((x) => x.id === grupo)!;

  function setGrupo(x: Grupo) {
    setGrupoState(x);
    window.history.replaceState(null, "", `?grupo=${x}`);
  }

  // ambientes na ordem em que aparecem (pela ordem do primeiro item), mais os criados agora e ainda vazios
  const ambientes = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const i of itens.filter((i) => i.grupo === grupo).sort((a, b) => a.ordem - b.ordem)) {
      const k = i.ambiente || "Sem ambiente";
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(i);
    }
    // lazer: a lista de ambientes do prédio aparece em todos os grupos, mesmo sem item
    const extras = [...(projeto.lazer ? projeto.ambientesLazer : []), ...(novosAmbientes[grupo] ?? [])];
    for (const a of extras) if (!Array.from(mapa.keys()).some((k) => fold(k) === fold(a))) mapa.set(a, []);
    return Array.from(mapa.entries());
  }, [itens, grupo, novosAmbientes, projeto.lazer, projeto.ambientesLazer]);
  const faltamLazer = projeto.lazer ? AMBIENTES_LAZER.filter((a) => !ambientes.some(([k]) => fold(k) === fold(a))) : [];

  const contagem = (x: Grupo) => itens.filter((i) => i.grupo === x).length;
  const nota = notas.find((n) => n.grupo === grupo) ?? { grupo, obs: "", rev: "R0", papel: "a3p" };

  // ambiente novo: abre a lista de itens que costumam existir nele (a pessoa marca o que quiser)
  function adicionarAmbiente() {
    const nome = tituloAmbiente(novoAmb);
    if (!nome) return;
    setNovoAmb("");
    const existente = ambientes.find(([a]) => fold(a) === fold(nome))?.[0];
    abrirSugestoes(existente ?? nome, !!existente);
  }

  function abrirSugestoes(ambiente: string, existente: boolean) {
    const ja = existente ? itens.filter((i) => i.grupo === grupo && fold(i.ambiente) === fold(ambiente)).map((i) => fold(i.material)) : [];
    const lista = sugestoesDoAmbiente(grupo, ambiente).filter((m) => !ja.includes(fold(m)));
    setEscolha({ ambiente, existente, itens: lista.map((n) => ({ n, on: true })) });
  }

  async function gravarEscolha(e: Escolha) {
    const marcados = e.itens.filter((x) => x.on).map((x) => ({ ambiente: e.ambiente, material: x.n }));
    try {
      if (projeto.lazer && !e.existente) await adicionarAmbienteLazer(projeto.id, e.ambiente);
      if (marcados.length) await criarItens(projeto.id, grupo, marcados);
      else if (!e.existente) setNovosAmbientes((m) => ({ ...m, [grupo]: [...(m[grupo] ?? []), e.ambiente] }));
      setEscolha(null);
      router.refresh();
    } catch (er: any) {
      setErro(er.message);
    }
  }

  async function apagarAmbiente(amb: string, qtd: number) {
    if (qtd) {
      const ok = await pedirConfirmacao({ texto: `Remover "${amb}" e os ${qtd} item(ns) dele?`, botao: "Remover" });
      if (!ok) return;
      try {
        await excluirAmbiente(projeto.id, grupo, amb);
      } catch (e: any) {
        return setErro(e.message);
      }
    } else if (projeto.lazer) {
      const ok = await pedirConfirmacao({ texto: `Tirar "${amb}" da lista de lazer deste prédio?`, botao: "Tirar" });
      if (!ok) return;
      try {
        await removerAmbienteLazer(projeto.id, amb);
      } catch (e: any) {
        return setErro(e.message);
      }
    }
    setNovosAmbientes((m) => ({ ...m, [grupo]: (m[grupo] ?? []).filter((a) => a !== amb) }));
    router.refresh();
  }

  function novoItem(ambiente: string) {
    setRascunho({ grupo, ambiente, material: grupo === "vidros" ? "BOX DE BANHO" : "", referencia: "", medidas: "", qtd: 1, img: "", vidro: grupo === "vidros" ? {} : null, campos: ehInterior(grupo) ? {} : null });
  }

  // "+ Outra parede com este produto": mesmo ambiente, herda material, produto, rodapé e altura
  function outraParede(de: { ambiente: string; material: string; campos: Record<string, unknown> | null }) {
    const novo: Rascunho = { grupo: "revestimentos", ambiente: de.ambiente, material: de.material, referencia: "", medidas: "", qtd: 1, img: "", vidro: null, campos: herdarParede(de.campos) };
    setRascunho(null);
    setTimeout(() => setRascunho(novo), 0); // reabre o formulário do zero
  }

  async function apagar(i: Item) {
    const ok = await pedirConfirmacao({ texto: `Excluir ${i.material} de ${i.ambiente}?`, botao: "Excluir" });
    if (!ok) return;
    try {
      await excluirItem(i.id, projeto.id);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function mover(lista: Item[], k: number, dir: -1 | 1) {
    const a = lista[k], b = lista[k + dir];
    if (!a || !b) return;
    try {
      await moverItem(projeto.id, { id: a.id, ordem: a.ordem }, { id: b.id, ordem: b.ordem });
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function renomear(de: string) {
    const para = window.prompt("Novo nome do ambiente:", de);
    if (!para || tituloAmbiente(para) === de) return;
    try {
      if (projeto.lazer || (ambientes.find(([a]) => a === de)?.[1].length ?? 0) > 0) await renomearAmbiente(projeto.id, grupo, de, para);
      setNovosAmbientes((m) => ({ ...m, [grupo]: (m[grupo] ?? []).map((a) => (a === de ? tituloAmbiente(para) : a)) }));
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/arquitetura/especificacoes" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Especificações
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primaryDark">
            {projeto.lazer && <Trees className="h-5 w-5 text-success" />}
            {projeto.codigo && <span className="text-ink-400">{projeto.codigo}</span>}
            {projeto.lazer ? `Lazer · ${projeto.predio ?? ""}` : projeto.titulo}
          </h1>
          {projeto.cliente && <p className="text-sm text-ink-500">{projeto.cliente}</p>}
          {!projeto.lazer && (
            <p className="text-xs text-ink-400">
              {projeto.predio ? `Prédio: ${projeto.predio}` : "Fora da SBJ"} ·{" "}
              {projeto.unidade ? `Unidade SBJ: ${projeto.unidade}` : "sem unidade da SBJ ligada (edite o projeto na lista)"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {projeto.obraId && (
            <Link href={`/arquitetura/especificacoes/predio/${projeto.obraId}?grupo=${grupo}`} className={btnSec}>
              <Building2 className="h-4 w-4" /> Ver prédio
            </Link>
          )}
          <Link href="/arquitetura/catalogo" className={btnSec}>
            <BookOpen className="h-4 w-4" /> Catálogo de modelos
          </Link>
        </div>
      </div>

      {projeto.lazer && (
        <div className="card space-y-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-primaryDark"><Trees className="h-4 w-4 text-success" /> Ambientes de lazer · {projeto.predio}</h2>
            <p className="text-xs text-ink-500">Clique para acrescentar um ambiente neste prédio, ou crie um novo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ambientes.map(([a]) => (
              <span key={a} className="inline-flex items-center rounded-full border border-primary bg-[#e8f1f3] px-3 py-1 text-xs font-semibold text-primaryDark">{a}</span>
            ))}
            {faltamLazer.map((a) => (
              <button key={a} type="button" className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-ink-600 hover:border-primary hover:text-primary" onClick={() => abrirSugestoes(a, false)}>
                <Plus className="h-3 w-3" /> {a}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] max-w-md flex-1">
              <span className={rotulo}>Novo ambiente de lazer</span>
              <input
                className={campo}
                list="esp-ambientes-lazer"
                placeholder="Ex.: Espaço Gourmet, Sauna, Quadra"
                value={novoAmb}
                onChange={(e) => setNovoAmb(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarAmbiente())}
              />
              <datalist id="esp-ambientes-lazer">
                {AMBIENTES_LAZER.map((a) => <option key={a} value={a} />)}
              </datalist>
            </label>
            <button type="button" className={btnPrim} onClick={adicionarAmbiente} disabled={!novoAmb.trim()}>
              <Plus className="h-4 w-4" /> Criar ambiente
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {GRUPOS_ARQ.map((x) => (
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

      {erro && <div className={erroCls}>{erro}</div>}

      <NotaGrupo key={grupo + nota.rev + nota.obs + nota.papel} projetoId={projeto.id} grupo={grupo} titulo={g.titulo} nota={nota} />

      {ambientes.map(([amb, lista]) => (
        <div key={amb} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <h2 className="font-semibold text-primaryDark">{amb}</h2>
              <button type="button" className={btnIcone} title="Renomear ambiente" onClick={() => renomear(amb)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {!ehInterior(grupo) && (
                <button type="button" className={btnSec} onClick={() => abrirSugestoes(amb, true)} title="Itens que costumam existir neste ambiente">
                  <ListChecks className="h-4 w-4" /> Sugeridos
                </button>
              )}
              <button type="button" className={btnSec} onClick={() => novoItem(amb)}>
                <Plus className="h-4 w-4" /> Item
              </button>
              <button type="button" className={btnIcone} title="Remover ambiente" onClick={() => apagarAmbiente(amb, lista.length)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!lista.length && <p className="text-sm text-ink-500">Nenhum item ainda.</p>}
          <ul className="divide-y divide-border">
            {lista.map((i, k) => (
              <li key={i.id} className="flex items-start gap-3 py-2">
                {grupo === "vidros" && !i.img ? (
                  <DesenhoVidro material={i.material} vidro={i.vidro ?? {}} tam="h-16 w-24" />
                ) : ehInterior(grupo) && !i.img ? (
                  <DesenhoInterior grupo={grupo} campos={i.campos ?? {}} tam="h-20 w-28" />
                ) : (
                  <Miniatura img={i.img} assinadas={assinadas} tam="h-14 w-14" />
                )}
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRascunho({ ...i })}>
                  <div className="text-[11px] font-semibold text-ink-400">
                    {i.material}
                    {i.qtd > 1 && temQtd(grupo) && <span className="ml-2 rounded bg-surface-subtle px-1.5 text-primaryDark">{i.qtd} un.</span>}
                  </div>
                  <div className={`text-sm ${i.referencia ? "text-ink-900" : "italic text-ink-400"}`}>{i.referencia || "Falta definir o modelo"}</div>
                  {g.medidas && i.medidas && <div className="whitespace-pre-line text-xs text-ink-500">{i.medidas}</div>}
                  {ehInterior(grupo) && <FaltaPreencher falta={gerarInterior(grupo, i.campos ?? {}).falta} />}
                </button>
                {grupo === "revestimentos" && (
                  <button type="button" className="shrink-0 self-center whitespace-nowrap rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-ink-600 hover:border-primary hover:text-primary" onClick={() => outraParede(i)} title="Nova parede no mesmo ambiente, com o mesmo material, produto, rodapé e altura">
                    + Outra parede com este produto
                  </button>
                )}
                <div className="flex shrink-0 items-center">
                  <button type="button" className={btnIcone} title="Subir" disabled={k === 0} onClick={() => mover(lista, k, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className={btnIcone} title="Descer" disabled={k === lista.length - 1} onClick={() => mover(lista, k, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" className={btnIcone} title="Editar" onClick={() => setRascunho({ ...i })}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={btnIcone} title="Excluir" onClick={() => apagar(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="card flex flex-wrap items-end gap-2">
        {!projeto.lazer && (
          <>
            <label className="min-w-[220px] flex-1">
              <span className={rotulo}>Novo ambiente</span>
              <input
                className={campo}
                list="esp-ambientes"
                placeholder="Ex.: BWC Suíte, Cozinha, Lavabo"
                value={novoAmb}
                onChange={(e) => setNovoAmb(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarAmbiente())}
              />
              <datalist id="esp-ambientes">
                {AMBIENTES_SUGERIDOS.map((a) => <option key={a} value={a} />)}
              </datalist>
            </label>
            <button type="button" className={btnPrim} onClick={adicionarAmbiente} disabled={!novoAmb.trim()}>
              <Plus className="h-4 w-4" /> Adicionar ambiente
            </button>
          </>
        )}
        {!ehInterior(grupo) && (
          <button type="button" className={btnSec} onClick={() => setTexto((x) => !x)}>
            <Type className="h-4 w-4" /> Adicionar por texto
          </button>
        )}
      </div>

      {texto && !ehInterior(grupo) && (
        <TextoLivre
          key={grupo}
          projetoId={projeto.id}
          grupo={grupo}
          ambientes={ambientes.map(([a]) => a)}
          onFechar={() => setTexto(false)}
          onGravado={() => {
            setTexto(false);
            router.refresh();
          }}
        />
      )}

      {escolha && (
        <Janela titulo={`${escolha.existente ? "Itens sugeridos" : "Novo ambiente"} · ${escolha.ambiente}`} onFechar={() => setEscolha(null)} largura="max-w-md">
          <EscolhaItens inicial={escolha} onCancelar={() => setEscolha(null)} onGravar={gravarEscolha} />
        </Janela>
      )}

      {rascunho && (
        <FormItem
          projetoId={projeto.id}
          inicial={rascunho}
          modelos={modelos}
          assinadas={assinadas}
          ambientes={ambientes.map(([a]) => a)}
          onFechar={() => setRascunho(null)}
          onSalvo={() => {
            setRascunho(null);
            router.refresh();
          }}
          onOutra={(d) => {
            router.refresh();
            outraParede(d);
          }}
        />
      )}
    </div>
  );
}

function NotaGrupo({ projetoId, grupo, titulo, nota }: { projetoId: string; grupo: Grupo; titulo: string; nota: Nota }) {
  const router = useRouter();
  const [obs, setObs] = useState(nota.obs);
  const [rev, setRev] = useState(nota.rev);
  const [papel, setPapel] = useState(nota.papel === "a4p" ? "a4p" : "a3p");
  const [estado, setEstado] = useState<string | null>(null);
  const mudou = obs !== nota.obs || rev !== nota.rev || papel !== (nota.papel === "a4p" ? "a4p" : "a3p");
  const [aberto, setAberto] = useState(false);
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
          <span className="font-semibold text-primaryDark">Observações da folha</span>
          <span className="truncate text-xs text-ink-500">
            Revisão {nota.rev || "R0"} · {nota.papel === "a4p" ? "A4" : "A3"} paisagem{nota.obs ? ` · ${nota.obs}` : ""}
          </span>
        </button>
        <a
          className={btnPrim + (mudou ? " pointer-events-none opacity-50" : "")}
          href={`/imprimir/especificacoes/${projetoId}?grupo=${grupo}`}
          target="_blank"
          rel="noopener"
          title={mudou ? "Salve antes de gerar o PDF" : "Abre a folha no padrão SBJ para imprimir ou salvar em PDF"}
        >
          <FileText className="h-4 w-4" /> Gerar PDF
        </a>
      </div>
      {aberto && (
    <div className="grid gap-3 sm:grid-cols-[1fr_90px_150px_auto] sm:items-end">
      <label>
        <span className={rotulo}>Observações da folha · {titulo}</span>
        <textarea className={campo} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Atenção: BASE DOCOL em todos os ambientes." />
      </label>
      <label>
        <span className={rotulo}>Revisão</span>
        <input className={campo} value={rev} onChange={(e) => setRev(e.target.value.toUpperCase())} placeholder="R0" />
      </label>
      <label>
        <span className={rotulo}>Papel do PDF</span>
        <Selecao className="w-full" value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="a3p">A3 paisagem</option>
          <option value="a4p">A4 paisagem</option>
        </Selecao>
      </label>
      <button
        type="button"
        className={btnSec}
        disabled={!mudou || estado === "…"}
        onClick={async () => {
          setEstado("…");
          try {
            await salvarNota(projetoId, grupo, { obs, rev, papel });
            setEstado(null);
            router.refresh();
          } catch (e: any) {
            setEstado(e.message);
          }
        }}
      >
        {estado === "…" ? "Salvando…" : "Salvar"}
      </button>
      {estado && estado !== "…" && <p className="text-xs text-danger sm:col-span-4">{estado}</p>}
    </div>
      )}
    </div>
  );
}

function FormItem({
  projetoId, inicial, modelos, assinadas, ambientes, onFechar, onSalvo, onOutra,
}: {
  projetoId: string; inicial: Rascunho; modelos: Modelo[]; assinadas: Record<string, string>; ambientes: string[];
  onFechar: () => void; onSalvo: () => void; onOutra?: (d: Rascunho) => void;
}) {
  const [d, setD] = useState<Rascunho>(inicial);
  const [escolhendo, setEscolhendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const g = GRUPOS.find((x) => x.id === d.grupo)!;
  const vidros = d.grupo === "vidros";
  const interior = ehInterior(d.grupo) ? d.grupo : null;
  const v = d.vidro ?? {};
  const setV = (p: Partial<Vidro>) => setD((x) => ({ ...x, vidro: { ...(x.vidro ?? {}), ...p } }));
  const materiais = useMemo(
    () => Array.from(new Set([...(vidros ? VID.tipos.map((t) => t.toUpperCase()) : []), ...modelos.filter((m) => m.grupo === d.grupo).map((m) => m.material)])).sort(),
    [modelos, d.grupo, vidros]
  );

  function escolher(m: Modelo) {
    setD((x) => ({ ...x, material: m.material || x.material, referencia: refDoModelo(m.referencia, m.marca), medidas: m.medidas || x.medidas, img: m.img || x.img }));
    setEscolhendo(false);
  }

  async function salvar(eOutra = false) {
    setErro(null);
    setSalvando(true);
    try {
      await salvarItem({ ...d, projeto_id: projetoId });
      if (eOutra && onOutra) onOutra(d);
      else onSalvo();
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  const sel = (k: keyof Vidro, opcoes: string[], rotuloTxt: string) => (
    <label>
      <span className={rotulo}>{rotuloTxt}</span>
      <Selecao className="w-full" value={String(v[k] ?? "")} onChange={(e) => setV({ [k]: e.target.value } as Partial<Vidro>)}>
        <option value="">—</option>
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </Selecao>
    </label>
  );

  return (
    <Janela titulo={`${d.id ? "Editar" : "Novo"} item · ${g.curto}`} onFechar={onFechar}>
      {escolhendo ? (
        <div className="space-y-3">
          <SeletorModelo modelos={modelos} grupo={d.grupo} material={d.material} assinadas={assinadas} onEscolher={escolher} />
          <button type="button" className={btnSec} onClick={() => setEscolhendo(false)}>Voltar</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`grid gap-3 ${interior ? (temQtd(d.grupo) ? "sm:grid-cols-[1fr_90px]" : "") : "sm:grid-cols-[1fr_1fr_90px]"}`}>
            <label>
              <span className={rotulo}>Ambiente *</span>
              <input className={campo} list="esp-amb-form" value={d.ambiente} onChange={(e) => setD({ ...d, ambiente: e.target.value })} />
              <datalist id="esp-amb-form">
                {Array.from(new Set([...ambientes, ...AMBIENTES_SUGERIDOS])).map((a) => <option key={a} value={a} />)}
              </datalist>
            </label>
            {!interior && (
            <label>
              <span className={rotulo}>{vidros ? "Tipo *" : "Item *"}</span>
              <input className={campo} list="esp-mat-form" value={d.material} placeholder={vidros ? "BOX DE BANHO" : "TORNEIRA"} onChange={(e) => setD({ ...d, material: e.target.value.toUpperCase() })} />
              <datalist id="esp-mat-form">
                {materiais.map((m) => <option key={m} value={m} />)}
              </datalist>
            </label>
            )}
            {temQtd(d.grupo) && (
            <label>
              <span className={rotulo}>Qtd.</span>
              <input className={campo} type="number" min={1} value={d.qtd} onChange={(e) => setD({ ...d, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </label>
            )}
          </div>

          {interior ? (
            <>
              <CamposInterior grupo={interior} valor={d.campos ?? {}} onChange={(campos) => setD((x) => ({ ...x, campos }))} />
              <PreviaInterior grupo={interior} campos={d.campos ?? {}} comImagem={!!d.img} />
            </>
          ) : vidros ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={rotulo}>Altura (cm)</span>
                  <input className={campo} inputMode="decimal" value={v.altura ?? ""} onChange={(e) => setV({ altura: e.target.value })} />
                </label>
                <label>
                  <span className={rotulo}>Largura (cm)</span>
                  <input className={campo} inputMode="decimal" value={v.largura ?? ""} onChange={(e) => setV({ largura: e.target.value })} />
                </label>
                <label className="flex items-center gap-2 pt-5 text-sm text-ink-700">
                  <input type="checkbox" checked={!!v.ateTeto} onChange={(e) => setV({ ateTeto: e.target.checked })} /> Até o teto
                </label>
                {sel("perfil", VID.perfis, "Perfil")}
                {sel("vidro", VID.vidros, "Vidro")}
                {sel("puxador", VID.puxadores, "Puxador")}
                <label>
                  <span className={rotulo}>Folhas</span>
                  <input className={campo} type="number" min={0} value={v.folhas ?? ""} onChange={(e) => setV({ folhas: parseInt(e.target.value, 10) || undefined })} />
                </label>
                <label>
                  <span className={rotulo}>De correr</span>
                  <input className={campo} type="number" min={0} value={v.correr ?? ""} onChange={(e) => setV({ correr: parseInt(e.target.value, 10) || undefined })} />
                </label>
                {sel("sistema", VID.sistemas, "Sistema")}
              </div>
              <label className="block">
                <span className={rotulo}>Observação (entra no fim da descrição)</span>
                <input className={campo} value={v.obs ?? ""} onChange={(e) => setV({ obs: e.target.value })} />
              </label>
              <div className="flex gap-3 rounded-[10px] bg-surface-subtle p-3 text-sm">
                {!d.img && <DesenhoVidro material={d.material} vidro={v} tam="h-24 w-36" />}
                <div className="min-w-0">
                  <div className={rotulo}>Como sai na folha</div>
                  <div className="text-ink-900">{descVidro(d.material, v)}</div>
                  <div className="whitespace-pre-line text-xs text-ink-500">{medidasVidro(v)}</div>
                  {!d.img && <div className="mt-1 text-[11px] text-ink-400">Desenho automático. Envie uma foto abaixo para trocar.</div>}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={rotulo}>Referência (modelo)</span>
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setEscolhendo(true)}>
                    Escolher do catálogo
                  </button>
                </div>
                <textarea className={campo} rows={2} value={d.referencia} onChange={(e) => setD({ ...d, referencia: e.target.value })} />
              </div>
              {g.medidas && (
                <label className="block">
                  <span className={rotulo}>Medidas</span>
                  <textarea className={campo} rows={3} value={d.medidas} placeholder={"Altura: \nLargura: \nProfundidade: "} onChange={(e) => setD({ ...d, medidas: e.target.value })} />
                </label>
              )}
            </>
          )}

          <div>
            <span className={rotulo}>{interior ? "Imagem (substitui o desenho automático)" : "Foto"}</span>
            <FotoCampo valor={d.img} onChange={(img) => setD({ ...d, img })} assinadas={assinadas} />
          </div>

          {erro && <div className={erroCls}>{erro}</div>}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className={btnSec} onClick={onFechar}>Cancelar</button>
            {d.grupo === "revestimentos" && onOutra && (
              <button type="button" className={btnSec} onClick={() => salvar(true)} disabled={salvando}>Salvar e + outra parede com este produto</button>
            )}
            <button type="button" className={btnPrim} onClick={() => salvar()} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      )}
    </Janela>
  );
}

function EscolhaItens({ inicial, onCancelar, onGravar }: { inicial: Escolha; onCancelar: () => void; onGravar: (e: Escolha) => Promise<void> }) {
  const [e, setE] = useState(inicial);
  const [extra, setExtra] = useState("");
  const [gravando, setGravando] = useState(false);
  const marcados = e.itens.filter((x) => x.on).length;
  function incluir() {
    const n = extra.trim();
    if (!n) return;
    setE({ ...e, itens: [...e.itens, { n: n.charAt(0).toUpperCase() + n.slice(1), on: true }] });
    setExtra("");
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        {e.itens.length ? "Marque os itens que este ambiente vai ter. Depois é só escolher o modelo de cada um." : "Nenhuma sugestão para este ambiente. Inclua os itens abaixo, se quiser."}
      </p>
      {e.itens.length > 1 && (
        <div className="flex gap-3 text-xs">
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setE({ ...e, itens: e.itens.map((x) => ({ ...x, on: true })) })}>Marcar todos</button>
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setE({ ...e, itens: e.itens.map((x) => ({ ...x, on: false })) })}>Desmarcar todos</button>
        </div>
      )}
      <ul className="space-y-1">
        {e.itens.map((x, k) => (
          <li key={k}>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-surface-subtle">
              <input type="checkbox" checked={x.on} onChange={(ev) => setE({ ...e, itens: e.itens.map((y, j) => (j === k ? { ...y, on: ev.target.checked } : y)) })} />
              {x.n}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className={campo} placeholder="Outro item (ex.: Saboneteira)" value={extra} onChange={(ev) => setExtra(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), incluir())} />
        <button type="button" className={btnSec} onClick={incluir} disabled={!extra.trim()}>Incluir</button>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" className={btnSec} onClick={onCancelar}>Cancelar</button>
        <button
          type="button"
          className={btnPrim}
          disabled={gravando || (e.existente && !marcados)}
          onClick={async () => {
            setGravando(true);
            await onGravar(e);
            setGravando(false);
          }}
        >
          {gravando ? "Gravando…" : marcados ? `Adicionar ${marcados} item(ns)` : "Criar ambiente vazio"}
        </button>
      </div>
    </div>
  );
}
