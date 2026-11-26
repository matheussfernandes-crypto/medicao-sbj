// Regras do módulo Especificações (vindas da Torre de Controle FG, codigo-fonte/especificacoes.js).
// Arquivo sem dependências do Next: usado pelas telas, pelas ações do servidor e pela importação.

export type Grupo = "metais" | "eletros" | "vidros" | "cortinas" | "revestimentos" | "tapetes";
/** listas de interiores: os campos ficam em esp_itens.campos; referência, medidas e desenho saem de lib/especificacoes/interiores */
export type GrupoInterior = "cortinas" | "revestimentos" | "tapetes";

export const GRUPOS: { id: Grupo; label: string; curto: string; titulo: string; arq: string; medidas: boolean; qtd?: boolean; interior?: boolean }[] = [
  { id: "metais", label: "Louças e metais", curto: "Louças e metais", titulo: "RELAÇÃO DE LOUÇAS E METAIS", arq: "DET_LOUCAS_E_METAIS", medidas: false },
  { id: "eletros", label: "Eletrodomésticos e eletrônicos", curto: "Eletros", titulo: "RELAÇÃO ELETRODOMÉSTICOS E ELETRÔNICOS", arq: "DET_ELETRODOMESTICOS", medidas: true },
  { id: "vidros", label: "Vidros e box", curto: "Vidros e box", titulo: "RELAÇÃO DE VIDROS E BOX", arq: "DET_VIDROS_E_BOX", medidas: true },
  { id: "cortinas", label: "Cortinas e persianas", curto: "Cortinas", titulo: "RELAÇÃO DE CORTINAS E PERSIANAS", arq: "DET_CORTINAS_E_PERSIANAS", medidas: true, interior: true },
  { id: "revestimentos", label: "Revestimentos de parede", curto: "Revestimentos", titulo: "RELAÇÃO DE REVESTIMENTOS DE PAREDE", arq: "DET_REVESTIMENTOS", medidas: true, qtd: false, interior: true },
  { id: "tapetes", label: "Tapetes", curto: "Tapetes", titulo: "RELAÇÃO DE TAPETES", arq: "DET_TAPETES", medidas: true, interior: true },
];
const TODOS_GRUPOS: Grupo[] = ["metais", "eletros", "vidros", "cortinas", "revestimentos", "tapetes"];
export const ehGrupo = (g: unknown): g is Grupo => TODOS_GRUPOS.includes(g as Grupo);
export const ehInterior = (g: unknown): g is GrupoInterior => g === "cortinas" || g === "revestimentos" || g === "tapetes";
/** a lista tem coluna de quantidade? (revestimentos não tem) */
export const temQtd = (g: Grupo) => GRUPOS.find((x) => x.id === g)?.qtd !== false;
// listas de interiores já liberadas nas telas (as outras entram quando ficarem prontas)
const INTERIORES_PRONTOS: Grupo[] = ["cortinas"];
// grupos que a arquitetura usa nas telas e PDFs (vidros e box não é usado pelo setor; os dados antigos continuam no banco)
export const GRUPOS_ARQ = GRUPOS.filter((g) => g.id !== "vidros" && (!g.interior || INTERIORES_PRONTOS.includes(g.id)));
export const ehGrupoArq = (g: unknown): g is Grupo => GRUPOS_ARQ.some((x) => x.id === g);
/** grupos com catálogo de modelos (as listas de interiores não têm) */
export const GRUPOS_CATALOGO = GRUPOS_ARQ.filter((g) => !g.interior);

export const FAIXAS: Record<number, [string, string]> = { 1: ["$", "Essencial"], 2: ["$$", "Intermediária"], 3: ["$$$", "Premium"] };
export const USOS: Record<string, string> = { b: "Banheiro", c: "Cozinha", s: "Serviço", g: "Qualquer" };

export const AMBIENTES_SUGERIDOS = [
  "Lavabo", "BWC Social", "BWC Suíte", "BWC Suíte Master", "BWC Office", "Cozinha", "Cozinha Gourmet", "Lavanderia", "Área Gourmet",
  "Varanda", "Suíte Master", "Suíte", "Sala de Estar", "Sala de Jantar", "Home Office", "Quarto",
];

export const fold = (s: string | null | undefined) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// lazer de cada prédio: lista padrão (a arquitetura pode criar outros ambientes)
export const AMBIENTES_LAZER = ["Academia", "Salão de Festas", "Hall de Entrada", "Piscina", "Brinquedoteca"];

// "bwc suite master" -> "BWC Suíte Master" (mantém o que a pessoa digitou, só arruma maiúsculas)
export const tituloAmbiente = (s: string) =>
  (s || "")
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      /^(bwc|wc|tv)$/i.test(w) ? w.toUpperCase() : i > 0 && /^(de|da|do|das|dos|e)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");

// ---------- faixa por valor de referência ----------
export const LIMITES_FAIXA: Record<string, [number, number]> = {
  "torneira|b": [600, 1150], "torneira|c": [630, 1300], "registro|g": [170, 300], "monocomando|b": [650, 1100], "chuveiro|b": [600, 1800],
  "ducha|b": [610, 820], "papel|b": [350, 530], "cabide|b": [210, 300], "toalheiro rosto|b": [450, 880], "toalheiro banho|b": [650, 1300],
  "aquecido|b": [1200, 2800], "cuba|b": [470, 650], "cuba|c": [330, 1500], "tanque|s": [460, 900], "lixeira|g": [250, 700], "valvula|g": [100, 300],
  "engate|g": [50, 150], "sifao|g": [50, 150], "dosador|c": [250, 600], "escorredor|c": [200, 400], "talheres|c": [400, 900], "canal|c": [800, 2000],
  "triturador|c": [1500, 3500], padrao: [400, 1200], "padrao|eletros": [1500, 5000], "padrao|moveis": [1500, 6000],
};

export function chaveMat(s: string) {
  const f = fold(s).replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  const mapa: [RegExp, string][] = [
    [/aquecid/, "aquecido"], [/rosto/, "toalheiro rosto"], [/banho/, "toalheiro banho"], [/toalheiro|toalha/, "toalheiro"], [/papeleira|papel/, "papel"],
    [/ducha|higien/, "ducha"], [/torneira|misturador|bica/, "torneira"], [/monocomando/, "monocomando"], [/registro/, "registro"], [/chuveiro/, "chuveiro"],
    [/cabide/, "cabide"], [/cuba/, "cuba"], [/tanque/, "tanque"], [/lixeira/, "lixeira"], [/valvula/, "valvula"], [/engate/, "engate"], [/sifao/, "sifao"],
    [/dosador/, "dosador"], [/escorredor/, "escorredor"], [/talher/, "talheres"], [/canal/, "canal"], [/triturador/, "triturador"],
  ];
  const m = mapa.find(([re]) => re.test(f));
  return m ? m[1] : f;
}

type ModeloValor = { grupo: string; material: string; valor_ref: number | null };
/** [até quanto é $, até quanto é $$]: com 6+ modelos com valor no mesmo tipo de item, os terços do próprio catálogo. */
export function limitesFaixa(grupo: Grupo, material: string, uso: string, catalogo: ModeloValor[]): [number, number] {
  const k = chaveMat(material);
  const vs = catalogo
    .filter((m) => m.grupo === grupo && (m.valor_ref ?? 0) > 0 && chaveMat(m.material) === k)
    .map((m) => Number(m.valor_ref))
    .sort((a, b) => a - b);
  if (vs.length >= 6) return [vs[Math.floor(vs.length / 3)], vs[Math.floor((vs.length * 2) / 3)]];
  const T = LIMITES_FAIXA;
  if (grupo !== "metais") return T["padrao|" + grupo] || T.padrao;
  return T[k + "|" + uso] || T[k + "|g"] || ["b", "c", "s"].map((u) => T[k + "|" + u]).find(Boolean) || T.padrao;
}
export function faixaPorValor(grupo: Grupo, material: string, uso: string, valor: number, catalogo: ModeloValor[]) {
  const [a, b] = limitesFaixa(grupo, material, uso, catalogo);
  return valor < a ? 1 : valor < b ? 2 : 3;
}

// ---------- vidros e box: a descrição e as medidas saem dos campos ----------
export const VID = {
  tipos: ["Box de banho", "Box de canto", "Box com fixo", "Envidraçamento de sacada", "Guarda-corpo de vidro", "Divisória de vidro", "Porta de vidro", "Fechamento de vidro"],
  perfis: ["Cromado", "Preto fosco", "Níquel", "Dourado escovado", "Grafite escovado", "Branco", "Bronze", "Alumínio natural"],
  vidros: ["Incolor", "Fumê", "Bronze", "Verde", "Jateado", "Canelado", "Serigrafado", "Espelhado"],
  puxadores: ["Sem puxador", "Tubular", "Concha", "Barra", "Alça", "Cava", "Puxador no próprio perfil"],
  sistemas: ["Cortina de vidro", "Sistema de correr", "Botões de inox", "Perfil U de alumínio", "Barra de inox"],
};
export type Vidro = {
  altura?: string; largura?: string; ateTeto?: boolean; perfil?: string; vidro?: string;
  folhas?: number; correr?: number; puxador?: string; sistema?: string; obs?: string;
};
export const CAMPOS_VIDRO = ["altura", "largura", "ateTeto", "perfil", "vidro", "folhas", "correr", "puxador", "sistema", "obs"] as const;

export const numPt = (s: unknown) => {
  const t = String(s ?? "").replace(/[^\d.,]/g, "");
  if (!t) return 0;
  const n = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : /^\d{1,3}(\.\d{3})+$/.test(t) ? parseFloat(t.replace(/\./g, "")) : parseFloat(t);
  return isNaN(n) ? 0 : n;
};
const NUM_EXT = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
const extenso = (n: number) => NUM_EXT[n] || String(n);
const maiuscula1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function descVidro(material: string, d: Vidro) {
  const tipo = maiuscula1((material || "Vidro").toLowerCase());
  const alt = numPt(d.altura);
  let s = tipo + (d.ateTeto ? ` até o teto${alt ? ` (PD: ${alt} cm)` : ""}` : alt ? ` com ${alt} cm de altura` : "");
  const partes: string[] = [];
  if (d.perfil) {
    const pf = d.perfil.toLowerCase();
    partes.push(pf === "cromado" ? "Perfis cromados" : pf === "branco" ? "Perfis brancos" : `Perfis em ${pf}`);
  }
  const fo = parseInt(String(d.folhas ?? ""), 10) || 0;
  const co = parseInt(String(d.correr ?? ""), 10) || 0;
  let vidro = d.vidro ? `vidro ${d.vidro.toLowerCase()}` : "";
  if (fo) vidro = `${extenso(fo)} ${fo === 1 ? "folha" : "folhas"}${vidro ? " em " + vidro : ""}${co ? `, sendo ${extenso(co)} de correr` : ""}`;
  else if (vidro) vidro = `Vidro ${d.vidro!.toLowerCase()}`;
  if (vidro) partes.push(partes.length && fo ? "com " + vidro : vidro);
  if (partes.length) s += "; " + partes.join(fo ? " " : ", ");
  s += ".";
  if (d.puxador) s += ` Puxador: ${d.puxador.toLowerCase()}.`;
  if (d.sistema) s += ` Sistema: ${d.sistema.toLowerCase()}.`;
  if (d.obs) s += " " + d.obs.trim();
  return s;
}
export function medidasVidro(d: Vidro) {
  const alt = numPt(d.altura), larg = numPt(d.largura), l: string[] = [];
  if (alt) l.push(`${d.ateTeto ? "Altura (PD)" : "Altura"}: ${alt} cm`);
  if (larg) l.push(`Largura: ${larg} cm`);
  return l.join("\n");
}

// referência de um modelo do catálogo como entra no item ("Torneira ... - DOCOL")
export function refDoModelo(referencia: string, marca: string) {
  const t = maiuscula1(referencia || "");
  return marca && !fold(t).includes(fold(marca)) ? `${t} - ${marca}` : t;
}
