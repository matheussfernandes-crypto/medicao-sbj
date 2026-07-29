import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HardHat } from "lucide-react";

export default async function AndamentoObraPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ESTAGIARIO" && perfil?.setor !== "ADMIN") redirect("/dashboard");

  return (
    <div className="card flex flex-col items-center justify-center text-center py-16 gap-3">
      <HardHat className="w-10 h-10 text-primary" />
      <h1 className="text-lg font-semibold text-primaryDark">Andamento de Obra</h1>
      <p className="text-sm text-ink-500 max-w-md">
        Este módulo está em produção e será liberado em breve, com o acompanhamento do andamento físico de cada obra.
      </p>
    </div>
  );
}
