/**
 * Módulo de envio de mensagens para o SZ.chat (Fortics)
 */

export async function enviarMensagemFortics({
    channelId = "6a7b841d32e42f97704de9b2",
    sessionId,
    platformId,
    message,
    token = process.env.FORTICS_TOKEN || ""
}) {
    const url = `https://chzn.sz.chat/hub/v1/fortics/outbound/${channelId}`;

    const payload = {
        channel_id: channelId,
        session_id: sessionId,
        platform_id: platformId,
        destination: platformId,
        contact_id: platformId,
        number: platformId,
        message: message,
        type: "text",
        text: message
    };

    try {
        const headers = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            headers["X-Token"] = token;
        }

        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        if (res.ok) {
            console.log(`✅ [Resposta enviada com sucesso para o seu WhatsApp!]`);
            return { ok: true, status: res.status };
        } else {
            console.log(`📡 [Retorno Fortics - Status ${res.status}]:`, text);
        }
    } catch (e) {
        console.error(`Erro ao enviar para o canal da Fortics:`, e.message);
    }

    return { ok: false };
}
