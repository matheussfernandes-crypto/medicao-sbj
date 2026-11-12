import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Ligação da Agenda do Pós-venda com o Google Agenda (sentido site → Google).
// A pessoa escolhe uma agenda que já usa (a que o encarregado também vê). Regras para não bagunçar o que existe:
// - o site só mexe em eventos que ele mesmo criou (marcados com sbj=1 e id próprio);
// - só vão para o Google as visitas marcadas ou alteradas no site depois da ligação (as antigas já estão lá).

export const ESCOPOS = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");
const FUSO = "America/Sao_Paulo";
const JANELA_DIAS = 30; // visitas de até 30 dias atrás em diante
const API = "https://www.googleapis.com/calendar/v3";

export function configGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const segredo = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !segredo) return null;
  return { clientId, segredo };
}

export function urlRetorno(origem: string) {
  return `${origem}/api/google-agenda/retorno`;
}

// ---------- autorização guardada cifrada (a chave só existe no servidor) ----------
function chave() {
  const c = configGoogle();
  if (!c) throw new Error("Google não configurado");
  return createHash("sha256").update("sbj-google-agenda:" + (process.env.GOOGLE_TOKEN_KEY || c.segredo)).digest();
}
export function cifra(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}
export function decifra(guardado: string) {
  const [iv, tag, dados] = guardado.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

// ---------- chamadas ao Google ----------
export async function trocaCodigo(codigo: string, origem: string) {
  const c = configGoogle()!;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: codigo, client_id: c.clientId, client_secret: c.segredo, redirect_uri: urlRetorno(origem), grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || "Falha ao autorizar");
  let email = "";
  try {
    email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString("utf8")).email ?? "";
  } catch {}
  return { refresh: j.refresh_token as string | undefined, acesso: j.access_token as string, email, escopos: String(j.scope || "") };
}

async function tokenDeAcesso(refresh: string) {
  const c = configGoogle()!;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refresh, client_id: c.clientId, client_secret: c.segredo, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error === "invalid_grant" ? "A autorização do Google expirou ou foi removida. Conecte de novo." : j.error_description || "Falha no Google");
  return j.access_token as string;
}

export async function revoga(refresh: string) {
  await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(refresh), { method: "POST" }).catch(() => {});
}

async function g(token: string, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { Authorization: "Bearer " + token, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const texto = await r.text();
  const j = texto ? JSON.parse(texto) : {};
  return { status: r.status, ok: r.ok, j };
}

// agendas da pessoa em que ela pode criar eventos (dona ou com permissão de editar)
export async function listaAgendas(tokenCifrado: string) {
  const token = await tokenDeAcesso(decifra(tokenCifrado));
  const r = await g(token, "GET", "/users/me/calendarList?minAccessRole=writer&maxResults=250");
  if (!r.ok) throw new Error(r.j?.error?.message || "Não foi possível ler as agendas do Google");
  return ((r.j.items ?? []) as any[])
    .map((c) => ({ id: String(c.id), nome: String(c.summaryOverride || c.summary || c.id), principal: !!c.primary, cor: String(c.backgroundColor || "") }))
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------- montagem dos eventos a partir das visitas ----------
type Doc = { id: string; dados: Record<string, any>; atualizado_em?: string };
const TIPO: Record<string, string> = { vistoria: "Vistoria", execucao: "Execução do serviço", retorno: "Retorno" };

export type Base = { ag: Doc[]; ch: Map<string, any>; uni: Map<string, any>; emp: Map<string, any>; resp: Map<string, any> };

export async function carregaBase(supabase: SupabaseClient): Promise<Base> {
  const le = async (col: string) => {
    const itens: Doc[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from("posvenda_docs").select("id, dados, atualizado_em").eq("colecao", col).order("id").range(de, de + 999);
      if (error) throw new Error("Não foi possível ler a agenda do site");
      itens.push(...((data ?? []) as Doc[]));
      if (!data || data.length < 1000) break;
    }
    return itens;
  };
  const [ag, ch, uni, emp, resp] = await Promise.all(["agenda", "chamados", "unidades", "empreendimentos", "responsaveis"].map(le));
  const mapa = (l: Doc[]) => new Map(l.map((d) => [d.id, d.dados]));
  return { ag, ch: mapa(ch), uni: mapa(uni), emp: mapa(emp), resp: mapa(resp) };
}

// id do evento no Google sai do id da visita (só letras a-v e números): o mesmo evento é sempre atualizado
export const idEvento = (visitaId: string) => "sbj" + Buffer.from(visitaId, "utf8").toString("hex");

function inicioJanela() {
  const d = new Date(Date.now() - JANELA_DIAS * 864e5);
  return d.toISOString().slice(0, 10);
}

function somaDia(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function somaHora(data: string, hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const fim = h + 1;
  if (fim >= 24) return { date: undefined, dateTime: `${data}T23:59:00` };
  return { dateTime: `${data}T${String(fim).padStart(2, "0")}:${String(m).padStart(2, "0")}:00` };
}

export function eventoDaVisita(v: Doc, b: Base) {
  const a = v.dados;
  if (!a || a.status === "cancelado" || !/^\d{4}-\d{2}-\d{2}$/.test(a.data || "")) return null;
  const c = b.ch.get(a.chId) || {};
  const u = b.uni.get(c.uniId) || {};
  const e = b.emp.get(c.empId) || {};
  const r = b.resp.get(a.respId) || {};
  const unidade = u.numero ? (u.bloco ? `Bl. ${u.bloco} · ` : "") + u.numero : "";
  const feita = a.status === "concluido";
  const summary = [(feita ? "✓ " : "") + (TIPO[a.tipo] || "Visita"), e.nome, unidade, r.nome].filter(Boolean).join(" · ");
  const description = [
    c.num ? `Chamado #${c.num}${c.cat ? " · " + c.cat : ""}` : "",
    c.amb ? "Ambiente: " + c.amb : "",
    c.desc ? String(c.desc).slice(0, 600) : "",
    r.nome ? `Responsável: ${r.nome}${r.esp ? " (" + r.esp + ")" : ""}` : "",
    feita ? "Visita realizada." : "",
    "",
    "Marcado pelo site SBJ. Para alterar, use a Agenda do Pós-venda no site: mudanças feitas aqui no Google são substituídas.",
  ]
    .filter((x, i, l) => x || (i > 0 && l[i - 1]))
    .join("\n");
  const hora = /^\d{2}:\d{2}$/.test(a.hora || "") ? a.hora : "";
  const start = hora ? { dateTime: `${a.data}T${hora}:00`, timeZone: FUSO } : { date: a.data };
  const end = hora ? { ...somaHora(a.data, hora), timeZone: FUSO } : { date: somaDia(a.data) };
  const corpo = { summary, description, start, end, status: "confirmed", colorId: feita ? "8" : undefined, transparency: "opaque" };
  const h = createHash("sha1").update(JSON.stringify(corpo)).digest("hex").slice(0, 16);
  return { id: idEvento(v.id), ...corpo, extendedProperties: { private: { sbj: "1", h } } };
}

type Evento = NonNullable<ReturnType<typeof eventoDaVisita>>;

async function grava(token: string, cal: string, ev: Evento) {
  const base = "/calendars/" + encodeURIComponent(cal) + "/events";
  const up = await g(token, "PUT", `${base}/${ev.id}`, ev);
  if (up.ok) return;
  if (up.status === 404) {
    const ins = await g(token, "POST", base, ev);
    if (ins.ok) return;
    throw new Error(ins.j?.error?.message || "Falha ao criar evento");
  }
  throw new Error(up.j?.error?.message || "Falha ao atualizar evento");
}

async function apaga(token: string, cal: string, id: string) {
  const r = await g(token, "DELETE", "/calendars/" + encodeURIComponent(cal) + "/events/" + id);
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(r.j?.error?.message || "Falha ao remover evento");
}

async function emLotes<T>(itens: T[], fn: (x: T) => Promise<void>, n = 5) {
  for (let i = 0; i < itens.length; i += n) await Promise.all(itens.slice(i, i + n).map(fn));
}

export type Conexao = { usuario_id: string; token_cifrado: string; calendario_id: string; conectado_em: string };

// Confere a agenda Google com a do site. Só entram visitas mexidas no site depois da ligação
// (ou que o site já tinha mandado); eventos que não são do site nunca são tocados.
export async function reconcilia(con: Conexao, b: Base) {
  if (!con.calendario_id) return { gravados: 0, apagados: 0, total: 0 };
  const token = await tokenDeAcesso(decifra(con.token_cifrado));
  const ini = inicioJanela();
  const desde = new Date(con.conectado_em).getTime();
  // eventos do site que já estão no Google
  const atuais = new Map<string, string>();
  let pagina = "";
  do {
    const q = new URLSearchParams({ privateExtendedProperty: "sbj=1", timeMin: `${ini}T00:00:00-03:00`, maxResults: "2500", singleEvents: "true" });
    if (pagina) q.set("pageToken", pagina);
    const r = await g(token, "GET", "/calendars/" + encodeURIComponent(con.calendario_id) + "/events?" + q, undefined);
    if (!r.ok) throw new Error(r.status === 404 ? "A agenda SBJ · Pós-venda foi apagada no Google. Desconecte e conecte de novo." : r.j?.error?.message || "Falha ao ler o Google");
    for (const it of r.j.items ?? []) atuais.set(it.id, it.extendedProperties?.private?.h ?? "");
    pagina = r.j.nextPageToken ?? "";
  } while (pagina);

  const desejados = new Map<string, Evento>();
  for (const v of b.ag) {
    if ((v.dados?.data || "") < ini) continue;
    const nova = v.atualizado_em ? new Date(v.atualizado_em).getTime() >= desde : false;
    if (!nova && !atuais.has(idEvento(v.id))) continue; // visita antiga: já está no Google pelo uso de antes
    const ev = eventoDaVisita(v, b);
    if (ev) desejados.set(ev.id, ev);
  }
  const gravar = [...desejados.values()].filter((ev) => atuais.get(ev.id) !== ev.extendedProperties.private.h);
  const apagar = [...atuais.keys()].filter((id) => !desejados.has(id));
  await emLotes(gravar, (ev) => grava(token, con.calendario_id, ev));
  await emLotes(apagar, (id) => apaga(token, con.calendario_id, id));
  return { gravados: gravar.length, apagados: apagar.length, total: desejados.size };
}

// Uma visita mudou no site: atualiza só ela na agenda Google de cada pessoa conectada.
export async function propagaVisita(supabase: SupabaseClient, visitaId: string) {
  if (!configGoogle()) return;
  const { data: cons } = await supabase.rpc("google_agenda_conexoes_ativas");
  if (!cons?.length) return;
  const b = await carregaBase(supabase);
  const v = b.ag.find((x) => x.id === visitaId);
  const ev = v ? eventoDaVisita(v, b) : null;
  await Promise.all(
    (cons as Conexao[]).map(async (con) => {
      try {
        const token = await tokenDeAcesso(decifra(con.token_cifrado));
        if (ev) await grava(token, con.calendario_id, ev);
        else await apaga(token, con.calendario_id, idEvento(visitaId));
        await supabase.rpc("google_agenda_registrar", { p_usuario: con.usuario_id, p_erro: null });
      } catch (e) {
        await supabase.rpc("google_agenda_registrar", { p_usuario: con.usuario_id, p_erro: String((e as Error).message || e).slice(0, 300) });
      }
    }),
  );
}

// sem travar o salvamento do site: espera no máximo alguns segundos
export async function semTravar(p: Promise<unknown>, ms = 6000) {
  await Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}

export function origemDa(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}
