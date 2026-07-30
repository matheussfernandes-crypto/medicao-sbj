import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  atribuirResponsavel,
  agendarOS,
  iniciarServico,
  finalizarServico,
  aprovarOS,
  reprovarOS,
  cancelarOS,
  enviarAnexo,
  excluirAnexo,
} from "../../actions";
import {
  SETORES_MODULO,
  SETORES_EXECUTORES,
  SETORES_APROVADORES,
  SOLICITANTE_TIPO_LABEL,
  ORIGEM_LABEL,
  CATEGORIA_LABEL,
  PROBLEMA_LABEL,
  PRIORIDADE_LABEL,
  PRIORIDADE_COR,
  STATUS_LABEL,
  STATUS_COR,
  SERVICO_EXECUTADO_LABEL,
  GARANTIA_LABEL,
  ANEXO_TIPO_LABEL,
} from "../../constants";
import { construirTimeline } from "../../timeline";

export default async function DetalheOSPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sucesso?: string; erro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) redirect("/dashboard");

  const souExecutor = SETORES_EXECUTORES.includes(perfil.setor);
  const souAprovador = SETORES_APROVADORES.includes(perfil.setor);

  const { data: os } = await supabase.from("manutencao_os").select("*").eq("id", params.id).single();
  if (!os) notFound();

  const [{ data: obra }, { data: torre }, { data: pavimento }, { data: unidade }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", os.obra_id).single(),
    os.torre_id ? supabase.from("torres").select("nome").eq("id", os.torre_id).single() : Promise.resolve({ data: null }),
    os.pavimento_id ? supabase.from("pavimentos").select("nome").eq("id", os.pavimento_id).single() : Promise.resolve({ data: null }),
    os.unidade_id ? supabase.from("unidades").select("nome").eq("id", os.unidade_id).single() : Promise.resolve({ data: null }),
  ]);

  const [{ data: funcionarios }, { data: empresas }] = await Promise.all([
    supabase.from("perfis").select("id, nome_completo").in("setor", ["ADMIN", "ARQUITETO", "ENGENHEIRO"]).eq("status", "aprovado").order("nome_completo"),
    supabase.from("empresas_terceirizadas").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  let nomeResponsavel: string | null = null;
  if (os.responsavel_tipo === "FUNCIONARIO" && os.responsavel_perfil_id) {
    nomeResponsavel = (funcionarios ?? []).find((f) => f.id === os.responsavel_perfil_id)?.nome_completo ?? null;
  } else if (os.responsavel_tipo === "EMPRESA" && os.responsavel_empresa_id) {
    nomeResponsavel = (empresas ?? []).find((e) => e.id === os.responsavel_empresa_id)?.nome ?? null;
  }

  const { data: anexos } = await supabase
    .from("manutencao_anexos")
    .select("id, tipo, storage_path, nome_arquivo, criado_em")
    .eq("os_id", os.id)
    .order("criado_em", { ascending: false });

  const anexosComUrl = await Promise.all(
    (anexos ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("manutencao-anexos").createSignedUrl(a.storage_path, 3600);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );

  const { data: logs } = await supabase
    .from("log_auditoria")
    .select("acao, dados_anteriores, dados_novos, feito_por, feito_em")
    .eq("tabela", "manutencao_os")
    .eq("registro_id", os.id)
    .order("feito_em", { ascending: true });

  const idsEnvolvidos = Array.from(
    new Set([...(logs ?? []).map((l) => l.feito_por).filter(Boolean), os.criado_por].filter(Boolean))
  ) as string[];
  const { data: perfisEnvolvidos } = idsEnvolvidos.length
    ? await supabase.from("perfis").select("id, nome_completo").in("id", idsEnvolvidos)
    : { data: [] as any[] };
  const nomePorId: Record<string, string> = {};
  for (const p of perfisEnvolvidos ?? []) nomePorId[p.id] = p.nome_completo;

  const timeline = construirTimeline((logs ?? []) as any, nomePorId);

  const local = [torre?.nome, pavimento?.nome, unidade?.nome].filter(Boolean).join(" — ") || os.area_comum_texto || "—";

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-primaryDark">OS #{os.numero_os}</h1>
          <p className="text-sm text-ink-500">{obra?.nome} — criada em {new Date(os.criado_em).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block text-xs px-2 py-1 rounded-full font-semibold ${PRIORIDADE_COR[os.prioridade] ?? ""}`}>
            {PRIORIDADE_LABEL[os.prioridade] ?? os.prioridade}
          </span>
          <span className={`badge ${STATUS_COR[os.status] ?? ""}`}>{STATUS_LABEL[os.status] ?? os.status}</span>
          <a
            href={`/manutencoes/os/${os.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-200 rounded px-3 py-1.5 text-sm font-semibold"
          >
            Exportar PDF
          </a>
        </div>
      </div>

      {searchParams.sucesso && <div className="card bg-green-50 border border-green-200 text-green-700 text-sm">{searchParams.sucesso}</div>}
      {searchParams.erro && <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">{searchParams.erro}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card space-y-1">
          <h2 className="font-semibold text-primaryDark mb-1">Solicitante</h2>
          <p className="text-sm"><span className="text-ink-500">Nome:</span> {os.solicitante_nome}</p>
          <p className="text-sm"><span className="text-ink-500">Telefone:</span> {os.solicitante_telefone}</p>
          <p className="text-sm"><span className="text-ink-500">Tipo:</span> {SOLICITANTE_TIPO_LABEL[os.solicitante_tipo] ?? os.solicitante_tipo}</p>
          <p className="text-sm"><span className="text-ink-500">Origem:</span> {ORIGEM_LABEL[os.origem] ?? os.origem}</p>
        </div>
        <div className="card space-y-1">
          <h2 className="font-semibold text-primaryDark mb-1">Local e problema</h2>
          <p className="text-sm"><span className="text-ink-500">Local:</span> {local}</p>
          <p className="text-sm"><span className="text-ink-500">Categoria:</span> {CATEGORIA_LABEL[os.categoria] ?? os.categoria}</p>
          <p className="text-sm"><span className="text-ink-500">Problema:</span> {PROBLEMA_LABEL[os.problema] ?? os.problema}</p>
          {os.descricao && <p className="text-sm"><span className="text-ink-500">Descrição:</span> {os.descricao}</p>}
        </div>
      </div>

      {/* Responsável */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Responsável</h2>
        {nomeResponsavel ? (
          <p className="text-sm">
            {os.responsavel_tipo === "EMPRESA" ? "Empresa terceirizada" : "Funcionário SBJ"}: <span className="font-semibold">{nomeResponsavel}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-400">Ainda não atribuído.</p>
        )}
        {souExecutor && os.status !== "CONCLUIDA" && os.status !== "CANCELADA" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
            <form action={atribuirResponsavel} className="flex gap-2 items-end">
              <input type="hidden" name="id" value={os.id} />
              <input type="hidden" name="responsavelTipo" value="FUNCIONARIO" />
              <div className="flex-1">
                <label className="text-xs text-ink-500 block mb-1">Atribuir funcionário SBJ</label>
                <select name="responsavelPerfilId" className="border rounded px-2 py-1.5 w-full text-sm" defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {(funcionarios ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome_completo}</option>)}
                </select>
              </div>
              <button className="bg-gray-200 rounded px-3 py-1.5 text-sm">Atribuir</button>
            </form>
            <form action={atribuirResponsavel} className="flex gap-2 items-end">
              <input type="hidden" name="id" value={os.id} />
              <input type="hidden" name="responsavelTipo" value="EMPRESA" />
              <div className="flex-1">
                <label className="text-xs text-ink-500 block mb-1">Atribuir empresa terceirizada</label>
                <select name="responsavelEmpresaId" className="border rounded px-2 py-1.5 w-full text-sm" defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <button className="bg-gray-200 rounded px-3 py-1.5 text-sm">Atribuir</button>
            </form>
          </div>
        )}
      </div>

      {/* Ações conforme status */}
      {souExecutor && (os.status === "ABERTA" || os.status === "AGENDADA") && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-primaryDark">Agendar / Iniciar</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <form action={agendarOS} className="flex gap-2 items-end">
              <input type="hidden" name="id" value={os.id} />
              <div>
                <label className="text-xs text-ink-500 block mb-1">Agendar para</label>
                <input type="datetime-local" name="agendadoPara" className="border rounded px-2 py-1.5 text-sm" defaultValue={os.agendado_para?.slice(0, 16) ?? ""} />
              </div>
              <button className="bg-gray-200 rounded px-3 py-1.5 text-sm">Salvar agenda</button>
            </form>
            <form action={iniciarServico}>
              <input type="hidden" name="id" value={os.id} />
              <button className="bg-primary text-white rounded px-4 py-1.5 text-sm font-semibold">Iniciar Serviço</button>
            </form>
            <form action={cancelarOS}>
              <input type="hidden" name="id" value={os.id} />
              <button className="text-red-600 underline text-sm">Cancelar OS</button>
            </form>
          </div>
        </div>
      )}

      {souExecutor && (os.status === "EM_ANDAMENTO" || os.status === "AGUARDANDO_MATERIAL" || os.status === "AGUARDANDO_EMPRESA") && (
        <form action={finalizarServico} className="card space-y-3">
          <input type="hidden" name="id" value={os.id} />
          <h2 className="font-semibold text-primaryDark">Finalização</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-500 block mb-1">Serviço executado</label>
              <select name="servicoExecutado" className="border rounded px-2 py-1.5 w-full text-sm" defaultValue="">
                <option value="" disabled>Selecione…</option>
                {Object.entries(SERVICO_EXECUTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-500 block mb-1">Classificação de garantia</label>
              <select name="garantiaClassificacao" className="border rounded px-2 py-1.5 w-full text-sm" defaultValue="">
                <option value="" disabled>Selecione…</option>
                {Object.entries(GARANTIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Materiais utilizados</label>
            <input name="materiaisUtilizados" className="border rounded px-2 py-1.5 w-full text-sm" placeholder="Ex: cano PVC 25mm, silicone…" />
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Observação técnica</label>
            <textarea name="observacaoTecnica" className="border rounded px-2 py-1.5 w-full text-sm h-20 resize-none" placeholder="Detalhes técnicos do que foi feito…" />
          </div>
          <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Finalizar Serviço</button>
        </form>
      )}

      {souAprovador && os.status === "AGUARDANDO_APROVACAO" && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-primaryDark">Aprovação</h2>
          {os.servico_executado && <p className="text-sm"><span className="text-ink-500">Serviço executado:</span> {SERVICO_EXECUTADO_LABEL[os.servico_executado] ?? os.servico_executado}</p>}
          {os.materiais_utilizados && <p className="text-sm"><span className="text-ink-500">Materiais:</span> {os.materiais_utilizados}</p>}
          {os.observacao_tecnica && <p className="text-sm"><span className="text-ink-500">Observação técnica:</span> {os.observacao_tecnica}</p>}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <form action={aprovarOS}>
              <input type="hidden" name="id" value={os.id} />
              <button className="bg-primary text-white rounded px-4 py-1.5 text-sm font-semibold">Aprovar</button>
            </form>
            <form action={reprovarOS} className="flex gap-2 items-center">
              <input type="hidden" name="id" value={os.id} />
              <input name="motivo" placeholder="Motivo (opcional)" className="border rounded px-2 py-1.5 text-sm" />
              <button className="bg-gray-200 rounded px-3 py-1.5 text-sm">Reprovar — nova execução</button>
              <button name="negarGarantia" value="1" className="bg-red-100 text-red-700 rounded px-3 py-1.5 text-sm">Negar garantia</button>
            </form>
          </div>
        </div>
      )}

      {os.motivo_reprovacao && (
        <div className="card bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Motivo da reprovação:</strong> {os.motivo_reprovacao}
        </div>
      )}

      {/* Anexos */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Anexos</h2>
        {souExecutor && (
          <form action={enviarAnexo} className="flex flex-wrap gap-2 items-end pb-3 border-b">
            <input type="hidden" name="osId" value={os.id} />
            <div>
              <label className="text-xs text-ink-500 block mb-1">Tipo</label>
              <select name="tipo" className="border rounded px-2 py-1.5 text-sm" defaultValue="FOTO_DURANTE">
                {Object.entries(ANEXO_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-500 block mb-1">Arquivo</label>
              <input type="file" name="arquivo" required className="text-sm" />
            </div>
            <button className="bg-gray-200 rounded px-3 py-1.5 text-sm">Enviar</button>
          </form>
        )}
        {anexosComUrl.length > 0 ? (
          <ul className="space-y-1.5">
            {anexosComUrl.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xs bg-primary/10 text-primaryDark rounded px-1.5 py-0.5 shrink-0">{ANEXO_TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{a.nome_arquivo}</a>
                  ) : (
                    <span className="truncate">{a.nome_arquivo}</span>
                  )}
                </span>
                {souExecutor && (
                  <form action={excluirAnexo}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="osId" value={os.id} />
                    <button className="text-red-500 underline text-xs shrink-0">Excluir</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-400">Nenhum anexo enviado.</p>
        )}
      </div>

      {/* Histórico automático */}
      <div className="card">
        <h2 className="font-semibold text-primaryDark mb-2">Histórico da OS</h2>
        <div className="space-y-2">
          {timeline.map((ev, i) => (
            <div key={i} className="text-sm flex gap-2">
              <span className="text-ink-400 whitespace-nowrap">{new Date(ev.quando).toLocaleString("pt-BR")}</span>
              <span className="text-ink-700">{ev.texto} <span className="text-ink-400">— {ev.quem}</span></span>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-ink-400">Sem eventos registrados.</p>}
        </div>
      </div>
    </div>
  );
}
