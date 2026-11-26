"use client";

// Campos das listas de interiores (cortinas e persianas, revestimentos de parede, tapetes).
// O texto da folha, as medidas e o desenho são recalculados a cada campo, só dentro do formulário.
import { useMemo } from "react";
import Selecao from "@/components/ui/Selecao";
import { CORT, gerarInterior, type Cortina } from "@/lib/especificacoes/interiores";
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

/** campos da lista certa para o grupo */
export function CamposInterior({ grupo, valor, onChange }: { grupo: GrupoInterior; valor: Campos; onChange: (v: Campos) => void }) {
  if (grupo === "cortinas") return <CamposCortina valor={valor} onChange={onChange} />;
  return null;
}
