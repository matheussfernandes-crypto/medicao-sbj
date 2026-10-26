import { createClient } from "@/lib/supabase/server";
import ObraSelect from "../ObraSelect";
import { listarObrasAndamento } from "../obrasAndamento";
import type { LinhaLog } from "../relatorio/tiposApi";
import ListaRelatorios from "./ListaRelatorios";

export const dynamic = "force-dynamic";

// Registro dos relatórios gerados (PDF) e enviados por e-mail. Só consulta: nada aqui edita nem apaga.
export default async function RelatoriosGeradosPage({ searchParams }: { searchParams: { obra?: string; todas?: string } }) {
  const supabase = createClient();
  const obras = await listarObrasAndamento(supabase);
  const obra = obras.find((o) => o.id === searchParams.obra) ?? obras[0];
  if (!obra) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada no Andamento de Obra (novo).</div>;
  const todas = searchParams.todas === "1";

  // obra excluída do Andamento novo não aparece na lista (os registros dela continuam guardados)
  let consulta = supabase.from("andamento_novo_relatorio_log").select("*").order("criado_em", { ascending: false }).limit(1000);
  consulta = todas ? consulta.in("obra_id", obras.map((o) => o.id)) : consulta.eq("obra_id", obra.id);
  const { data } = await consulta;
  const linhas = (data ?? []) as LinhaLog[];

  const caminhos = Array.from(new Set(linhas.map((l) => l.pdf_path).filter(Boolean))) as string[];
  const { data: assinadas } = caminhos.length ? await supabase.storage.from("andamento-relatorios").createSignedUrls(caminhos, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
  const comUrl = linhas.map((l) => ({ ...l, url: l.pdf_path ? url.get(l.pdf_path) ?? null : null }));

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <ObraSelect obras={obras.map((o) => ({ id: o.id, nome: o.nome }))} atual={obra.id} />
      </div>
      <ListaRelatorios linhas={comUrl} obraId={obra.id} obraNome={obra.nome} todas={todas} />
    </div>
  );
}
