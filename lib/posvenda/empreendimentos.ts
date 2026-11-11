// Empreendimentos: a lista é a das obras do Pós-obra (posobra_obras). Uma lista só: o que muda num lado
// vale no outro. O Pós-venda continua usando os mesmos ids que já tem para as unidades, os chamados e a agenda;
// eles ficam ligados à obra por um documento de ligação (coleção "empreendimentos", campo obraId).

export const nomeKit = (n: unknown) => String(n ?? "").replace(/^\s*residencial\s+/i, "").trim();
export const nomeObra = (n: unknown) => {
  const s = String(n ?? "").trim();
  return /^residencial\s/i.test(s) ? s : "Residencial " + s;
};
const situacaoKit = (s: unknown) => (s === "andamento" ? "obra" : "entregue");
const situacaoObra = (s: unknown) => (s === "obra" ? "andamento" : "concluido");
const chave = (s: unknown) =>
  nomeKit(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

type Obra = { id: string; nome: string; endereco: string | null; status: string | null; data_entrega: string | null; criado_em: string | null; dados: Record<string, any> | null };
type Ligacao = { id: string; dados: Record<string, any> };

async function obras(supabase: any): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("posobra_obras")
    .select("id, nome, endereco, status, data_entrega, criado_em, dados")
    .is("excluido_em", null)
    .order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function ligacoesGravadas(supabase: any): Promise<Ligacao[]> {
  const { data, error } = await supabase.from("posvenda_docs").select("id, dados").eq("colecao", "empreendimentos");
  if (error) throw new Error(error.message);
  return (data ?? []) as Ligacao[];
}

// ligações antigas (só pelo nome) ganham o obraId uma vez; depois disso o nome não importa mais
async function completarLigacoes(supabase: any, lista: Ligacao[], lo: Obra[]) {
  const ligadas = new Set(lista.filter((l) => l.dados?.obraId).map((l) => l.dados.obraId));
  const porNome = new Map(lo.map((o) => [chave(o.nome), o]));
  for (const l of lista) {
    if (l.dados?.obraId) continue;
    const o = porNome.get(chave(l.dados?.nome));
    if (!o || ligadas.has(o.id)) continue;
    ligadas.add(o.id);
    const { error } = await supabase.rpc("posvenda_gravar", {
      p_colecao: "empreendimentos",
      p_id: l.id,
      p_dados: { obraId: o.id },
      p_modo: "merge",
    });
    if (error) throw new Error(error.message);
    l.dados = { ...l.dados, obraId: o.id };
  }
}

// lista para o Pós-venda: cada obra aparece com o id que o Pós-venda já usa para ela
export async function listarEmpreendimentos(supabase: any) {
  const lo = await obras(supabase);
  const lista = await ligacoesGravadas(supabase);
  await completarLigacoes(supabase, lista, lo);
  const idDaObra = new Map<string, string>();
  for (const l of lista) if (l.dados?.obraId) idDaObra.set(l.dados.obraId, l.id);
  return lo.map((o) => ({
    id: idDaObra.get(o.id) ?? o.id,
    dados: {
      nome: nomeKit(o.nome),
      status: situacaoKit(o.status),
      endereco: o.endereco ?? "",
      dataEntrega: o.data_entrega ?? "",
      criadoEm: o.criado_em ?? "",
      obraId: o.id,
    },
  }));
}

// grava um empreendimento do Pós-venda na obra correspondente (cria a obra se for novo)
export async function gravarEmpreendimento(supabase: any, userId: string, kitId: string, dados: Record<string, any>) {
  const agora = new Date().toISOString();
  const lo = await obras(supabase);
  const lista = await ligacoesGravadas(supabase);
  await completarLigacoes(supabase, lista, lo);
  const link = lista.find((l) => l.id === kitId);
  const obra = link?.dados?.obraId ? lo.find((o) => o.id === link.dados.obraId) : lo.find((o) => o.id === kitId);

  if (!obra) {
    const n = Math.max(0, ...lo.map((o) => Number(String(o.id).replace(/^\D+/, "")) || 0)) + 1;
    const id = "b" + n;
    const nome = nomeObra(dados.nome);
    const endereco = dados.endereco || null;
    const status = situacaoObra(dados.status);
    const entrega = dados.dataEntrega || null;
    const { error } = await supabase.from("posobra_obras").insert({
      id,
      nome,
      endereco,
      status,
      data_entrega: entrega,
      dados: { id, name: nome, address: endereco ?? "", status, deliveryDate: entrega ?? "", units: 0, responsible: "", progress: 0, possuiManual: false },
      criado_em: agora,
      atualizado_em: agora,
      atualizado_por: userId,
    });
    if (error) throw new Error(error.message);
    const { error: e2 } = await supabase.rpc("posvenda_gravar", { p_colecao: "empreendimentos", p_id: kitId, p_dados: { obraId: id }, p_modo: "merge" });
    if (e2) throw new Error(e2.message);
    return;
  }

  // altera só o que veio; o que o Pós-obra mantém (progresso, manual etc.) fica como está
  const campos: Record<string, unknown> = {};
  const d: Record<string, any> = { ...(obra.dados ?? {}) };
  if (dados.nome !== undefined) {
    campos.nome = nomeObra(dados.nome);
    d.name = campos.nome;
  }
  if (dados.endereco !== undefined) {
    campos.endereco = dados.endereco || null;
    d.address = dados.endereco || "";
  }
  if (dados.status !== undefined) {
    campos.status = situacaoObra(dados.status);
    d.status = campos.status;
  }
  if (dados.dataEntrega !== undefined) {
    campos.data_entrega = dados.dataEntrega || null;
    d.deliveryDate = dados.dataEntrega || "";
  }
  if (!Object.keys(campos).length) return;
  campos.dados = d;
  campos.atualizado_em = agora;
  campos.atualizado_por = userId;
  const { error } = await supabase.from("posobra_obras").update(campos).eq("id", obra.id);
  if (error) throw new Error(error.message);
}

// exclusão pelo cadastro do Pós-venda: a obra sai das listas, mas nada é apagado (unidades, chamados e histórico ficam)
export async function excluirEmpreendimento(supabase: any, userId: string, kitId: string) {
  const lo = await obras(supabase);
  const lista = await ligacoesGravadas(supabase);
  await completarLigacoes(supabase, lista, lo);
  const link = lista.find((l) => l.id === kitId);
  const obraId = link?.dados?.obraId ?? (lo.some((o) => o.id === kitId) ? kitId : null);
  if (!obraId) throw new Error("Empreendimento não encontrado.");
  const agora = new Date().toISOString();
  const { error } = await supabase.from("posobra_obras").update({ excluido_em: agora, atualizado_em: agora, atualizado_por: userId }).eq("id", obraId);
  if (error) throw new Error(error.message);
}
