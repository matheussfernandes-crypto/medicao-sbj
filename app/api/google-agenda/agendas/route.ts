import { NextRequest, NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { configGoogle, listaAgendas } from "@/lib/google-agenda";

// Agendas do Google da pessoa (GET) e a escolha de qual recebe as visitas (POST).
export const dynamic = "force-dynamic";

async function conexao() {
  const r = await exigirArquitetura();
  if ("erro" in r) return { erro: r.erro } as const;
  if (!r.pode || !configGoogle()) return { erro: NextResponse.json({ error: "Sem acesso" }, { status: 403 }) } as const;
  const { data: con } = await r.supabase.from("google_agenda_conexoes").select("token_cifrado, calendario_id").eq("usuario_id", r.user.id).maybeSingle();
  if (!con) return { erro: NextResponse.json({ error: "Não conectado" }, { status: 400 }) } as const;
  return { ...r, con } as const;
}

export async function GET() {
  const r = await conexao();
  if ("erro" in r) return r.erro;
  try {
    return NextResponse.json({ atual: r.con.calendario_id, agendas: await listaAgendas(r.con.token_cifrado) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const r = await conexao();
  if ("erro" in r) return r.erro;
  const corpo = await req.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ error: "Escolha uma agenda" }, { status: 400 });
  // confere que a agenda é dela e que ela pode escrever nela
  let ag;
  try {
    ag = (await listaAgendas(r.con.token_cifrado)).find((a) => a.id === id);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
  if (!ag) return NextResponse.json({ error: "Agenda não encontrada ou sem permissão de edição" }, { status: 400 });
  // a partir de agora: visitas marcadas ou alteradas no site vão para essa agenda
  const mudou = ag.id !== r.con.calendario_id;
  const { error } = await r.supabase
    .from("google_agenda_conexoes")
    .update({ calendario_id: ag.id, calendario_nome: ag.nome, ultimo_erro: null, ...(mudou ? { conectado_em: new Date().toISOString() } : {}) })
    .eq("usuario_id", r.user.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true, nome: ag.nome });
}
