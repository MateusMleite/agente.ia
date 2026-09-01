import { montarSystemPrompt } from "./systemPrompt.js";
import { toolImplementations } from "./tools.js";
import { openAiTools } from "./llamaTools.js";
import { getHistorico, adicionarMensagem } from "./memory.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Modelo Llama com suporte a tool calling na Groq. Confira em
// console.groq.com/docs/models se este nome ainda estiver disponível —
// a Groq costuma atualizar a lista de modelos com frequência.
const MODELOS = [
    process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "groq/compound-mini",
];

async function chamarGroq(mensagens, modeloIndex = 0) {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
        console.error("❌ ERRO: A variável de ambiente GROQ_API_KEY não está configurada no servidor!");
        throw new Error("A chave GROQ_API_KEY não foi configurada nas variáveis de ambiente da Railway.");
    }
    const modeloAtual = MODELOS[modeloIndex] || MODELOS[0];

    const resposta = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: modeloAtual,
            messages: mensagens,
            max_tokens: 600,
        }),
    });

    // Se atingir rate limit (429) no modelo atual, pula para o próximo modelo ou aguarda brevemente
    if (resposta.status === 429) {
        if (modeloIndex + 1 < MODELOS.length) {
            console.log(`⚡ Rate limit no modelo ${modeloAtual}. Alternando instantaneamente para ${MODELOS[modeloIndex + 1]}...`);
            return chamarGroq(mensagens, modeloIndex + 1);
        } else {
            console.log(`⏳ Limite temporário da Groq atingido. Aguardando 3s antes de tentar novamente...`);
            await new Promise((r) => setTimeout(r, 3000));
            return chamarGroq(mensagens, 0);
        }
    }

    if (!resposta.ok) {
        const erro = await resposta.text();
        throw new Error(`Erro na API da Groq (${resposta.status}): ${erro}`);
    }

    return resposta.json();
}

/**
 * Mesma interface do claudeAgent.js — recebe o telefone do paciente e o
 * texto da mensagem, devolve o texto final de resposta. Só troca o
 * modelo por baixo (Llama via Groq) e o formato de tool calling.
 */
export async function responderPaciente(telefone, textoMensagem) {
    adicionarMensagem(telefone, { role: "user", content: textoMensagem });

    const mensagens = [
        { role: "system", content: montarSystemPrompt(textoMensagem) },
        ...getHistorico(telefone),
    ];

    let respostaFinal = null;

    while (respostaFinal === null) {
        const data = await chamarGroq(mensagens);
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error("❌ Resposta inesperada da Groq:", JSON.stringify(data));
            throw new Error(`Resposta inválida da Groq: ${JSON.stringify(data?.error || data)}`);
        }
        const mensagemAssistente = data.choices[0].message;
        mensagens.push(mensagemAssistente);

        const toolCalls = mensagemAssistente.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            const conteudo = typeof mensagemAssistente.content === "string" ? mensagemAssistente.content.trim() : "";
            if (conteudo === "") {
                respostaFinal = "Não tenho informações sobre esse assunto. Para esse tipo de demanda, você pode entrar em contato diretamente com o SAU — Serviço de Atendimento ao Usuário do CHZN:\n\n📱 WhatsApp: (92) 98554-9282\n📧 E-mail: assistentesau.chzn@indsh.org.br\n🌐 Site: https://chzn.org.br/ (aba Ouvidoria)\n\nPosso ajudar com mais alguma coisa?";
            } else {
                respostaFinal = conteudo;
            }
            break;
        }

        for (const chamada of toolCalls) {
            const implementacao = toolImplementations[chamada.function.name];
            let argumentos = {};
            try {
                argumentos = JSON.parse(chamada.function.arguments || "{}");
            } catch {
                argumentos = {};
            }

            let resultado;
            try {
                resultado = implementacao
                    ? await implementacao({ ...argumentos, telefone_paciente: telefone })
                    : { erro: `Ferramenta '${chamada.function.name}' não implementada.` };
            } catch (erro) {
                resultado = { erro: `Falha ao executar '${chamada.function.name}': ${erro.message}` };
            }

            mensagens.push({
                role: "tool",
                tool_call_id: chamada.id,
                content: JSON.stringify(resultado),
            });
        }
    }

    if (!respostaFinal) {
        respostaFinal = "Desculpe, não consegui processar a resposta no momento. Por favor, tente novamente.";
    }

    adicionarMensagem(telefone, { role: "assistant", content: respostaFinal });
    return respostaFinal;
}