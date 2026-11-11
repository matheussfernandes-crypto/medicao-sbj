import { NextRequest, NextResponse } from "next/server";
import { agoraComFolga, desdeValido, erro, exigirUsuario } from "./server";

// Clientes do módulo de vistorias = unidades do cadastro do Pós-venda (posvenda_docs, coleção "unidades").
// É um cadastro só: o que se edita num lugar aparece no outro. Os empreendimentos dos dois lados são
// ligados pelo nome (sem "Residencial", acentos e maiúsculas). Nenhuma vistoria muda de id.

type Doc = { id: string; dados: Record<string, any>; atualizado_em?: string };

export const normNome = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*(residencial|edificio|ed\.?)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

async function lerDocs(supabase: any, colecao: string, desde?: string | null): Promise<Doc[]> {
  const out: Doc[] = [];
  for (let de = 0; ; de += 1000) {
    let q = supabase.from("posvenda_docs").select("id, dados, atualizado_em").eq("colecao", colecao).order("id").range(de, de + 999);
    if (desde) q = q.gt("atualizado_em", desde);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// obra do Pós-obra (b1, b2...) <-> empreendimento do Pós-venda. A ligação fica gravada no empreendimento
// (campo obraId), então renomear de um lado não quebra nada. O nome só serve para a primeira ligação.
async function ligacoes(supabase: any) {
  const [{ data: obras, error }, emps] = await Promise.all([
    supabase.from("posobra_obras").select("id, nome").is("excluido_em", null),
    lerDocs(supabase, "empreendimentos"),
  ]);
  if (error) throw new Error(error.message);
  const obraPorId = new Map<string, { id: string; nome: string }>((obras ?? []).map((o: any) => [String(o.id), o]));
  const obraPorNome = new Map<string, { id: string; nome: string }>((obras ?? []).map((o: any) => [normNome(o.nome), o]));
  const obraDoEmp = new Map<string, string>();
  const empDaObra = new Map<string, string>();
  for (const e of emps) {
    const o = (e.dados?.obraId && obraPorId.get(String(e.dados.obraId))) || obraPorNome.get(normNome(e.dados?.nome));
    if (!o) continue;
    if (e.dados?.obraId !== o.id) {
      // grava a ligação uma vez (idempotente)
      await supabase.rpc("posvenda_gravar", { p_colecao: "empreendimentos", p_id: e.id, p_dados: { obraId: o.id }, p_modo: "merge" });
    }
    obraDoEmp.set(e.id, o.id);
    empDaObra.set(o.id, e.id);
  }
  return { obras: (obras ?? []) as { id: string; nome: string }[], obraDoEmp, empDaObra };
}

// GET ?desde=ISO -> { agora, registros, excluidos } no formato de cliente do módulo
export async function GET(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const desde = desdeValido(req.nextUrl.searchParams.get("desde"));
  const agora = agoraComFolga();
  try {
    const { obraDoEmp } = await ligacoes(u.supabase);
    const unidades = await lerDocs(u.supabase, "unidades", desde);
    const registros = unidades
      .filter((x) => obraDoEmp.has(x.dados?.empId))
      .map((x) => {
        const d = x.dados || {};
        return {
          id: x.id,
          buildingId: obraDoEmp.get(d.empId),
          unit: String(d.numero ?? ""),
          garage: String(d.garagem ?? ""),
          name: String(d.prop ?? ""),
          phone: String(d.contatos || d.tel || ""),
          email: String(d.email ?? ""),
          escritura: "",
          notes: String(d.obs ?? ""),
        };
      });
    return NextResponse.json({ agora, registros, excluidos: [] });
  } catch (e: any) {
    return erro(e?.message || "Não foi possível ler os clientes.");
  }
}

// POST { registros, excluidos } -> grava nas unidades do Pós-venda. Excluir por aqui não apaga nada:
// a unidade pode ter chamados; a exclusão é feita em Administração > Cadastros do pós-venda.
export async function POST(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const corpo = await req.json().catch(() => null);
  const registros: any[] = Array.isArray(corpo?.registros) ? corpo.registros.filter((r: any) => r && r.id && r.buildingId) : [];
  try {
    const { obras, empDaObra } = await ligacoes(u.supabase);
    const agora = new Date().toISOString();
    const ids = registros.map((r) => String(r.id));
    const existentes = new Set<string>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await u.supabase.from("posvenda_docs").select("id").eq("colecao", "unidades").in("id", ids.slice(i, i + 300));
      if (error) throw new Error(error.message);
      (data ?? []).forEach((l: any) => existentes.add(l.id));
    }
    let gravados = 0;
    for (const r of registros) {
      let empId = empDaObra.get(String(r.buildingId));
      if (!empId) {
        // obra do Pós-obra que ainda não existe no cadastro do Pós-venda: cria o empreendimento com o mesmo nome
        const obra = obras.find((o) => o.id === String(r.buildingId));
        if (!obra) continue;
        empId = "emp-" + obra.id;
        const { error } = await u.supabase.rpc("posvenda_gravar", {
          p_colecao: "empreendimentos",
          p_id: empId,
          p_dados: { nome: obra.nome.replace(/^\s*residencial\s+/i, "").trim(), status: "entregue", endereco: "", dataEntrega: "", criadoEm: agora, obraId: obra.id },
          p_modo: "merge",
        });
        if (error) throw new Error(error.message);
        empDaObra.set(obra.id, empId);
      }
      const id = String(r.id);
      const dados: Record<string, unknown> = {
        empId,
        numero: String(r.unit ?? "").trim(),
        prop: String(r.name ?? "").trim(),
        contatos: String(r.phone ?? "").trim(),
        email: String(r.email ?? "").trim(),
        garagem: String(r.garage ?? "").trim(),
        obs: String(r.notes ?? "").trim(),
      };
      if (!existentes.has(id)) Object.assign(dados, { bloco: "", tel: "", criadoEm: agora });
      const { error } = await u.supabase.rpc("posvenda_gravar", { p_colecao: "unidades", p_id: id, p_dados: dados, p_modo: "merge" });
      if (error) throw new Error(error.message);
      gravados++;
    }
    return NextResponse.json({ ok: true, gravados, excluidos: 0 });
  } catch (e: any) {
    return erro(e?.message || "Não foi possível gravar os clientes.");
  }
}
