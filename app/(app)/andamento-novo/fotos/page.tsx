import { createClient } from "@/lib/supabase/server";
import FotosPanel from "@/app/(app)/andamento-obra/FotosPanel";
import type { FotoObra } from "@/app/(app)/andamento-obra/types";
import ObraSelect from "../ObraSelect";
import { listarObrasAndamento } from "../obrasAndamento";

// Fotos continuam as mesmas (tabela obra_fotos): sem mudança de tela nesta fase.
export default async function FotosNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const supabase = createClient();
  const obras = await listarObrasAndamento(supabase);
  const obra = (obras ?? []).find((o) => o.id === searchParams.obra) ?? (obras ?? [])[0];
  if (!obra) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;

  // as fotos ficam na obra do cadastro geral a que esta obra está ligada
  if (!obra.obra_geral_id)
    return (
      <div className="space-y-3">
        <ObraSelect obras={obras} atual={obra.id} />
        <div className="card text-sm text-ink-500">Esta obra não está ligada a uma obra do cadastro geral, então ainda não tem fotos.</div>
      </div>
    );
  const { data: rows } = await supabase
    .from("obra_fotos")
    .select("id, data_foto, legenda, storage_path, criado_por")
    .eq("obra_id", obra.obra_geral_id)
    .order("data_foto", { ascending: false })
    .order("criado_em", { ascending: false });
  const caminhos = (rows ?? []).map((f) => f.storage_path);
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
  const ids = Array.from(new Set((rows ?? []).map((r) => r.criado_por).filter(Boolean))) as string[];
  const { data: nomes } = ids.length ? await supabase.rpc("nomes_perfis", { uids: ids }) : { data: [] as { id: string; nome_completo: string }[] };
  const nome = new Map(((nomes ?? []) as { id: string; nome_completo: string }[]).map((n) => [n.id, n.nome_completo]));

  const fotos: FotoObra[] = (rows ?? [])
    .filter((f) => url.get(f.storage_path))
    .map((f) => ({
      id: f.id,
      data_foto: f.data_foto,
      legenda: f.legenda,
      storage_path: f.storage_path,
      url: url.get(f.storage_path)!,
      autor_nome: f.criado_por ? nome.get(f.criado_por) ?? null : null,
    }));

  return (
    <div className="space-y-3">
      <ObraSelect obras={obras} atual={obra.id} />
      <FotosPanel obraId={obra.obra_geral_id} obraNome={obra.nome} fotos={fotos} />
    </div>
  );
}
