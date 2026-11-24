"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Building2, ChevronRight, FileText, FileUp, Pencil, Plus, Search, Trash2, Trees } from "lucide-react";
import PainelCadastro from "@/components/ui/PainelCadastro";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";
import { createClient } from "@/lib/supabase/client";
import { converter } from "@/lib/especificacoes/importar";
import { enviarFoto } from "@/lib/especificacoes/imagem";
import { AMBIENTES_LAZER, fold, GRUPOS_ARQ, tituloAmbiente } from "@/lib/especificacoes/regras";
import { FASE_PREDIO, ordemProjeto, type Predio } from "@/lib/especificacoes/predios";
import { rotuloUnidadeSbj, type UnidadeSbj } from "@/lib/especificacoes/unidades";
import Selecao from "@/components/ui/Selecao";
import { excluirProjeto, importarLinhas, salvarLazer, salvarProjeto } from "../actions";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../ui";

export type ProjetoResumo = {
  id: string; codigo: string | null; titulo: string; cliente: string | null; unidade_id: string | null; unidade: string | null;
  obra_id: string | null; tipo: string; ambientes: string[] | null; atualizado_em: string; qtd: Record<string, number>;
};

export default function ListaProjetos({ projetos, unidades, predios }: { projetos: ProjetoResumo[]; unidades: UnidadeSbj[]; predios: Predio[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<ProjetoResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const f = fold(busca);
  const visiveis = projetos.filter((p) => !f || fold(`${p.codigo} ${p.titulo} ${p.cliente}`).includes(f));

  // grupos por prédio: os que têm projeto (ou o escolhido no filtro, mesmo vazio, para criar o lazer); "Fora da SBJ" por último
  const blocos: { predio: Predio | null; lista: ProjetoResumo[] }[] = [];
  for (const pr of predios) {
    if (filtro && filtro !== pr.id) continue;
    const lista = visiveis.filter((p) => p.obra_id === pr.id).sort(ordemProjeto);
    if (lista.length || filtro === pr.id) blocos.push({ predio: pr, lista });
  }
  const fora = visiveis.filter((p) => !p.obra_id || !predios.some((x) => x.id === p.obra_id)).sort(ordemProjeto);
  if (fora.length && (!filtro || filtro === "fora")) blocos.push({ predio: null, lista: fora });

  async function gravar(fd: FormData, id?: string) {
    setErro(null);
    try {
      const novo = await salvarProjeto({
        id, codigo: String(fd.get("codigo") ?? ""), titulo: String(fd.get("titulo") ?? ""), cliente: String(fd.get("cliente") ?? ""),
        unidade_id: String(fd.get("unidade_id") ?? ""), obra_id: String(fd.get("obra_id") ?? ""),
      });
      setEditando(null);
      if (!id) router.push(`/arquitetura/especificacoes/${novo}`);
      else router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function apagar(p: ProjetoResumo) {
    const total = Object.values(p.qtd).reduce((a, b) => a + b, 0);
    const ok = await pedirConfirmacao({
      texto: `Excluir o projeto "${p.titulo}"${total ? ` e os ${total} itens dele` : ""}? Não dá para desfazer.`,
      botao: "Excluir",
    });
    if (!ok) return;
    try {
      await excluirProjeto(p.id);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  // Lê o arquivo "Exportar dados" da Torre FG (ou o catalogo-modelos.json), envia as fotos embutidas e grava.
  async function importar(file: File) {
    setErro(null);
    setAviso(null);
    try {
      setOcupado("Lendo o arquivo…");
      const json = JSON.parse(await file.text());
      const c = converter(json);
      if (!c.projetos.length && !c.modelos.length) throw new Error("O arquivo não tem projetos nem modelos.");
      const supabase = createClient();
      const enviadas = new Map<string, string>();
      const linhas = [...c.itens, ...c.modelos].filter((x) => x.img.startsWith("data:"));
      let n = 0;
      for (const x of linhas) {
        if (!enviadas.has(x.img)) {
          setOcupado(`Enviando fotos… ${++n}`);
          const blob = await (await fetch(x.img)).blob();
          enviadas.set(x.img, await enviarFoto(supabase, blob));
        }
        x.img = enviadas.get(x.img)!;
      }
      setOcupado("Gravando…");
      const r = await importarLinhas({ projetos: c.projetos, itens: c.itens, notas: c.notas, modelos: c.modelos });
      setAviso(
        `Importado: ${r.projetos} projeto(s), ${r.itens} item(ns) e ${r.modelos} modelo(s) do catálogo.` +
          (c.avisos.length ? ` Atenção: ${c.avisos.length} item(ns) ignorado(s).` : "")
      );
      router.refresh();
    } catch (e: any) {
      setErro(e instanceof SyntaxError ? "Esse arquivo não é um JSON válido." : e.message);
    } finally {
      setOcupado(null);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-primaryDark">Especificações</h1>
          <p className="text-sm text-ink-500">Louças e metais, eletros e vidros das áreas de lazer de cada empreendimento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/arquitetura/catalogo" className={btnSec}>
            <BookOpen className="h-4 w-4" /> Catálogo de modelos
          </Link>
          <button type="button" className={btnSec} disabled={!!ocupado} onClick={() => arquivo.current?.click()}>
            <FileUp className="h-4 w-4" /> {ocupado ?? "Importar arquivo da Torre"}
          </button>
          <input ref={arquivo} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </div>
      </div>

      {erro && <div className={erroCls}>{erro}</div>}
      {aviso && <div className="rounded-[10px] border border-[#BFE3CC] bg-[#EAF7EF] px-3 py-2 text-sm text-success">{aviso}</div>}

      <PainelCadastro titulo="Áreas de lazer" rotuloBotao="Nova área de lazer">
        <FormAreaLazer predios={predios} projetos={projetos} predioInicial={filtro && filtro !== "fora" ? filtro : ""} />
      </PainelCadastro>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className={campo + " pl-9"} placeholder="Buscar por código, unidade ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Selecao className="w-full sm:w-72" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos os prédios</option>
          {predios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value="fora">Fora da SBJ</option>
        </Selecao>
      </div>

      {!blocos.length && <div className="card py-6 text-center text-sm text-ink-500">Nenhum projeto{busca ? " encontrado" : " cadastrado"}.</div>}

      {blocos.map(({ predio, lista }) => {
        const lazer = lista.find((p) => p.tipo === "lazer");
        const unid = lista.filter((p) => p.tipo !== "lazer").length;
        return (
          <div key={predio?.id ?? "fora"} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold text-primaryDark">{predio ? predio.nome : "Fora da SBJ"}</h2>
                  <p className="text-xs text-ink-500">
                    {predio?.fase ? `${FASE_PREDIO[predio.fase] ?? predio.fase} · ` : ""}
                    {unid} unidade(s){predio ? ` · ${lazer ? "lazer cadastrado" : "sem lazer"}` : ""}
                  </p>
                </div>
              </div>
              {predio && (
                <div className="flex flex-wrap gap-2">
                  <Link href={lazer ? `/arquitetura/especificacoes/${lazer.id}` : `/arquitetura/especificacoes/predio/${predio.id}?lazer=1`} className={btnSec}>
                    <Trees className="h-4 w-4" /> {lazer ? "Lazer" : "Cadastrar lazer"}
                  </Link>
                  <Link href={`/arquitetura/especificacoes/predio/${predio.id}`} className={btnSec}>
                    <Building2 className="h-4 w-4" /> Ver prédio
                  </Link>
                  {lista.length > 0 && (
                    <a href={`/imprimir/especificacoes/predio/${predio.id}?grupo=todos`} target="_blank" rel="noopener" className={btnPrim}>
                      <FileText className="h-4 w-4" /> PDF do prédio
                    </a>
                  )}
                </div>
              )}
            </div>
            {!lista.length && <p className="py-2 text-sm text-ink-500">Nenhuma área de lazer deste prédio ainda. Use &quot;Nova área de lazer&quot; acima.</p>}
            <ul className="divide-y divide-border">
              {lista.map((p) =>
                editando?.id === p.id ? (
                  <li key={p.id} className="py-3">
                    <FormProjeto unidades={unidades} predios={predios} inicial={p} onSalvar={(fd) => gravar(fd, p.id)} onCancelar={() => setEditando(null)} />
                  </li>
                ) : (
                  <li key={p.id} className="flex items-center gap-2 py-2">
                    <Link href={`/arquitetura/especificacoes/${p.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-subtle">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {p.codigo && <span className="text-xs font-semibold text-ink-400">{p.codigo}</span>}
                          <span className="font-semibold text-ink-900 group-hover:text-primary">{p.titulo}</span>
                          {p.tipo === "lazer" && <span className="rounded bg-[#EAF7EF] px-1.5 text-[11px] font-semibold text-success">Lazer</span>}
                        </div>
                        <div className="text-xs text-ink-500">
                          {p.tipo !== "lazer" && (
                            <>
                              {p.cliente || "Sem cliente"} · {p.unidade ? <span className="text-primary">{p.unidade}</span> : "sem unidade SBJ"} ·{" "}
                            </>
                          )}
                          {GRUPOS_ARQ.map((g) => `${p.qtd[g.id] ?? 0} ${g.curto.toLowerCase()}`).join(" · ")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-primary" />
                    </Link>
                    {p.tipo !== "lazer" && (
                      <button type="button" className={btnIcone} title="Editar" onClick={() => setEditando(p)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" className={btnIcone} title="Excluir" onClick={() => apagar(p)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Cadastro: empreendimento + áreas de lazer dele (Academia, Salão de Festas… ou uma nova). Abre o lazer do prédio para especificar. */
function FormAreaLazer({ predios, projetos, predioInicial }: { predios: Predio[]; projetos: ProjetoResumo[]; predioInicial: string }) {
  const router = useRouter();
  const [obra, setObra] = useState(predioInicial);
  const existente = projetos.find((p) => p.tipo === "lazer" && p.obra_id === obra);
  const jaTem = existente?.ambientes ?? [];
  const [criadas, setCriadas] = useState<string[]>([]);
  const [marcados, setMarcados] = useState<string[]>(jaTem);
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = Array.from(new Map([...AMBIENTES_LAZER, ...jaTem, ...criadas].map((a) => [fold(a), a])).values());
  const marcado = (a: string) => marcados.some((m) => fold(m) === fold(a));

  function trocarPredio(id: string) {
    setObra(id);
    setCriadas([]);
    setMarcados(projetos.find((p) => p.tipo === "lazer" && p.obra_id === id)?.ambientes ?? []);
  }
  function criar() {
    const nome = tituloAmbiente(nova);
    if (!nome) return;
    setNova("");
    setCriadas((c) => [...c, nome]);
    if (!marcado(nome)) setMarcados((m) => [...m, nome]);
  }
  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const id = await salvarLazer(obra, opcoes.filter(marcado));
      router.push(`/arquitetura/especificacoes/${id}`);
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      {erro && <div className={erroCls}>{erro}</div>}
      <label className="block max-w-sm">
        <span className={rotulo}>Empreendimento *</span>
        <Selecao className="w-full" value={obra} onChange={(e) => trocarPredio(e.target.value)}>
          <option value="">Escolha o empreendimento</option>
          {predios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
      </label>
      {obra && (
        <>
          <div>
            <span className={rotulo}>Área de lazer *</span>
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
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] max-w-sm flex-1">
              <span className={rotulo}>Nova área de lazer</span>
              <input
                className={campo}
                placeholder="Ex.: Espaço Gourmet, Sauna, Quadra"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), criar())}
              />
            </label>
            <button type="button" className={btnSec} onClick={criar} disabled={!nova.trim()}>
              <Plus className="h-4 w-4" /> Criar
            </button>
          </div>
        </>
      )}
      <button type="button" className={btnPrim} onClick={salvar} disabled={salvando || !obra || !opcoes.some(marcado)}>
        {salvando ? "Salvando…" : existente ? "Salvar e abrir o lazer" : "Salvar"}
      </button>
    </div>
  );
}

function FormProjeto({
  inicial, unidades, predios, predioInicial = "", onSalvar, onCancelar,
}: {
  inicial?: ProjetoResumo; unidades: UnidadeSbj[]; predios: Predio[]; predioInicial?: string;
  onSalvar: (fd: FormData) => Promise<void>; onCancelar?: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const atual = unidades.find((u) => u.id === inicial?.unidade_id);
  // prédio: o gravado; senão o da unidade SBJ ligada; senão "fora" para projeto antigo sem prédio
  const predioDaUnidade = atual ? predios.find((p) => p.empId === atual.empId)?.id : undefined;
  const [obra, setObra] = useState(inicial ? inicial.obra_id ?? predioDaUnidade ?? "fora" : predioInicial);
  const [uni, setUni] = useState(atual?.id ?? "");
  const predio = predios.find((p) => p.id === obra);
  const unidadesDoPredio = predio?.empId ? unidades.filter((u) => u.empId === predio.empId) : [];

  // sugestão pelo nome do projeto: "701 Campeche" -> Ilha do Campeche, unidade 701
  const sugestao = (() => {
    if (obra && (obra === "fora" || uni)) return null;
    const ft = fold(titulo);
    const pr = obra
      ? predio
      : predios.find((p) => {
          const palavra = fold(p.nome).split(/\s+/).pop() ?? "";
          return palavra.length > 2 && ft.includes(palavra);
        });
    if (!pr) return null;
    const num = ft.match(/\d{2,4}/)?.[0];
    const u = num && pr.empId ? unidades.find((x) => x.empId === pr.empId && fold(x.numero) === num) ?? null : null;
    if (obra && !u) return null;
    return { predio: pr, unidade: u };
  })();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_110px_1fr_1fr_1fr_auto] lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        await onSalvar(new FormData(e.currentTarget));
        setSalvando(false);
      }}
    >
      <input type="hidden" name="obra_id" value={obra} />
      <input type="hidden" name="unidade_id" value={uni} />
      <label>
        <span className={rotulo}>Prédio *</span>
        <Selecao className="w-full" value={obra} onChange={(e) => { setObra(e.target.value); setUni(""); }}>
          <option value="">Escolha o prédio</option>
          {predios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value="fora">Fora da SBJ (cliente particular)</option>
        </Selecao>
      </label>
      <label>
        <span className={rotulo}>Código</span>
        <input name="codigo" className={campo} placeholder="2026-012" defaultValue={inicial?.codigo ?? ""} />
      </label>
      <label>
        <span className={rotulo}>Unidade / projeto *</span>
        <input name="titulo" className={campo} placeholder="701 Campeche" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label>
        <span className={rotulo}>Cliente</span>
        <input name="cliente" className={campo} defaultValue={inicial?.cliente ?? ""} />
      </label>
      <label>
        <span className={rotulo}>Unidade SBJ</span>
        <Selecao className="w-full" value={uni} onChange={(e) => setUni(e.target.value)} disabled={!unidadesDoPredio.length}>
          <option value="">—</option>
          {unidadesDoPredio.map((u) => <option key={u.id} value={u.id}>{u.numero}{u.bloco ? ` bl. ${u.bloco}` : ""}{u.prop ? ` · ${u.prop}` : ""}</option>)}
        </Selecao>
      </label>
      <div className="flex gap-2">
        <button className={btnPrim} disabled={salvando || !obra}>{salvando ? "Salvando…" : "Salvar"}</button>
        {onCancelar && <button type="button" className={btnSec} onClick={onCancelar}>Cancelar</button>}
      </div>
      {sugestao && (
        <button
          type="button"
          className="text-left text-xs text-primary hover:underline sm:col-span-2 lg:col-span-6"
          onClick={() => { setObra(sugestao.predio.id); setUni(sugestao.unidade?.id ?? ""); }}
        >
          {sugestao.unidade
            ? `Ligar a ${rotuloUnidadeSbj(sugestao.unidade)}${sugestao.unidade.prop ? ` (${sugestao.unidade.prop})` : ""}?`
            : `É do prédio ${sugestao.predio.nome}?`}
        </button>
      )}
    </form>
  );
}
