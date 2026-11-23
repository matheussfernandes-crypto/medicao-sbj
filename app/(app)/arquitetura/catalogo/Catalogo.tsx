"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";
import Selecao from "@/components/ui/Selecao";
import { FAIXAS, GRUPOS, USOS, fold, type Grupo } from "@/lib/especificacoes/regras";
import { excluirModelo, salvarModelo } from "../actions";
import { Faixa, FotoCampo, Janela, Miniatura, type Modelo } from "../comum";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../ui";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Catalogo({ modelos, assinadas }: { modelos: Modelo[]; assinadas: Record<string, string> }) {
  const router = useRouter();
  const [grupo, setGrupo] = useState<Grupo>("metais");
  const [material, setMaterial] = useState("");
  const [marca, setMarca] = useState("");
  const [faixa, setFaixa] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<Modelo> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const doGrupo = modelos.filter((m) => m.grupo === grupo);
  const materiais = Array.from(new Set(doGrupo.map((m) => m.material).filter(Boolean))).sort();
  const marcas = Array.from(new Set(doGrupo.map((m) => m.marca).filter(Boolean))).sort();
  const lista = useMemo(() => {
    const f = fold(busca);
    return doGrupo
      .filter((m) => !material || m.material === material)
      .filter((m) => !marca || m.marca === marca)
      .filter((m) => !faixa || String(m.faixa ?? "") === faixa)
      .filter((m) => !f || fold(`${m.material} ${m.referencia} ${m.marca} ${m.linha} ${m.acab} ${m.codigo}`).includes(f))
      .sort((a, b) => a.material.localeCompare(b.material) || (a.faixa ?? 9) - (b.faixa ?? 9) || a.referencia.localeCompare(b.referencia));
  }, [doGrupo, material, marca, faixa, busca]);

  function trocarGrupo(g: Grupo) {
    setGrupo(g);
    setMaterial("");
    setMarca("");
  }

  async function apagar(m: Modelo) {
    const ok = await pedirConfirmacao({ texto: `Excluir do catálogo "${m.referencia}"? Os itens que já usam esse modelo não mudam.`, botao: "Excluir" });
    if (!ok) return;
    try {
      await excluirModelo(m.id);
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
          <h1 className="text-lg font-semibold text-primaryDark">Catálogo de modelos</h1>
          <p className="text-sm text-ink-500">Faixa: $ essencial · $$ intermediária · $$$ premium.</p>
        </div>
        <button type="button" className={btnPrim} onClick={() => setEditando({ grupo, material, uso: "g", faixa: null, revisar: false, img: "" })}>
          <Plus className="h-4 w-4" /> Novo modelo
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {GRUPOS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => trocarGrupo(x.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
              x.id === grupo ? "border-primary text-primary" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {x.curto} <span className="ml-1 text-xs font-normal text-ink-400">{modelos.filter((m) => m.grupo === x.id).length}</span>
          </button>
        ))}
      </div>

      {erro && <div className={erroCls}>{erro}</div>}

      <div className="card space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_160px_130px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <input className={campo + " pl-9"} placeholder="Buscar (descrição, linha, código…)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Selecao className="w-full" value={material} onChange={(e) => setMaterial(e.target.value)}>
            <option value="">Todos os itens</option>
            {materiais.map((m) => <option key={m} value={m}>{m}</option>)}
          </Selecao>
          <Selecao className="w-full" value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </Selecao>
          <Selecao className="w-full" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
            <option value="">Todas as faixas</option>
            {[1, 2, 3].map((f) => <option key={f} value={String(f)}>{FAIXAS[f][0]} {FAIXAS[f][1]}</option>)}
          </Selecao>
        </div>
        <p className="text-xs text-ink-500">{lista.length} modelo(s)</p>
        <ul className="divide-y divide-border">
          {lista.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <Miniatura img={m.img} assinadas={assinadas} tam="h-14 w-14" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(m)}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink-400">
                  {m.material}
                  <Faixa f={m.faixa} />
                  {m.uso !== "g" && <span className="font-normal">{USOS[m.uso]}</span>}
                  {m.revisar && (
                    <span className="inline-flex items-center gap-1 font-normal text-warning" title="Conferir os dados deste modelo">
                      <AlertTriangle className="h-3 w-3" /> conferir
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink-900">{m.referencia}</div>
                <div className="text-xs text-ink-500">
                  {[m.marca, m.linha, m.acab, m.codigo && `cód. ${m.codigo}`, m.valor_ref && brl(Number(m.valor_ref))].filter(Boolean).join(" · ")}
                </div>
              </button>
              <button type="button" className={btnIcone} title="Editar" onClick={() => setEditando(m)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className={btnIcone} title="Excluir" onClick={() => apagar(m)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {editando && (
        <FormModelo
          inicial={editando}
          assinadas={assinadas}
          materiais={Array.from(new Set(modelos.filter((m) => m.grupo === (editando.grupo ?? grupo)).map((m) => m.material))).sort()}
          marcas={Array.from(new Set(modelos.map((m) => m.marca).filter(Boolean))).sort()}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FormModelo({
  inicial, assinadas, materiais, marcas, onFechar, onSalvo,
}: { inicial: Partial<Modelo>; assinadas: Record<string, string>; materiais: string[]; marcas: string[]; onFechar: () => void; onSalvo: () => void }) {
  const [d, setD] = useState<Partial<Modelo>>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = (p: Partial<Modelo>) => setD((x) => ({ ...x, ...p }));
  const g = GRUPOS.find((x) => x.id === d.grupo) ?? GRUPOS[0];

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await salvarModelo({
        id: d.id, grupo: (d.grupo ?? "metais") as Grupo, material: d.material ?? "", referencia: d.referencia ?? "", medidas: d.medidas ?? "",
        marca: d.marca ?? "", linha: d.linha ?? "", acab: d.acab ?? "", codigo: d.codigo ?? "", faixa: d.faixa ?? null, uso: d.uso ?? "g",
        valor_ref: d.valor_ref ?? null, img: d.img ?? "", revisar: !!d.revisar,
      });
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Janela titulo={d.id ? "Editar modelo" : "Novo modelo"} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={rotulo}>Grupo</span>
            <Selecao className="w-full" value={d.grupo ?? "metais"} onChange={(e) => set({ grupo: e.target.value as Grupo })}>
              {GRUPOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </Selecao>
          </label>
          <label>
            <span className={rotulo}>Item *</span>
            <input className={campo} list="cat-mat" value={d.material ?? ""} placeholder="TORNEIRA" onChange={(e) => set({ material: e.target.value.toUpperCase() })} />
            <datalist id="cat-mat">{materiais.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
        </div>
        <label className="block">
          <span className={rotulo}>Descrição do modelo *</span>
          <textarea className={campo} rows={2} value={d.referencia ?? ""} onChange={(e) => set({ referencia: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className={rotulo}>Marca</span>
            <input className={campo} list="cat-marca" value={d.marca ?? ""} onChange={(e) => set({ marca: e.target.value.toUpperCase() })} />
            <datalist id="cat-marca">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <label>
            <span className={rotulo}>Linha</span>
            <input className={campo} value={d.linha ?? ""} onChange={(e) => set({ linha: e.target.value })} />
          </label>
          <label>
            <span className={rotulo}>Acabamento</span>
            <input className={campo} value={d.acab ?? ""} onChange={(e) => set({ acab: e.target.value })} />
          </label>
          <label>
            <span className={rotulo}>Código do fabricante</span>
            <input className={campo} value={d.codigo ?? ""} onChange={(e) => set({ codigo: e.target.value })} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={rotulo}>Faixa</span>
            <Selecao className="w-full" value={d.faixa ? String(d.faixa) : ""} onChange={(e) => set({ faixa: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {[1, 2, 3].map((f) => <option key={f} value={String(f)}>{FAIXAS[f][0]} {FAIXAS[f][1]}</option>)}
            </Selecao>
          </label>
          <label>
            <span className={rotulo}>Uso</span>
            <Selecao className="w-full" value={d.uso ?? "g"} onChange={(e) => set({ uso: e.target.value })}>
              {Object.entries(USOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </label>
          <label>
            <span className={rotulo}>Valor de referência (R$)</span>
            <input className={campo} type="number" min={0} step="0.01" value={d.valor_ref ?? ""} onChange={(e) => set({ valor_ref: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
        {g.medidas && (
          <label className="block">
            <span className={rotulo}>Medidas</span>
            <textarea className={campo} rows={3} value={d.medidas ?? ""} placeholder={"Altura: \nLargura: \nProfundidade: "} onChange={(e) => set({ medidas: e.target.value })} />
          </label>
        )}
        <div>
          <span className={rotulo}>Foto</span>
          <FotoCampo valor={d.img ?? ""} onChange={(img) => set({ img })} assinadas={assinadas} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={!!d.revisar} onChange={(e) => set({ revisar: e.target.checked })} /> Marcar para conferir os dados
        </label>
        {erro && <div className={erroCls}>{erro}</div>}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" className={btnSec} onClick={onFechar}>Cancelar</button>
          <button type="button" className={btnPrim} onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </Janela>
  );
}
