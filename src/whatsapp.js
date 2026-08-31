const GRAPH_API_VERSION = "v21.0";

function urlMensagens() {
    return `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function chamarGraphAPI(corpo) {
    const resposta = await fetch(urlMensagens(), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
        const erro = await resposta.text();
        console.error("Erro ao chamar WhatsApp Cloud API:", resposta.status, erro);
    }

    return resposta;
}

export async function enviarMensagemWhatsApp(paraNumero, texto) {
    return chamarGraphAPI({
        messaging_product: "whatsapp",
        to: paraNumero,
        type: "text",
        text: { body: texto },
    });
}

// Melhora a experiência: mostra "visto" no WhatsApp do paciente assim que
// a mensagem chega, mesmo enquanto o agente ainda está "pensando".
export async function marcarComoLida(messageId) {
    return chamarGraphAPI({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
    });
}
