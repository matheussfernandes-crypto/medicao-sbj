"use client";

// Campos das listas de interiores (cortinas e persianas, revestimentos de parede, tapetes).
// O texto da folha, as medidas e o desenho são recalculados a cada campo, só dentro do formulário.
import { useMemo } from "react";
import Selecao from "@/components/ui/Selecao";
import {
  CORT, REV, TAP, calcParede, fmtM, gerarInterior, tapeteUmaMedida, type Cortina, type Desconto, type Parede, type Tapete, type TipoDesconto,
} from "@/lib/especificacoes/interiores";
import { desenhoInterior } from "@/lib/especificacoes/desenhoInteriores";
import type { GrupoInterior } from "@/lib/especificacoes/regras";
import { campo, rotulo } from "../../ui";

type Campos = Record<string, unknown>;

/** desenho automático (lista e formulário) */
export function DesenhoInterior({ grupo, campos, tam = "h-16 w-24" }: { grupo: GrupoInterior; campos: unknown; tam?: string }) {
  const html = useMemo(() => desenhoInterior(grupo, campos), [grupo, campos]);
  return <div className={`${tam} shrink-0 overflow-hidden rounded-lg border border-border bg-white`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** aviso "falta preencher" com os campos obrigatórios que faltam */
export function FaltaPreencher({ falta }: { falta: string[] }) {
  if (!falta.length) return null;
  return (
    <span className="inline-flex rounded-md bg-[#FDECEA] px-2 py-0.5 text-[11px] font-semibold text-[#B3261E]" title={`Falta: ${falta.join(", ")}`}>
      Falta preencher: {falta.join(", ")}
    </span>
  );
}

/** prévia "como sai na folha": desenho, texto e medidas */
export function PreviaInterior({ grupo, campos, comImagem }: { grupo: GrupoInterior; campos: Campos; comImagem: boolean }) {
  const g = useMemo(() => gerarInterior(grupo, campos), [grupo, campos]);
  return (
    <div className="flex flex-wrap gap-3 rounded-[10px] bg-surface-subtle p-3 text-sm sm:flex-nowrap">
      {!comImagem && <DesenhoInterior grupo={grupo} campos={g.campos} tam="h-32 w-48" />}
      <div className="min-w-0 space-y-1">
        <div className={rotulo}>Como sai na folha</div>
        <div className="text-ink-900">{g.referencia}</div>
        {g.medidas && <div className="whitespace-pre-line text-xs text-ink-500">{g.medidas}</div>}
        <FaltaPreencher falta={g.falta} />
        {!comImagem && <div className="text-[11px] text-ink-400">Desenho automático. Envie uma imagem abaixo para trocar.</div>}
      </div>
    </div>
  );
}

const Marca = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-center gap-2 text-sm text-ink-700">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {children}
  </label>
);

// ---------- 1. cortinas e persianas ----------
export function CamposCortina({ valor, onChange }: { valor: Campos; onChange: (v: Campos) => void }) {
  const c = valor as Cortina;
  const set = (p: Partial<Cortina>) => onChange({ ...c, ...p });
  const det = c.detalhes ?? [];
  const marcaDet = (d: string, on: boolean) => set({ detalhes: on ? [...det, d] : det.filter((x) => x !== d) });
  const xale = c.xale ?? "sem";
  const med = (k: keyof Cortina, rot: string, dica = "em metros, ex.: 2,20") => (
    <label>
      <span className={rotulo}>{rot}</span>
      <input className={campo} inputMode="decimal" placeholder={dica} value={String(c[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<Cortina>)} />
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={rotulo}>Tipo *</span>
          <Selecao className="w-full" value={c.tipo ?? ""} onChange={(e) => set({ tipo: e.target.value || undefined })}>
            <option value="">—</option>
            {CORT.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </Selecao>
        </label>
        <label>
          <span className={rotulo}>Forma</span>
          <Selecao className="w-full" value={c.emL ? "L" : "reta"} onChange={(e) => set({ emL: e.target.value === "L" || undefined })}>
            <option value="reta">Reta</option>
            <option value="L">Em L</option>
          </Selecao>
        </label>
        <div />
        {med("larg1", c.emL ? "Largura do trecho 1 *" : "Largura do vão *")}
        {c.emL && med("larg2", "Largura do trecho 2 *")}
        {med("altura", "Altura do vão *")}
      </div>
      <p className="-mt-1 text-[11px] text-ink-400">Medidas em metros com vírgula. Número acima de 30 é lido como centímetros (270 vira 2,70).</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={rotulo}>Tecido / produto *</span>
          <input className={campo} placeholder="Ex.: linho, voil, tela solar 5%" value={c.tecido ?? ""} onChange={(e) => set({ tecido: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Cor</span>
          <input className={campo} placeholder="Ex.: off white, cinza, terracota" value={c.cor ?? ""} onChange={(e) => set({ cor: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Barra</span>
          <input className={campo} placeholder="Ex.: rente ao piso, arrastão" value={c.barra ?? ""} onChange={(e) => set({ barra: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Altura da barra (cm)</span>
          <input className={campo} inputMode="decimal" placeholder="Ex.: 20" value={c.barraAlt ?? ""} onChange={(e) => set({ barraAlt: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Xale</span>
          <Selecao className="w-full" value={xale} onChange={(e) => set({ xale: e.target.value as Cortina["xale"] })}>
            {CORT.xales.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Selecao>
        </label>
        {xale !== "sem" && (
          <label>
            <span className={rotulo}>Medida do xale (cm)</span>
            <input className={campo} inputMode="decimal" placeholder="Ex.: 50" value={c.xaleMed ?? ""} onChange={(e) => set({ xaleMed: e.target.value })} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Marca on={!!c.pingente} set={(v) => set({ pingente: v || undefined })}>Pingente</Marca>
        <Marca on={!!c.gesso} set={(v) => set({ gesso: v || undefined })}>Cortineiro no gesso</Marca>
        <Marca on={!!c.motorizada} set={(v) => set({ motorizada: v || undefined })}>Motorizada</Marca>
      </div>

      <div className="rounded-[10px] border border-border p-3">
        <div className={rotulo}>Detalhes</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[["Cabeçalho / prega", CORT.cabecalho], ["Acabamentos", CORT.acabamentos]].map(([tit, lista]) => (
            <div key={tit as string}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{tit as string}</div>
              <div className="grid grid-cols-2 gap-1">
                {(lista as string[]).map((d) => <Marca key={d} on={det.includes(d)} set={(v) => marcaDet(d, v)}>{d}</Marca>)}
              </div>
            </div>
          ))}
        </div>
        <label className="mt-2 block">
          <span className={rotulo}>Outro detalhe</span>
          <input className={campo} value={c.outroDetalhe ?? ""} onChange={(e) => set({ outroDetalhe: e.target.value })} />
        </label>
      </div>

      <label className="block">
        <span className={rotulo}>Observação (entra no fim do texto)</span>
        <input className={campo} value={c.obs ?? ""} onChange={(e) => set({ obs: e.target.value })} />
      </label>
    </div>
  );
}

// ---------- 2. revestimentos de parede ----------
export function CamposParede({ valor, onChange }: { valor: Campos; onChange: (v: Campos) => void }) {
  const p = valor as Parede;
  const set = (x: Partial<Parede>) => onChange({ ...p, ...x });
  const lista = p.descontos ?? [];
  const setDesc = (k: number, x: Partial<Desconto>) => set({ descontos: lista.map((d, j) => (j === k ? { ...d, ...x } : d)) });
  const novoDesc = (tipo: TipoDesconto) => {
    const m = REV.padrao[tipo];
    set({ descontos: [...lista, { tipo, larg: m?.[0], alt: m?.[1] }] });
  };
  const calc = useMemo(() => calcParede(p), [p]);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={rotulo}>Material *</span>
          <Selecao className="w-full" value={p.material ?? ""} onChange={(e) => set({ material: e.target.value || undefined })}>
            <option value="">—</option>
            {REV.materiais.map((m) => <option key={m} value={m}>{m}</option>)}
          </Selecao>
        </label>
        <label>
          <span className={rotulo}>Nome da parede</span>
          <input className={campo} placeholder="Ex.: cabeceira, parede da TV" value={p.parede ?? ""} onChange={(e) => set({ parede: e.target.value })} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={rotulo}>Largura *</span>
          <input className={campo} inputMode="decimal" placeholder="em metros, ex.: 3,20" value={p.larg ?? ""} onChange={(e) => set({ larg: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Altura *</span>
          <input className={campo} inputMode="decimal" placeholder="em metros, ex.: 2,70" value={p.altura ?? ""} onChange={(e) => set({ altura: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Altura do rodapé</span>
          <input className={campo} inputMode="decimal" placeholder="10 (cm) ou 0,10 (m)" value={p.rodape ?? ""} onChange={(e) => set({ rodape: e.target.value })} />
        </label>
      </div>
      <p className="-mt-1 text-[11px] text-ink-400">Largura e altura em metros (acima de 30 vira centímetros). No rodapé, 1 ou mais é lido em centímetros; abaixo de 1, em metros.</p>
      <label className="block">
        <span className={rotulo}>Produto (marca, coleção, código)</span>
        <input className={campo} value={p.produto ?? ""} onChange={(e) => set({ produto: e.target.value })} />
      </label>

      <div className="rounded-[10px] border border-border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className={rotulo + " mb-0"}>Descontos (aberturas e móveis)</span>
          <div className="flex flex-wrap gap-1.5">
            {REV.descontos.map((t) => (
              <button key={t} type="button" className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-ink-700 hover:border-primary hover:text-primary" onClick={() => novoDesc(t)}>
                + {t}
              </button>
            ))}
          </div>
        </div>
        {!lista.length && <p className="text-xs text-ink-400">Nenhum desconto. Use os botões acima para portas, janelas e móveis.</p>}
        <div className="space-y-2">
          {lista.map((d, k) => (
            <div key={k} className={`grid grid-cols-2 items-end gap-2 rounded-lg p-2 sm:grid-cols-[110px_1fr_1fr_1fr_1fr_auto] ${calc.lista[k]?.fora ? "bg-[#FDECEA]" : "bg-surface-subtle"}`}>
              <label>
                <span className={rotulo}>Tipo</span>
                <Selecao className="w-full" value={d.tipo} onChange={(e) => setDesc(k, { tipo: e.target.value as TipoDesconto })}>
                  {REV.descontos.map((t) => <option key={t} value={t}>{t}</option>)}
                </Selecao>
              </label>
              {([["larg", "Largura"], ["alt", "Altura"], ["esq", "Da lateral esq."], ["chao", "Do chão"]] as [keyof Desconto, string][]).map(([c, r]) => (
                <label key={c}>
                  <span className={rotulo}>{r}{c === "esq" || c === "chao" ? " (opc.)" : ""}</span>
                  <input className={campo} inputMode="decimal" value={String(d[c] ?? "")} placeholder={c === "chao" && d.tipo === "Janela" ? "1,00" : c === "chao" ? "0" : ""} onChange={(e) => setDesc(k, { [c]: e.target.value } as Partial<Desconto>)} />
                </label>
              ))}
              <button type="button" className="h-9 rounded-lg px-2 text-xs font-semibold text-ink-500 hover:text-[#B3261E]" onClick={() => set({ descontos: lista.filter((_, j) => j !== k) })} title="Tirar desconto">
                Tirar
              </button>
            </div>
          ))}
        </div>
        {calc.L > 0 && calc.H > 0 && (
          <p className="mt-2 text-xs text-ink-500">
            Bruta {fmtM(calc.bruta)} m² − aberturas {fmtM(calc.aberturas)} m² − faixa do rodapé {fmtM(calc.faixaRodape)} m² = <b className="text-ink-900">{fmtM(calc.liquida)} m² líquidos</b>
          </p>
        )}
        {calc.fora && <p className="mt-1 text-xs font-semibold text-[#B3261E]">Algum desconto passa da parede. Confira as medidas e as posições.</p>}
      </div>

      <label className="block">
        <span className={rotulo}>Observação</span>
        <input className={campo} value={p.obs ?? ""} onChange={(e) => set({ obs: e.target.value })} />
      </label>
      <p className="text-[11px] text-ink-400">Sobra, rolos e tiras não são calculados aqui: ficam com a loja.</p>
    </div>
  );
}

// ---------- 3. tapetes ----------
export function CamposTapete({ valor, onChange }: { valor: Campos; onChange: (v: Campos) => void }) {
  const t = valor as Tapete;
  const set = (x: Partial<Tapete>) => onChange({ ...t, ...x });
  const um = tapeteUmaMedida(t.formato), org = t.formato === "Orgânico";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={rotulo}>Formato *</span>
          <Selecao className="w-full" value={t.formato ?? ""} onChange={(e) => set({ formato: e.target.value || undefined })}>
            <option value="">—</option>
            {TAP.formatos.map((f) => <option key={f} value={f}>{f}</option>)}
          </Selecao>
        </label>
        <label>
          <span className={rotulo}>{t.formato === "Redondo" ? "Diâmetro *" : t.formato === "Quadrado" ? "Lado *" : org ? "Maior largura *" : "Largura *"}</span>
          <input className={campo} inputMode="decimal" placeholder="em metros, ex.: 2,50" value={t.larg ?? ""} onChange={(e) => set({ larg: e.target.value })} />
        </label>
        {!um && (
          <label>
            <span className={rotulo}>{org ? "Maior comprimento *" : "Comprimento *"}</span>
            <input className={campo} inputMode="decimal" placeholder="em metros, ex.: 3,00" value={t.comp ?? ""} onChange={(e) => set({ comp: e.target.value })} />
          </label>
        )}
      </div>
      <p className="-mt-1 text-[11px] text-ink-400">
        {org ? "Orgânico: informe só a medida geral (maior largura e maior comprimento). " : ""}Medidas em metros; acima de 30 vira centímetros (250 vira 2,50).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={rotulo}>Material</span>
          <input className={campo} placeholder="Ex.: lã, sisal, algodão" value={t.material ?? ""} onChange={(e) => set({ material: e.target.value })} />
        </label>
        <label>
          <span className={rotulo}>Cor</span>
          <input className={campo} placeholder="Ex.: cru, cinza, terracota" value={t.cor ?? ""} onChange={(e) => set({ cor: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className={rotulo}>Observação (entra no fim do texto)</span>
        <input className={campo} value={t.obs ?? ""} onChange={(e) => set({ obs: e.target.value })} />
      </label>
    </div>
  );
}

/** campos herdados por "+ Outra parede com este produto" */
export const herdarParede = (c: unknown): Campos => {
  const p = (c ?? {}) as Parede;
  return { material: p.material, produto: p.produto, rodape: p.rodape, altura: p.altura };
};

/** campos da lista certa para o grupo */
export function CamposInterior({ grupo, valor, onChange }: { grupo: GrupoInterior; valor: Campos; onChange: (v: Campos) => void }) {
  if (grupo === "cortinas") return <CamposCortina valor={valor} onChange={onChange} />;
  if (grupo === "revestimentos") return <CamposParede valor={valor} onChange={onChange} />;
  if (grupo === "tapetes") return <CamposTapete valor={valor} onChange={onChange} />;
  return null;
}
