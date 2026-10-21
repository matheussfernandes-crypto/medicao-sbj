import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AbasNovo from "./AbasNovo";

// Área nova do Andamento de Obra (reformulação). Por enquanto só o ADM e quem tem a permissão específica entram;
// a tela atual (/andamento-obra) continua funcionando como antes.
export default async function AndamentoNovoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor, status, acesso_andamento_novo").eq("id", user!.id).single();
  // ADM, ou quem recebeu a permissão específica (ex.: estagiário que também configura)
  if (perfil?.status !== "aprovado" || (perfil?.setor !== "ADMIN" && perfil?.acesso_andamento_novo !== true)) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-lg font-semibold text-primaryDark">Andamento de Obra (novo)</h1>
        <p className="text-sm text-ink-500">Pavimentos, locais, sistemas e fachada, com cálculo ponderado. Em validação: a tela atual continua valendo.</p>
      </div>
      <AbasNovo />
      {children}
    </div>
  );
}