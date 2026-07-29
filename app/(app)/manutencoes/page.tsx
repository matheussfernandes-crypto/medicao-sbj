import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GraficoPizza, { type FatiaCategoria } from "@/components/GraficoPizza";
import { SETORES_MODULO, CATEGORIA_LABEL } from "./constants";

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}
function anoAtual() {
  return new Date().getFullYear();
}
function mesLabel(mes: string) {
  const [ano, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano}`;
}
function ultimosMeses(qtd: number, mesFinalISO: string): string[] {
  const meses: string[] = [];
  const [anoStr, mesStr] = mesFinalISO.split("-");
  const d = new Date(Number(anoStr), Number(mesStr) - 1, 1);
  for (let i = 0; i < qtd; i++) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    meses.unshift(`${ano}-${mes}`);
    d.setMonth(d.getMonth() - 1);
  }
  return meses;
}

const CORES = ["#2c6975", "#f4dd3d", "#c8763e", "#8a94a6", "#6b8e9e", "#b45f5f", "#7a9e5f"];

export default async function ManutencoesDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) redirect("/dashboard");

  const mes = mesAtualISO();
  const ano = anoAtual();

  const [{ data: obras }, { data: empresas }, { data: funcionarios }, { data: todasOS }] = await Promise.all([
    supabase.from("obras").select("id, nome"),
    supabase.from("empresas_terceirizadas").select("id, nome"),
    supabase.from("perfis").select("id, nome_completo"),
    supabase
      .from("manutencao_os")
      .select("id, obra_id, categoria, status, criado_em, responsavel_tipo, responsavel_perfil_id, responsavel_empresa_id")
      .order("criado_em", { ascending: false })
      .limit(2000),
  ]);

  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;
  const nomeEmpresa: Record<string, string> = {};
  for (const e of empresas ?? []) nomeEmpresa[e.id] = e.nome;
  const nomeFuncionario: Record<string, string> = {};
  for (const f of funcionarios ?? []) nomeFuncionario[f.id] = f.nome_completo;

  const todos = todasOS ?? [];

  const contarStatus = (s: string) => todos.filter((o) => o.status === s).length;
  const kpis = [
    { label: "Chamados abertos", value: contarStatus("ABERTA") },
    { label: "Em andamento", value: contarStatus("EM_ANDAMENTO") },
    { label: "Agendados", value: contarStatus("AGENDADA") },
    { label: "Aguardando aprovação", value: contarStatus("AGUARDANDO_APROVACAO") },
    { label: "Finalizados", value: contarStatus("CONCLUIDA") },
    { label: "Garantia negada", value: contarStatus("GARANTIA_NEGADA") },
    { label: "Total no mês", value: todos.filter((o) => o.criado_em.slice(0, 7) === mes).length },
    { label: "Total no ano", value: todos.filter((o) => o.criado_em.slice(0, 4) === String(ano)).length },
  ];

  // Por empreendimento
  const porObra = new Map<string, number>();
  for (const o of todos) porObra.set(o.obra_id, (porObra.get(o.obra_id) ?? 0) + 1);
  const listaPorObra = [...porObra.entries()].map(([id, qtd]) => ({ nome: nomeObra[id] ?? "—", qtd })).sort((a, b) => b.qtd - a.qtd);

  // Por categoria
  const porCategoria = new Map<string, number>();
  for (const o of todos) porCategoria.set(o.categoria, (porCategoria.get(o.categoria) ?? 0) + 1);
  const categoriasPizza: FatiaCategoria[] = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, qtd], i) => ({ nome: CATEGORIA_LABEL[cat] ?? cat, valor: qtd, cor: CORES[i % CORES.length] }));
  const totalCategoriaPizza = categoriasPizza.reduce((s, c) => s + c.valor, 0);

  // Por empresa terceirizada
  const porEmpresa = new Map<string, number>();
  for (const o of todos) if (o.responsavel_tipo === "EMPRESA" && o.responsavel_empresa_id) {
    porEmpresa.set(o.responsavel_empresa_id, (porEmpresa.get(o.responsavel_empresa_id) ?? 0) + 1);
  }
  const listaPorEmpresa = [...porEmpresa.entries()].map(([id, qtd]) => ({ nome: nomeEmpresa[id] ?? "—", qtd })).sort((a, b) => b.qtd - a.qtd);

  // Por funcionário
  const porFuncionario = new Map<string, number>();
  for (const o of todos) if (o.responsavel_tipo === "FUNCIONARIO" && o.responsavel_perfil_id) {
    porFuncionario.set(o.responsavel_perfil_id, (porFuncionario.get(o.responsavel_perfil_id) ?? 0) + 1);
  }
  const listaPorFuncionario = [...porFuncionario.entries()].map(([id, qtd]) => ({ nome: nomeFuncionario[id] ?? "—", qtd })).sort((a, b) => b.qtd - a.qtd);

  // Evolução últimos 6 meses
  const meses6 = ultimosMeses(6, mes);
  const porMes: Record<string, number> = {};
  for (const m of meses6) porMes[m] = 0;
  for (const o of todos) {
    const m = o.criado_em.slice(0, 7);
    if (m in porMes) porMes[m] += 1;
  }
  const maiorMes = Math.max(1, ...Object.values(porMes));
  const maiorObra = Math.max(1, ...listaPorObra.map((o) => o.qtd));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-primaryDark">Manutenções — Dashboard</h1>
          <p className="text-sm text-ink-500">Visão geral dos chamados de assistência técnica.</p>
        </div>
        <Link href="/manutencoes/nova" className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold hover:bg-primaryDark transition">
          + Nova Ordem de Serviço
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="stat-tile">
            <span className="stat-label">{k.label}</span>
            <span className="stat-value">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-3">Chamados por categoria</h2>
          {totalCategoriaPizza > 0 ? (
            <GraficoPizza categorias={categoriasPizza} total={totalCategoriaPizza} />
          ) : (
            <p className="text-sm text-gray-400">Nenhum chamado registrado ainda.</p>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Chamados por obra</h2>
          {listaPorObra.length > 0 ? (
            <div className="space-y-2">
              {listaPorObra.map((o) => (
                <div key={o.nome}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span>{o.nome}</span>
                    <span className="font-semibold">{o.qtd}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded h-3">
                    <div className="bg-primary rounded h-3" style={{ width: `${Math.round((o.qtd / maiorObra) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhum chamado registrado ainda.</p>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-primaryDark mb-3">Chamados por mês — últimos 6 meses</h2>
        <div className="space-y-2">
          {meses6.map((m) => (
            <div key={m}>
              <div className="flex justify-between text-sm mb-0.5">
                <span>{mesLabel(m)}</span>
                <span className="font-semibold">{porMes[m]}</span>
              </div>
              <div className="w-full bg-gray-100 rounded h-3">
                <div className="bg-accent rounded h-3" style={{ width: `${Math.round((porMes[m] / maiorMes) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Por empresa terceirizada</h2>
          {listaPorEmpresa.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {listaPorEmpresa.map((e) => (
                  <tr key={e.nome} className="border-t">
                    <td className="p-1.5">{e.nome}</td>
                    <td className="p-1.5 text-right font-semibold">{e.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum chamado atribuído a empresas ainda.</p>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Por funcionário</h2>
          {listaPorFuncionario.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {listaPorFuncionario.map((f) => (
                  <tr key={f.nome} className="border-t">
                    <td className="p-1.5">{f.nome}</td>
                    <td className="p-1.5 text-right font-semibold">{f.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum chamado atribuído a funcionários ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
