import Link from "next/link";
import { exigirPerfil } from "@/lib/contratos/server";
import NovoContratoForm from "./NovoContratoForm";
import { proximoNumeroContrato } from "@/lib/contratos/util";

export default async function NovoContratoPage() {
  const { supabase } = await exigirPerfil(["ADMIN"]);
  const [{ data: empresas }, { data: obras }, { data: contratos }] = await Promise.all([
    supabase.from("empresas_terceirizadas").select("id, nome, especialidade").eq("ativo", true).order("nome"),
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("contratos").select("id, numero, objeto, status, empresa_id, obras(nome)").order("numero"),
  ]);

  // Número do contrato: sempre o maior já usado (todas as obras) + 1. O servidor confirma na hora de salvar.
  const sugestao = proximoNumeroContrato((contratos ?? []).map((c: any) => c.numero));

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/contratos" className="text-xs text-primary hover:underline">← Contratos</Link>
        <h1 className="text-xl font-semibold text-primaryDark">Novo contrato</h1>
        <p className="text-sm text-ink-500">Depois de salvar, você inclui os itens de serviço, quantidades e valores.</p>
      </div>
      {(empresas ?? []).length === 0 ? (
        <div className="card text-sm">
          Nenhuma empresa ativa cadastrada. <Link href="/admin/empresas" className="text-primary underline">Cadastre a empresa primeiro →</Link>
        </div>
      ) : (
        <NovoContratoForm
          empresas={empresas ?? []}
          obras={obras ?? []}
          contratos={(contratos ?? []).map((c: any) => ({ id: c.id, numero: c.numero, objeto: c.objeto, status: c.status, empresa_id: c.empresa_id, obra_nome: c.obras?.nome ?? "—" }))}
          sugestaoNumero={sugestao}
        />
      )}
    </div>
  );
}
