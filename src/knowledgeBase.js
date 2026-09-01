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
export function obterContextoRelevante(texto) {
    const t = (texto || "").toLowerCase();
    const selecionados = [];

    if (
        t.includes("uti") ||
        t.includes("visita") ||
        t.includes("boletim") ||
        t.includes("acompanhante") ||
        t.includes("troca") ||
        t.includes("vermelha") ||
        t.includes("enfermaria") ||
        t.includes("horario") ||
        t.includes("horário")
    ) {
        selecionados.push("servico_social");
    }
    if (
        t.includes("cirurgia") ||
        t.includes("cancel") ||
        t.includes("remarc") ||
        t.includes("exame") ||
        t.includes("procedimento") ||
        t.includes("hospital dia") ||
        t.includes("guia") ||
        t.includes("agend") ||
        t.includes("falta") ||
        t.includes("jejum") ||
        t.includes("maquiagem") ||
        t.includes("adorno")
    ) {
        selecionados.push("hospital_dia");
        selecionados.push("centro_cirurgico");
        selecionados.push("pre_agendamento");
    }
    if (
        t.includes("dieta") ||
        t.includes("comida") ||
        t.includes("alimenta") ||
        t.includes("nutri") ||
        t.includes("alergia") ||
        t.includes("refeiç")
    ) {
        selecionados.push("nutricao");
    }
    if (
        t.includes("psicolog") ||
        t.includes("mental") ||
        t.includes("emocion") ||
        t.includes("criança") ||
        t.includes("sisreg") ||
        t.includes("laudo") ||
        t.includes("atestado")
    ) {
        selecionados.push("psicologia");
    }
    if (
        t.includes("sau") ||
        t.includes("ouvidoria") ||
        t.includes("reclama") ||
        t.includes("elogio") ||
        t.includes("contato") ||
        t.includes("telefone") ||
        t.includes("email") ||
        t.includes("lgpd")
    ) {
        selecionados.push("sau");
    }

    const setoresParaIncluir =
        selecionados.length > 0
            ? Array.from(new Set(selecionados))
            : KB.setores.map((s) => s.id);

    return KB.setores
        .filter((s) => setoresParaIncluir.includes(s.id))
        .map(
            (s) =>
                `[Setor: ${s.nome}]\n` +
                s.perguntas.map((p) => `• ${p.pergunta} -> ${p.resposta}`).join("\n")
        )
        .join("\n\n");
}

export function baseDeConhecimentoCompleta() {
    return KB.setores
        .map((setor) => {
            const itens = setor.perguntas
                .map((p) => `• ${p.pergunta} -> ${p.resposta}`)
                .join("\n");
            return `[Setor: ${setor.nome}]\n${itens}`;
        })
        .join("\n\n");
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
