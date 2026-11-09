import { TIPOS, rotaGravar, rotaListar } from "@/lib/pos-obra/cadastros";

// Módulo Pós-obra: fornecedores (listar com ?desde=ISO e gravar em lote)
export const dynamic = "force-dynamic";
export const GET = rotaListar(TIPOS.fornecedores);
export const POST = rotaGravar(TIPOS.fornecedores);