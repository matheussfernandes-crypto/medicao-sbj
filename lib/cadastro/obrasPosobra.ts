// Cadastro único de obras -> Pós-obra (Vistorias) e Pós-venda.
// Só leitura: na hora de entregar a lista de obras, o que está preenchido no Cadastro único vale
// por cima da cópia do pós-obra (posobra_obras). Campo vazio no Cadastro mantém o dado de antes.
// Nada é gravado aqui; a cópia do pós-obra continua intacta.

export type CadastroPosobra = {
  id: string;
  posobra_id: string;
  nome: string | null;
  nome_completo: string | null;
  fase: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  unidades: number | null;
  atualizado_em: string | null;
  aparece_vistorias: boolean;
  aparece_posvenda: boolean;
};

export async function cadastrosDoPosobra(supabase: any): Promise<Map<string, CadastroPosobra>> {
  const { data, error } = await supabase
    .from("cadastro_obras")
    .select("id, posobra_id, nome, nome_completo, fase, endereco, bairro, cidade, uf, data_entrega_prevista, data_entrega_real, unidades, atualizado_em, aparece_vistorias, aparece_posvenda")
    .not("posobra_id", "is", null);
  // se o Cadastro não puder ser lido, os módulos seguem com os dados de sempre
  if (error) return new Map();
  return new Map((data ?? []).map((c: CadastroPosobra) => [c.posobra_id, c]));
}

// "Rua X, 97 - Centro, Penha/SC"
export function enderecoCompleto(c: CadastroPosobra) {
  const cidade = [c.cidade, c.uf].filter(Boolean).join("/");
  const local = [c.bairro, cidade].filter(Boolean).join(", ");
  return [c.endereco, local].filter(Boolean).join(" - ");
}

// valores do Cadastro no formato do pós-obra (só os que estão preenchidos)
export function camposDoCadastro(c: CadastroPosobra) {
  const r: { name?: string; address?: string; status?: string; deliveryDate?: string; units?: number } = {};
  if (c.nome_completo) r.name = c.nome_completo;
  const end = enderecoCompleto(c);
  if (end) r.address = end;
  if (c.fase === "entregue") r.status = "concluido";
  else if (c.fase === "obra" || c.fase === "desenvolvimento") r.status = "andamento";
  const entrega = c.data_entrega_real || c.data_entrega_prevista;
  if (entrega) r.deliveryDate = entrega.slice(0, 10);
  if (c.unidades) r.units = c.unidades;
  return r;
}

// registro do pós-obra com os dados do Cadastro por cima; "cadastroId" avisa o módulo que esses campos são do Cadastro
export function sobreporObra<T extends Record<string, any>>(registro: T, c: CadastroPosobra | undefined): T {
  if (!c) return registro;
  return { ...registro, ...camposDoCadastro(c), cadastroId: c.id };
}
