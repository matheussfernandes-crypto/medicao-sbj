"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, FileUp, Pencil, Search, Trash2 } from "lucide-react";
import PainelCadastro from "@/components/ui/PainelCadastro";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";
import { createClient } from "@/lib/supabase/client";
import { converter } from "@/lib/especificacoes/importar";
import { enviarFoto } from "@/lib/especificacoes/imagem";
import { fold, GRUPOS } from "@/lib/especificacoes/regras";
import { excluirProjeto, importarLinhas, salvarProjeto } from "../actions";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../ui";

export type ProjetoResumo = {
  id: string; codigo: string | null; titulo: string; cliente: string | null; atualizado_em: string; qtd: Record<string, number>;
};

export default function ListaProjetos({ projetos }: { projetos: ProjetoResumo[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<ProjetoResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const f = fold(busca);
  const visiveis = projetos.filter((p) => !f || fold(`${p.codigo} ${p.titulo} ${p.cliente}`).includes(f));

  async function gravar(fd: FormData, id?: string) {
    setErro(null);
    try {
      const novo = await salvarProjeto({
        id, codigo: String(fd.get("codigo") ?? ""), titulo: String(fd.get("titulo") ?? ""), cliente: String(fd.get("cliente") ?? ""),
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
          <p className="text-sm text-ink-500">Louças e metais, eletros e vidros de cada projeto da arquitetura.</p>
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

      <PainelCadastro titulo="Projetos" rotuloBotao="Novo projeto">
        <FormProjeto onSalvar={(fd) => gravar(fd)} />
      </PainelCadastro>

      <div className="card space-y-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className={campo + " pl-9"} placeholder="Buscar por código, unidade ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {!visiveis.length && <p className="py-6 text-center text-sm text-ink-500">Nenhum projeto{busca ? " encontrado" : " cadastrado"}.</p>}
        <ul className="divide-y divide-border">
          {visiveis.map((p) =>
            editando?.id === p.id ? (
              <li key={p.id} className="py-3">
                <FormProjeto inicial={p} onSalvar={(fd) => gravar(fd, p.id)} onCancelar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <Link href={`/arquitetura/especificacoes/${p.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-subtle">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {p.codigo && <span className="text-xs font-semibold text-ink-400">{p.codigo}</span>}
                      <span className="font-semibold text-ink-900 group-hover:text-primary">{p.titulo}</span>
                    </div>
                    <div className="text-xs text-ink-500">
                      {p.cliente || "Sem cliente"} ·{" "}
                      {GRUPOS.map((g) => `${p.qtd[g.id] ?? 0} ${g.curto.toLowerCase()}`).join(" · ")}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-primary" />
                </Link>
                <button type="button" className={btnIcone} title="Editar" onClick={() => setEditando(p)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className={btnIcone} title="Excluir" onClick={() => apagar(p)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
}

function FormProjeto({ inicial, onSalvar, onCancelar }: { inicial?: ProjetoResumo; onSalvar: (fd: FormData) => Promise<void>; onCancelar?: () => void }) {
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        await onSalvar(new FormData(e.currentTarget));
        setSalvando(false);
      }}
    >
      <label>
        <span className={rotulo}>Código</span>
        <input name="codigo" className={campo} placeholder="2026-012" defaultValue={inicial?.codigo ?? ""} />
      </label>
      <label>
        <span className={rotulo}>Unidade / projeto *</span>
        <input name="titulo" className={campo} placeholder="701 Campeche" required defaultValue={inicial?.titulo ?? ""} />
      </label>
      <label>
        <span className={rotulo}>Cliente</span>
        <input name="cliente" className={campo} defaultValue={inicial?.cliente ?? ""} />
      </label>
      <div className="flex gap-2">
        <button className={btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        {onCancelar && <button type="button" className={btnSec} onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}
