import { TIPOS, rotaGravar, rotaListar } from "@/lib/pos-obra/cadastros";

// Módulo Pós-obra: clientes (listar com ?desde=ISO e gravar em lote)
export const dynamic = "force-dynamic";
export const GET = rotaListar(TIPOS.clientes);
export const POST = rotaGravar(TIPOS.clientes);