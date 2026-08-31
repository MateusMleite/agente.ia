import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "knowledgeBase.json"), "utf-8");
const KB = JSON.parse(raw);

/**
 * Devolve a lista de setores (nome + id), usada para o prompt e para o
 * modelo saber quais valores usar na ferramenta de encaminhamento.
 */
export function listarSetores() {
    return KB.setores.map((s) => ({ id: s.id, nome: s.nome }));
}

/**
 * Monta o texto completo da base de conhecimento, organizado por setor.
 * É esse texto que entra na "constituição" (system prompt) do agente,
 * já que o volume total é pequeno o suficiente para caber direto no prompt.
 * Se a base crescer muito (centenas de perguntas), o próximo passo seria
 * trocar isso por uma busca semântica (embeddings) — mas por enquanto
 * não precisa dessa complexidade.
 */
export function baseDeConhecimentoCompleta() {
    return KB.setores
        .map((setor) => {
            const avisos = setor.avisos
                ? `\nAvisos importantes:\n${setor.avisos.map((a) => `- ${a}`).join("\n")}\n`
                : "";
            const perguntas = setor.perguntas
                .map((p) => `P: ${p.pergunta}\nR: ${p.resposta}`)
                .join("\n\n");
            return `### Setor: ${setor.nome} (id: ${setor.id})${avisos}\n${perguntas}`;
        })
        .join("\n\n---\n\n");
}

export function getSetorPorId(id) {
    return KB.setores.find((s) => s.id === id);
}

export default KB;
