"use client";

// "Adicionar por texto": a frase vira linhas numa prévia que dá para corrigir antes de gravar.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { GRUPOS, type Grupo } from "@/lib/especificacoes/regras";
import { entenderTexto, type ItemTexto } from "@/lib/especificacoes/texto";
import { criarItens } from "../../actions";
import { btnIcone, btnPrim, btnSec, campo, erroCls, rotulo } from "../../ui";

export default function TextoLivre({
  projetoId, grupo, ambientes, onFechar, onGravado,
}: { projetoId: string; grupo: Grupo; ambientes: string[]; onFechar: () => void; onGravado: () => void }) {
  const g = GRUPOS.find((x) => x.id === grupo)!;
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<ItemTexto[] | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const exemplo =
    grupo === "eletros"
      ? "Cozinha: geladeira brastemp 189x70,5x76; cooktop fischer 4 bocas\nSala de estar: smart tv 65 samsung"
      : grupo === "vidros"
        ? "BWC Suíte: box de banho até o teto\nVaranda: envidraçamento de sacada"
        : "Lavabo: registro docol lift cromado; torneira misturador alto dourado docol; cuba de apoio 30 cm\nCozinha: 2x lixeira de embutir 5 litros";

  const set = (k: number, p: Partial<ItemTexto>) => setPrevia((l) => l!.map((x, j) => (j === k ? { ...x, ...p } : x)));

  async function gravar() {
    if (!previa?.length) return;
    if (previa.some((x) => !x.ambiente.trim())) return setErro("Há linhas sem ambiente. Preencha ou comece a linha com o ambiente (ex.: \"Lavabo: …\").");
    setErro(null);
    setGravando(true);
    try {
      await criarItens(projetoId, grupo, previa);
      onGravado();
    } catch (e: any) {
      setErro(e.message);
      setGravando(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-primaryDark">Adicionar por texto · {g.curto}</h2>
        <button type="button" className={btnSec} onClick={onFechar}>Fechar</button>
      </div>
      {!previa ? (
        <>
          <p className="text-sm text-ink-500">
            Uma linha por ambiente, começando pelo nome dele e dois-pontos. Separe os itens com ponto e vírgula. Quantidade: &quot;2x torneira…&quot;.
            {g.medidas && " Medidas: \"189x70x76\" ou \"altura 85 largura 60\"."}
          </p>
          <textarea className={campo} rows={5} placeholder={exemplo} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex justify-end">
            <button type="button" className={btnPrim} disabled={!texto.trim()} onClick={() => setPrevia(entenderTexto(texto, grupo))}>
              Ver como fica
            </button>
          </div>
        </>
      ) : (
        <>
          {!previa.length && <p className="text-sm text-ink-500">Não encontrei itens nesse texto.</p>}
          <datalist id="txt-amb">{ambientes.map((a) => <option key={a} value={a} />)}</datalist>
          <ul className="space-y-2">
            {previa.map((x, k) => (
              <li key={k} className="grid gap-2 rounded-[10px] border border-border p-2 sm:grid-cols-[150px_150px_1fr_70px_auto]">
                <label>
                  <span className={rotulo}>Ambiente</span>
                  <input className={campo} list="txt-amb" value={x.ambiente} onChange={(e) => set(k, { ambiente: e.target.value })} />
                </label>
                <label>
                  <span className={rotulo}>Item</span>
                  <input className={campo} value={x.material} onChange={(e) => set(k, { material: e.target.value.toUpperCase() })} />
                </label>
                <label>
                  <span className={rotulo}>Referência</span>
                  <input className={campo} value={x.referencia} onChange={(e) => set(k, { referencia: e.target.value })} />
                  {g.medidas && x.medidas && <span className="mt-1 block whitespace-pre-line text-xs text-ink-500">{x.medidas}</span>}
                </label>
                <label>
                  <span className={rotulo}>Qtd.</span>
                  <input className={campo} type="number" min={1} value={x.qtd} onChange={(e) => set(k, { qtd: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                </label>
                <button type="button" className={btnIcone + " self-end"} title="Tirar esta linha" onClick={() => setPrevia((l) => l!.filter((_, j) => j !== k))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {grupo === "vidros" && <p className="text-xs text-ink-500">Nos vidros, a descrição final sai dos campos (altura, perfil, folhas…). Abra cada item depois para preencher.</p>}
          {erro && <div className={erroCls}>{erro}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSec} onClick={() => setPrevia(null)}>Voltar ao texto</button>
            <button type="button" className={btnPrim} disabled={gravando || !previa.length} onClick={gravar}>
              {gravando ? "Gravando…" : `Gravar ${previa.length} item(ns)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
