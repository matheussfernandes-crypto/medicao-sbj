// Converte o arquivo "Exportar dados" da Torre FG (especificacoes_FG_<data>.json) e o catalogo-modelos.json
// nas linhas das tabelas esp_*. Não grava nada: quem chama decide o que fazer com as linhas.
import { CAMPOS_VIDRO, ehGrupo, type Grupo, type Vidro } from "./regras";

export type LinhaProjeto = { id: string; codigo: string | null; titulo: string; cliente: string | null };
export type LinhaItem = {
  id: string; projeto_id: string; grupo: Grupo; ambiente: string; material: string; referencia: string; medidas: string;
  qtd: number; img: string; ordem: number; vidro: Vidro | null; criado_em: string;
};
export type LinhaNota = { projeto_id: string; grupo: Grupo; obs: string; rev: string; papel: string; faixa: number | null; marca: string | null; acab: string | null };
export type LinhaModelo = {
  id: string; grupo: Grupo; material: string; referencia: string; medidas: string; marca: string; linha: string; acab: string; codigo: string;
  faixa: number | null; uso: string; valor_ref: number | null; valor_data: string | null; img: string; revisar: boolean; ordem: number; criado_em: string;
};
export type Conversao = { projetos: LinhaProjeto[]; itens: LinhaItem[]; notas: LinhaNota[]; modelos: LinhaModelo[]; avisos: string[] };

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const tn = (v: unknown) => t(v) || null;
const quando = (ms: unknown) => {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : new Date().toISOString();
};
// "brand/catalogo/x.jpg" -> "catalogo/x.jpg" (foto que vem com o site); "data:image/..." fica como está; outro endereço é ignorado
export const imgDaTorre = (v: unknown) => {
  const s = t(v);
  if (!s) return "";
  if (s.startsWith("brand/catalogo/")) return "catalogo/" + s.slice("brand/catalogo/".length);
  if (s.startsWith("catalogo/") || /^data:image\/(jpeg|png|webp);base64,/.test(s)) return s;
  return "";
};
const faixa = (v: unknown) => {
  const n = parseInt(t(v), 10);
  return n >= 1 && n <= 3 ? n : null;
};

export function converter(json: any): Conversao {
  const avisos: string[] = [];
  const out: Conversao = { projetos: [], itens: [], notas: [], modelos: [], avisos };
  if (!json || typeof json !== "object") throw new Error("Arquivo vazio ou inválido.");

  // catalogo-modelos.json (carga inicial): campos com nomes por extenso e sem id
  const ehCatalogoInicial = Array.isArray(json.modelos) && !json.projetos && json.modelos.some((m: any) => "codigoFabricante" in m || "acabamento" in m);

  for (const p of Array.isArray(json.projetos) ? json.projetos : []) {
    const id = t(p.id);
    if (!id) continue;
    out.projetos.push({ id, codigo: tn(p.codigo), titulo: t(p.titulo) || id, cliente: tn(p.cliente) });
  }
  const projetos = new Set(out.projetos.map((p) => p.id));

  for (const i of Array.isArray(json.itens) ? json.itens : []) {
    const id = t(i.id);
    if (!id || !ehGrupo(i.grupo)) continue;
    if (!projetos.has(t(i.projetoId))) {
      avisos.push(`Item ${id} ignorado: projeto ${t(i.projetoId)} não está no arquivo.`);
      continue;
    }
    let vidro: Vidro | null = null;
    if (i.grupo === "vidros") {
      vidro = {};
      for (const c of CAMPOS_VIDRO) if (i[c] !== undefined && i[c] !== "") (vidro as any)[c] = i[c];
    }
    out.itens.push({
      id, projeto_id: t(i.projetoId), grupo: i.grupo, ambiente: t(i.ambiente), material: t(i.material).toUpperCase(), referencia: t(i.referencia),
      medidas: t(i.medidas), qtd: Math.max(1, parseInt(t(i.qtd), 10) || 1), img: imgDaTorre(i.img), ordem: Number(i.ordem) || 0, vidro,
      criado_em: quando(i.createdAt),
    });
  }

  for (const n of Array.isArray(json.notas) ? json.notas : []) {
    if (!ehGrupo(n.grupo) || !projetos.has(t(n.projetoId))) continue;
    out.notas.push({
      projeto_id: t(n.projetoId), grupo: n.grupo, obs: t(n.obs), rev: t(n.rev) || "R0", papel: ["a3p", "a4r", "a4p"].includes(t(n.papel)) ? t(n.papel) : "a3p",
      faixa: faixa(n.faixa), marca: tn(n.marca), acab: tn(n.acab),
    });
  }

  (Array.isArray(json.modelos) ? json.modelos : []).forEach((m: any, k: number) => {
    const grupo = ehGrupo(m.grupo) ? m.grupo : "metais";
    const codigo = t(m.codigo ?? m.codigoFabricante);
    const id = t(m.id) || (ehCatalogoInicial ? (codigo ? "cod_" + codigo : "cat_ini_" + String(k + 1).padStart(3, "0")) : "");
    if (!id) return;
    const valor = Number(m.valorRef);
    out.modelos.push({
      id, grupo, material: t(m.material).toUpperCase(), referencia: t(m.referencia), medidas: t(m.medidas), marca: t(m.marca), linha: t(m.linha),
      acab: t(m.acab ?? m.acabamento), codigo, faixa: faixa(m.faixa), uso: ["b", "c", "s", "g"].includes(t(m.uso)) ? t(m.uso) : "g",
      valor_ref: Number.isFinite(valor) && valor > 0 ? valor : null, valor_data: /^\d{4}-\d{2}-\d{2}$/.test(t(m.valorData)) ? t(m.valorData) : null,
      img: imgDaTorre(m.img ?? m.imagem), revisar: !!m.revisar, ordem: Number(m.ordem) || k, criado_em: quando(m.createdAt),
    });
  });
  return out;
}
