// Sugestões de itens por ambiente e leitura de texto livre ("lavabo: registro docol lift cromado; torneira ...").
// Regras trazidas da Torre de Controle FG (codigo-fonte/especificacoes.js: PADROES, entenderTexto).
import { GRUPOS, fold, tituloAmbiente, type Grupo } from "./regras";

const BANHO = ["Torneira", "Cuba", "Registro", "Monocomando", "Chuveiro", "Toalheiro banho", "Toalheiro rosto", "Porta papel higiênico", "Ducha higiênica"];
// itens que costumam existir em cada tipo de ambiente (vale o primeiro que combinar)
const PADROES: { grupo: Grupo; re: RegExp; itens: string[] }[] = [
  // lazer do prédio
  { grupo: "metais", re: /sal[aã]o de festa|espa[cç]o gourmet|churrasq/, itens: ["Torneira", "Cuba", "Lixeira", "Registro"] },
  { grupo: "metais", re: /piscina/, itens: ["Ducha", "Torneira"] },
  { grupo: "eletros", re: /sal[aã]o de festa|espa[cç]o gourmet|churrasq/, itens: ["Geladeira", "Cooktop", "Forno", "Micro-ondas", "Coifa", "TV"] },
  { grupo: "eletros", re: /academia|fitness/, itens: ["TV", "Bebedouro", "Ar-condicionado"] },
  { grupo: "eletros", re: /brinquedoteca|kids|jogos/, itens: ["TV"] },
  { grupo: "vidros", re: /piscina/, itens: ["Guarda-corpo de vidro"] },
  { grupo: "vidros", re: /hall/, itens: ["Porta de vidro"] },
  { grupo: "vidros", re: /academia|fitness/, itens: ["Espelho"] },
  { grupo: "metais", re: /lavanderia|servi[cç]o/, itens: ["Tanque", "Torneira", "Registro"] },
  { grupo: "metais", re: /cozinha|gourmet/, itens: ["Torneira", "Cuba", "Lixeira", "Torre de tomadas", "Registro"] },
  { grupo: "metais", re: /lavabo|toalete/, itens: ["Torneira", "Cuba", "Registro", "Monocomando", "Toalheiro rosto", "Porta papel higiênico", "Ducha higiênica"] },
  { grupo: "metais", re: /bwc|banheiro|wc|su[ií]te/, itens: BANHO },
  { grupo: "eletros", re: /cozinha/, itens: ["Geladeira", "Cooktop", "Coifa", "Forno", "Micro-ondas", "Lava-louças"] },
  { grupo: "eletros", re: /gourmet/, itens: ["Cooktop", "Adega", "TV"] },
  { grupo: "eletros", re: /lavanderia|servi[cç]o/, itens: ["Máquina de lavar", "Secadora"] },
  { grupo: "eletros", re: /su[ií]te|quarto|sala|estar|office|dormit/, itens: ["TV"] },
  { grupo: "vidros", re: /sacada|varanda|terra[cç]o/, itens: ["Envidraçamento de sacada", "Guarda-corpo de vidro"] },
  { grupo: "vidros", re: /bwc|banheiro|wc|lavabo|su[ií]te|est[uú]dio/, itens: ["Box de banho"] },
  { grupo: "vidros", re: /gourmet|living|sala|estar/, itens: ["Guarda-corpo de vidro"] },
];
export const sugestoesDoAmbiente = (grupo: Grupo, ambiente: string) => (PADROES.find((p) => p.grupo === grupo && p.re.test(fold(ambiente))) ?? { itens: [] }).itens;

const MATERIAIS = [
  "registro", "torneira", "misturador", "monocomando", "cuba de apoio", "cuba de embutir", "cuba esculpida", "cuba", "lixeira", "papeleira", "porta papel", "porta-papel",
  "toalheiro", "torre de tomadas", "porta papel higienico", "porta-toalhas", "porta toalhas", "porta-toalha", "chuveiro", "ducha higienica", "ducha", "ralo",
  "vaso sanitario", "vaso", "bacia", "assento", "sifao", "valvula", "engate", "saboneteira", "saboneteiro", "cabide", "bide", "tanque", "lavatorio", "banheira",
  "desviador", "acabamento", "kit", "cuba gourmet", "geladeira", "refrigerador", "freezer", "cooktop", "fogao", "forno", "coifa", "depurador", "micro-ondas",
  "microondas", "micro ondas", "lava-loucas", "lava loucas", "lava-roupas", "maquina de lavar", "maquina de lavar e secar", "lava e seca", "secadora", "lavadora",
  "adega", "cervejeira", "frigobar", "purificador", "filtro", "smart tv", "tv", "televisao", "ar-condicionado", "ar condicionado", "exaustor", "ventilador",
  "soundbar", "home theater", "aspirador", "triturador", "lareira", "box de banho", "box", "envidracamento", "guarda-corpo", "guarda corpo", "espelho",
  "divisoria", "porta de vidro", "fechamento",
].sort((a, b) => b.length - a.length);
const MARCAS = [
  "docol", "deca", "lorenzetti", "roca", "celite", "hansgrohe", "grohe", "franke", "tramontina", "brastemp", "electrolux", "consul", "fischer", "crissair",
  "samsung", "lg", "philips", "tecno", "panasonic", "midea", "whirlpool", "bosch", "smeg", "gaggenau", "britania", "mondial", "oster", "hamilton beach",
  "techhouse", "elgin", "tigre", "astra", "fabrimar", "perflex", "portinari", "eliane", "ecosan", "jacuzzi", "kohler", "duravit", "jbl",
];
const reMat = (m: string) => m.replace(/[-\s]/g, "[-\\s]?");
const maiuscula1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Primeiro material conhecido nas 4 primeiras palavras (devolve o trecho como foi digitado). */
function acharMaterial(texto: string) {
  const f = fold(texto);
  const ini = texto.split(/\s+/).slice(0, 4).join(" ").length;
  let melhor: { pos: number; len: number } | null = null;
  for (const m of MATERIAIS) {
    const x = new RegExp("(^|[^a-z0-9])(" + reMat(m) + ")(?![a-z0-9])").exec(f);
    if (!x) continue;
    const pos = x.index + x[1].length;
    if (pos <= ini && (!melhor || pos < melhor.pos || (pos === melhor.pos && x[2].length > melhor.len))) melhor = { pos, len: x[2].length };
  }
  return melhor ? texto.slice(melhor.pos, melhor.pos + melhor.len) : "";
}
function comecaComMaterial(f: string) {
  const t = fold(f).replace(/^\s*(\d+\s*[x×]?\s+)?/, "");
  return MATERIAIS.some((m) => new RegExp("^" + reMat(m) + "(?![a-z0-9])").test(t));
}

export type ItemTexto = { ambiente: string; material: string; referencia: string; medidas: string; qtd: number };

function entenderItem(txt: string, comMedidas: boolean): Omit<ItemTexto, "ambiente"> | null {
  let t = txt.trim().replace(/\s+/g, " ");
  if (!t) return null;
  let qtd = 1;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d+)\s*(?:x|×|un\.?|unid\.?|unidades?|pe[cç]as?)\s+(?=\D)/i))) {
    qtd = +m[1];
    t = t.slice(m[0].length);
  } else if ((m = t.match(/\s+[x×]\s*(\d+)\s*$/i)) || (m = t.match(/\s+(\d+)\s*(?:un\.?|unid\.?|unidades?|pe[cç]as?)\s*$/i))) {
    qtd = +m[1];
    t = t.slice(0, m.index);
  }
  let medidas = "";
  if (comMedidas) {
    if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?/i))) {
      medidas = `Altura: ${m[1]} cm\nLargura: ${m[2]} cm\nProfundidade: ${m[3]} cm`;
      t = (t.slice(0, m.index) + " " + t.slice(m.index! + m[0].length)).trim();
    } else {
      const partes: string[] = [];
      for (const [re, rot] of [["alt(?:ura)?", "Altura"], ["larg(?:ura)?", "Largura"], ["prof(?:undidade)?", "Profundidade"]]) {
        const x = t.match(new RegExp("\\b" + re + "\\.?\\s*:?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:cm)?", "i"));
        if (x) {
          partes.push(`${rot}: ${x[1]} cm`);
          t = (t.slice(0, x.index) + " " + t.slice(x.index! + x[0].length)).trim();
        }
      }
      medidas = partes.join("\n");
    }
  }
  t = t.replace(/\s{2,}/g, " ").replace(/^[\s,;\-–]+|[\s,;\-–]+$/g, "");
  const marca = MARCAS.find((b) => new RegExp("(^|\\s)[-–]?\\s*" + b + "$", "i").test(fold(t)));
  if (marca) t = t.replace(new RegExp("\\s*[-–]?\\s*" + marca + "$", "i"), "") + " - " + marca.toUpperCase();
  return { material: acharMaterial(t).toUpperCase(), referencia: maiuscula1(t), medidas, qtd: Math.max(1, qtd) };
}

/** Uma linha por ambiente ("Lavabo: torneira ...; cuba ..."); sem "ambiente:" usa o ambiente da linha anterior (ou o padrão). */
export function entenderTexto(texto: string, grupo: Grupo, ambientePadrao = ""): ItemTexto[] {
  const comMedidas = GRUPOS.find((g) => g.id === grupo)?.medidas ?? false;
  const saida: ItemTexto[] = [];
  let ambiente = ambientePadrao;
  for (const linha of texto.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    const m = linha.match(/^([^:;]{2,40}?)\s*:\s*(.+)$/);
    let corpo = linha;
    if (m && m[1].trim().split(/\s+/).length <= 5 && !comecaComMaterial(m[1])) {
      ambiente = tituloAmbiente(m[1]);
      corpo = m[2];
    }
    const frags: string[] = [];
    for (const parte of corpo.split(/\s*;\s*/))
      for (const f of parte.split(/\s*(?:(?<!\d),|,(?!\d))\s*/)) {
        if (!f.trim()) continue;
        if (!frags.length || comecaComMaterial(f)) frags.push(f);
        else frags[frags.length - 1] += ", " + f;
      }
    for (const f of frags) {
      const it = entenderItem(f, comMedidas);
      if (it) saida.push({ ambiente, ...it });
    }
  }
  return saida;
}
