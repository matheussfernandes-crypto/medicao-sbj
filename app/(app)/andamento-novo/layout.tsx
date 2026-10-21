import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AbasNovo from "./AbasNovo";

// Área nova do Andamento de Obra (reformulação). Por enquanto só o ADM entra;
// a tela atual (/andamento-obra) continua funcionando como antes.
export default async function AndamentoNovoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") redirect("/dashboard");

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