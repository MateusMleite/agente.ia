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
    if (!id || typeof id !== "string") return null;
    const cleanId = id.toLowerCase().trim().replace(/[-\s]/g, "_");

    const aliasMap = {
        uti: "servico_social",
        utis: "servico_social",
        visita: "servico_social",
        visitas: "servico_social",
        enfermaria: "servico_social",
        enfermarias: "servico_social",
        boletim: "servico_social",
        acompanhante: "servico_social",
        cirurgia: "centro_cirurgico",
        cirurgias: "centro_cirurgico",
        dieta: "nutricao",
        comida: "nutricao",
        alimentacao: "nutricao",
        ouvidoria: "sau",
        reclamacao: "sau",
        elogio: "sau",
        exame: "hospital_dia",
        exames: "hospital_dia",
        agendamento: "pre_agendamento",
    };

    const targetId = aliasMap[cleanId] || cleanId;
    return (
        KB.setores.find(
            (s) =>
                s.id === targetId ||
                s.id === cleanId ||
                s.nome.toLowerCase() === cleanId ||
                s.nome.toLowerCase().replace(/[-\s]/g, "_") === cleanId
        ) || null
    );
}

export default KB;
