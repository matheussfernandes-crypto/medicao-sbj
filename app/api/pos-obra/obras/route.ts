import { TIPOS, rotaGravar, rotaListar } from "@/lib/pos-obra/cadastros";

// Módulo Pós-obra: obras (listar com ?desde=ISO e gravar em lote)
export const dynamic = "force-dynamic";
export const GET = rotaListar(TIPOS.obras);
export const POST = rotaGravar(TIPOS.obras);