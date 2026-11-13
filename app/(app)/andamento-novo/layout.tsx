import { redirect } from "next/navigation";
import { ehGestorAcessos } from "@/lib/acessos/modulos";
import { createClient } from "@/lib/supabase/server";
import AbasNovo from "./AbasNovo";
import ConteudoAnimado from "./ConteudoAnimado";

// Área nova do Andamento de Obra (reformulação). Por enquanto só o ADM e quem tem a permissão específica entram;
// a tela atual (/andamento-obra) continua funcionando como antes.
export default async function AndamentoNovoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor, status, acesso_andamento_novo, acessos").eq("id", user!.id).single();
  // ADM, ou quem recebeu a permissão específica (ex.: estagiário que também configura)
  if (perfil?.status !== "aprovado" || (!ehGestorAcessos(user!.email) && perfil?.acesso_andamento_novo !== true && !((perfil as any)?.acessos ?? []).includes("andamento_novo"))) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-lg font-semibold text-primaryDark">Andamento de Obra</h1>
        <p className="text-sm text-ink-500">Pavimentos, locais, sistemas e fachada, com cálculo ponderado.</p>
      </div>
      <AbasNovo />
      <ConteudoAnimado>{children}</ConteudoAnimado>
    </div>
  );
}