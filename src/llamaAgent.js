import { montarSystemPrompt } from "./systemPrompt.js";
import { toolImplementations } from "./tools.js";
import { openAiTools } from "./llamaTools.js";
import { getHistorico, adicionarMensagem } from "./memory.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Modelo Llama com suporte a tool calling na Groq. Confira em
// console.groq.com/docs/models se este nome ainda estiver disponível —
// a Groq costuma atualizar a lista de modelos com frequência.
const MODELO = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

async function chamarGroq(mensagens, tentativa = 1) {
    const resposta = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: MODELO,
            messages: mensagens,
            tools: openAiTools,
            tool_choice: "auto",
            max_tokens: 1024,
        }),
    });

    // Rate limit (429): aguarda e tenta de novo automaticamente
    if (resposta.status === 429 && tentativa <= 4) {
        const erroText = await resposta.text();
        // Extrai o tempo de espera sugerido pela Groq, se disponível
        const match = erroText.match(/try again in ([\d.]+)(m?s)/);
        let espera = tentativa * 2000; // padrão: 2s, 4s, 6s, 8s
        if (match) {
            const valor = parseFloat(match[1]);
            espera = match[2] === "ms" ? Math.ceil(valor) + 500 : Math.ceil(valor * 1000) + 500;
            espera = Math.min(espera, 12000); // máximo 12s
        }
        console.log(`⏳ Rate limit da Groq. Aguardando ${(espera / 1000).toFixed(1)}s antes da tentativa ${tentativa + 1}...`);
        await new Promise(r => setTimeout(r, espera));
        return chamarGroq(mensagens, tentativa + 1);
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
        { role: "system", content: montarSystemPrompt() },
        ...getHistorico(telefone),
    ];

    let respostaFinal = null;

    while (respostaFinal === null) {
        const data = await chamarGroq(mensagens);
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