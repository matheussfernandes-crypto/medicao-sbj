import { ehGestorAcessos, itensLiberados } from "@/lib/acessos/modulos";
import { normNome } from "@/lib/pos-obra/clientes-unificados";

// Agenda da página inicial: cada pessoa vê só os compromissos dos setores a que tem acesso.
// Só leitura: nada aqui grava em tabela nenhuma.
export type EventoAgenda = { data: string; label: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TIPO_VISITA: Record<string, string> = { vistoria: "Vistoria", execucao: "Execução", retorno: "Retorno" };

export async function agendaDoSetor(supabase: any, email: string | null | undefined, acessos: string[] | null | undefined): Promise<EventoAgenda[]> {
  const gestor = ehGestorAcessos(email);
  const livres = itensLiberados(acessos ?? []);
  const tem = (chave: string) => gestor || livres.has(chave);
  const hoje = new Date();
  const inicioMes = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const eventos: EventoAgenda[] = [];

  // Medições e vales: fechamento mensal no dia 21
  if (tem("contratos/fechamento") || tem("lancamentos")) {
    eventos.push({ data: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 21)), label: "Fechamento mensal (dia 21)" });
  }

  // Pós-venda: visitas marcadas na agenda
  if (tem("posvenda/chamados")) {
    try {
      const { data: visitas } = await supabase.from("posvenda_docs").select("id, dados").eq("colecao", "agenda").gte("dados->>data", inicioMes).limit(500);
      const marcadas = (visitas ?? []).filter((v: any) => v.dados?.status !== "cancelado" && v.dados?.data);
      if (marcadas.length) {
        const chIds = Array.from(new Set(marcadas.map((v: any) => v.dados.chId).filter(Boolean)));
        const { data: chs } = await supabase.from("posvenda_docs").select("id, dados").eq("colecao", "chamados").in("id", chIds);
        const ch = new Map<string, any>((chs ?? []).map((c: any) => [c.id, c.dados]));
        const uniIds = Array.from(new Set((chs ?? []).map((c: any) => c.dados?.uniId).filter(Boolean)));
        const [{ data: unis }, { data: emps }] = await Promise.all([
          uniIds.length ? supabase.from("posvenda_docs").select("id, dados").eq("colecao", "unidades").in("id", uniIds) : Promise.resolve({ data: [] }),
          supabase.from("posvenda_docs").select("id, dados").eq("colecao", "empreendimentos"),
        ]);
        const uni = new Map<string, any>((unis ?? []).map((x: any) => [x.id, x.dados]));
        const emp = new Map<string, any>((emps ?? []).map((x: any) => [x.id, x.dados]));
        for (const v of marcadas) {
          const c = ch.get(v.dados.chId) || {};
          const onde = [uni.get(c.uniId)?.numero, emp.get(c.empId)?.nome].filter(Boolean).join(" · ");
          eventos.push({ data: v.dados.data, label: `${v.dados.hora ? v.dados.hora + " " : ""}${TIPO_VISITA[v.dados.tipo] ?? "Visita"} pós-venda${onde ? " — " + onde : ""}` });
        }
      }
    } catch {}
  }

  // Pós-obra: vistorias de entrega
  if (tem("posobra/vistorias")) {
    try {
      const [{ data: vist }, { data: obras }] = await Promise.all([
        supabase.from("posobra_vistorias").select("obra_id, apartamento, data").gte("data", inicioMes).limit(500),
        supabase.from("posobra_obras").select("id, nome"),
      ]);
      const nome = new Map<string, string>((obras ?? []).map((o: any) => [o.id, String(o.nome || "").replace(/^\s*residencial\s+/i, "")]));
      for (const v of vist ?? []) eventos.push({ data: v.data, label: `Vistoria de entrega — apto ${v.apartamento}${nome.get(v.obra_id) ? " · " + nome.get(v.obra_id) : ""}` });
    } catch {}
  }

  void normNome;
  return eventos.sort((a, b) => a.data.localeCompare(b.data) || a.label.localeCompare(b.label));
}
