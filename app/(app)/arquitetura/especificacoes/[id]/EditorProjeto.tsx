"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";
import Selecao from "@/components/ui/Selecao";
import {
  AMBIENTES_SUGERIDOS, GRUPOS, VID, descVidro, fold, medidasVidro, refDoModelo, tituloAmbiente, type Grupo, type Vidro,
} from "@/lib/especificacoes/regras";
import { excluirItem, moverItem, renomearAmbiente, salvarItem, salvarNota } from "../../actions";
import { FotoCampo, Janela, Miniatura, SeletorModelo, type Modelo } from "../../comum";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../../ui";

export type Item = {
  id: string; grupo: Grupo; ambiente: string; material: string; referencia: string; medidas: string; qtd: number; img: string; ordem: number; vidro: Vidro | null;
};
export type Nota = { grupo: Grupo; obs: string; rev: string };
type Projeto = { id: string; codigo: string | null; titulo: string; cliente: string | null };
type Rascunho = Omit<Item, "id" | "ordem"> & { id?: string };

export default function EditorProjeto({
  projeto, itens, notas, modelos, assinadas, grupoInicial,
}: { projeto: Projeto; itens: Item[]; notas: Nota[]; modelos: Modelo[]; assinadas: Record<string, string>; grupoInicial: Grupo }) {
  const router = useRouter();
  const [grupo, setGrupoState] = useState<Grupo>(grupoInicial);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [novosAmbientes, setNovosAmbientes] = useState<Record<string, string[]>>({});
  const [novoAmb, setNovoAmb] = useState("");
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
    for (const a of novosAmbientes[grupo] ?? []) if (!mapa.has(a)) mapa.set(a, []);
    return Array.from(mapa.entries());
  }, [itens, grupo, novosAmbientes]);

  const contagem = (x: Grupo) => itens.filter((i) => i.grupo === x).length;
  const nota = notas.find((n) => n.grupo === grupo) ?? { grupo, obs: "", rev: "R0" };

  function adicionarAmbiente() {
    const nome = tituloAmbiente(novoAmb);
    if (!nome) return;
    if (!ambientes.some(([a]) => fold(a) === fold(nome))) setNovosAmbientes((m) => ({ ...m, [grupo]: [...(m[grupo] ?? []), nome] }));
    setNovoAmb("");
    novoItem(ambientes.find(([a]) => fold(a) === fold(nome))?.[0] ?? nome);
  }

  function novoItem(ambiente: string) {
    setRascunho({ grupo, ambiente, material: grupo === "vidros" ? "BOX DE BANHO" : "", referencia: "", medidas: "", qtd: 1, img: "", vidro: grupo === "vidros" ? {} : null });
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
      if ((ambientes.find(([a]) => a === de)?.[1].length ?? 0) > 0) await renomearAmbiente(projeto.id, grupo, de, para);
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
          <h1 className="text-lg font-semibold text-primaryDark">
            {projeto.codigo && <span className="mr-2 text-ink-400">{projeto.codigo}</span>}
            {projeto.titulo}
          </h1>
          {projeto.cliente && <p className="text-sm text-ink-500">{projeto.cliente}</p>}
        </div>
        <Link href="/arquitetura/catalogo" className={btnSec}>
          <BookOpen className="h-4 w-4" /> Catálogo de modelos
        </Link>
      </div>

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

      {erro && <div className={erroCls}>{erro}</div>}

      <NotaGrupo key={grupo + nota.rev + nota.obs} projetoId={projeto.id} grupo={grupo} titulo={g.titulo} nota={nota} />

      {ambientes.map(([amb, lista]) => (
        <div key={amb} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <h2 className="font-semibold text-primaryDark">{amb}</h2>
              <button type="button" className={btnIcone} title="Renomear ambiente" onClick={() => renomear(amb)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <button type="button" className={btnSec} onClick={() => novoItem(amb)}>
              <Plus className="h-4 w-4" /> Item
            </button>
          </div>
          {!lista.length && <p className="text-sm text-ink-500">Nenhum item ainda.</p>}
          <ul className="divide-y divide-border">
            {lista.map((i, k) => (
              <li key={i.id} className="flex items-start gap-3 py-2">
                <Miniatura img={i.img} assinadas={assinadas} tam="h-14 w-14" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRascunho({ ...i })}>
                  <div className="text-[11px] font-semibold text-ink-400">
                    {i.material}
                    {i.qtd > 1 && <span className="ml-2 rounded bg-surface-subtle px-1.5 text-primaryDark">{i.qtd} un.</span>}
                  </div>
                  <div className={`text-sm ${i.referencia ? "text-ink-900" : "italic text-ink-400"}`}>{i.referencia || "Falta definir o modelo"}</div>
                  {g.medidas && i.medidas && <div className="whitespace-pre-line text-xs text-ink-500">{i.medidas}</div>}
                </button>
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
      </div>

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
        />
      )}
    </div>
  );
}

function NotaGrupo({ projetoId, grupo, titulo, nota }: { projetoId: string; grupo: Grupo; titulo: string; nota: Nota }) {
  const router = useRouter();
  const [obs, setObs] = useState(nota.obs);
  const [rev, setRev] = useState(nota.rev);
  const [estado, setEstado] = useState<string | null>(null);
  const mudou = obs !== nota.obs || rev !== nota.rev;
  return (
    <div className="card grid gap-3 sm:grid-cols-[1fr_110px_auto] sm:items-end">
      <label>
        <span className={rotulo}>Observações da folha · {titulo}</span>
        <textarea className={campo} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Atenção: BASE DOCOL em todos os ambientes." />
      </label>
      <label>
        <span className={rotulo}>Revisão</span>
        <input className={campo} value={rev} onChange={(e) => setRev(e.target.value.toUpperCase())} placeholder="R0" />
      </label>
      <button
        type="button"
        className={btnSec}
        disabled={!mudou || estado === "…"}
        onClick={async () => {
          setEstado("…");
          try {
            await salvarNota(projetoId, grupo, { obs, rev });
            setEstado(null);
            router.refresh();
          } catch (e: any) {
            setEstado(e.message);
          }
        }}
      >
        {estado === "…" ? "Salvando…" : "Salvar"}
      </button>
      {estado && estado !== "…" && <p className="text-xs text-danger sm:col-span-3">{estado}</p>}
    </div>
  );
}

function FormItem({
  projetoId, inicial, modelos, assinadas, ambientes, onFechar, onSalvo,
}: {
  projetoId: string; inicial: Rascunho; modelos: Modelo[]; assinadas: Record<string, string>; ambientes: string[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const [d, setD] = useState<Rascunho>(inicial);
  const [escolhendo, setEscolhendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const g = GRUPOS.find((x) => x.id === d.grupo)!;
  const vidros = d.grupo === "vidros";
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

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await salvarItem({ ...d, projeto_id: projetoId });
      onSalvo();
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
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
            <label>
              <span className={rotulo}>Ambiente *</span>
              <input className={campo} list="esp-amb-form" value={d.ambiente} onChange={(e) => setD({ ...d, ambiente: e.target.value })} />
              <datalist id="esp-amb-form">
                {Array.from(new Set([...ambientes, ...AMBIENTES_SUGERIDOS])).map((a) => <option key={a} value={a} />)}
              </datalist>
            </label>
            <label>
              <span className={rotulo}>{vidros ? "Tipo *" : "Item *"}</span>
              <input className={campo} list="esp-mat-form" value={d.material} placeholder={vidros ? "BOX DE BANHO" : "TORNEIRA"} onChange={(e) => setD({ ...d, material: e.target.value.toUpperCase() })} />
              <datalist id="esp-mat-form">
                {materiais.map((m) => <option key={m} value={m} />)}
              </datalist>
            </label>
            <label>
              <span className={rotulo}>Qtd.</span>
              <input className={campo} type="number" min={1} value={d.qtd} onChange={(e) => setD({ ...d, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </label>
          </div>

          {vidros ? (
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
              <div className="rounded-[10px] bg-surface-subtle p-3 text-sm">
                <div className={rotulo}>Como sai na folha</div>
                <div className="text-ink-900">{descVidro(d.material, v)}</div>
                <div className="whitespace-pre-line text-xs text-ink-500">{medidasVidro(v)}</div>
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
            <span className={rotulo}>Foto</span>
            <FotoCampo valor={d.img} onChange={(img) => setD({ ...d, img })} assinadas={assinadas} />
          </div>

          {erro && <div className={erroCls}>{erro}</div>}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className={btnSec} onClick={onFechar}>Cancelar</button>
            <button type="button" className={btnPrim} onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      )}
    </Janela>
  );
}
