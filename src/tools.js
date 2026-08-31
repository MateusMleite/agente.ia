import { getSetorPorId, listarSetores } from "./knowledgeBase.js";

// Definição das ferramentas no formato que a API do Claude espera.
// Isso é o que entra no parâmetro "tools" da chamada — é a descrição
// que o modelo lê para decidir QUANDO usar cada uma.
export const toolDefinitions = [
    {
        name: "buscar_conhecimento",
        description:
            "Retorna as perguntas e respostas oficiais de um setor específico da base de conhecimento. Use antes de responder qualquer dúvida do paciente, para confirmar a informação exata a passar.",
        input_schema: {
            type: "object",
            properties: {
                setor_id: {
                    type: "string",
                    description: `id do setor a consultar. Valores possíveis: ${listarSetores()
                        .map((s) => s.id)
                        .join(", ")}`,
                },
            },
            required: ["setor_id"],
        },
    },
];

// Implementação real de cada ferramenta. O nome da chave tem que bater
// com "name" acima — é assim que o loop do agente sabe qual função rodar
// quando o modelo pede uma tool_use.
export const toolImplementations = {
    buscar_conhecimento: async ({ setor_id }) => {
        const setor = getSetorPorId(setor_id);
        if (setor) {
            return {
                setor: setor.nome,
                avisos: setor.avisos ?? [],
                perguntas: setor.perguntas,
            };
        }

        // Fallback: busca em todos os setores
        const termo = (setor_id || "").toLowerCase();
        const encontrados = [];
        for (const s of (await import("./knowledgeBase.js")).default.setores) {
            const matches = s.perguntas.filter(
                (p) =>
                    p.pergunta.toLowerCase().includes(termo) ||
                    p.resposta.toLowerCase().includes(termo)
            );
            if (matches.length > 0) {
                encontrados.push({ setor: s.nome, perguntas: matches });
            }
        }

        if (encontrados.length > 0) {
            return { resultados: encontrados };
        }

        return {
            mensagem: "Consulte as informações oficiais dos setores abaixo:",
            setores: listarSetores(),
        };
    },
};
