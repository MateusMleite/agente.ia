import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { responderPaciente } from "./llamaAgent.js";
import { enviarMensagemWhatsApp, marcarComoLida } from "./whatsapp.js";
import { enviarMensagemFortics } from "./fortics.js";
import { lerMetricas, registrarAcesso, registrarAvaliacao, calcularMediaAvaliacoes } from "./metricas.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS — permite que o site da Hostgator chame esta API
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

// Body parsers — devem vir ANTES de qualquer rota que use req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve o widget de chat estático
app.use("/widget", express.static(path.join(__dirname, "../chat-widget")));

// Registra um novo acesso (nova sessão do widget ou WhatsApp)
app.post('/metricas/acesso', async (req, res) => {
    try {
        const { phoneNumber, sessionId } = req.body || {};
        const identificador = phoneNumber || sessionId || null;
        const dados = await registrarAcesso(identificador);
        res.status(200).json({ ok: true, totalAcessos: dados.totalAcessos });
    } catch (err) {
        console.error('[POST /metricas/acesso] erro:', err.message);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar acesso.' });
    }
});

// Registra uma avaliação do chat (1 a 5 estrelas + comentário opcional)
app.post('/metricas/avaliacao', async (req, res) => {
    try {
        const { nota, comentario, phoneNumber, sessionId } = req.body || {};
        const identificador = phoneNumber || sessionId || null;
        const dados = await registrarAvaliacao(nota, comentario, identificador);
        res.status(200).json({
            ok: true,
            mediaAtual: calcularMediaAvaliacoes(dados),
        });
    } catch (err) {
        console.error('[POST /metricas/avaliacao] erro:', err.message);
        res.status(400).json({ ok: false, erro: err.message });
    }
});

// Consulta o dashboard de métricas
app.get('/metricas', (req, res) => {
    const dados = lerMetricas();
    res.status(200).json({
        ...dados,
        mediaAvaliacoes: calcularMediaAvaliacoes(dados),
    });
});

// --- Webhook Fortics (SZ.chat) ---
app.post("/fortics-webhook", async (req, res) => {
    console.log("\n📩 [Webhook Fortics recebido]:", JSON.stringify(req.body, null, 2));

    try {
        const corpo = req.body || {};

        // Extrai a mensagem e os dados do paciente com a estrutura exata do SZ.chat
        const texto =
            corpo?.data?.content?.message ||
            corpo?.message ||
            corpo?.texto ||
            corpo?.text ||
            (typeof corpo === "string" ? corpo : "");

        const telefone =
            corpo?.vars?.final_number ||
            corpo?.data?.content?.platform_id ||
            corpo?.vars?.number ||
            corpo?.contactPhone ||
            "paciente_teste";

        const nomePaciente = corpo?.vars?.name || "Paciente";
        const sessionId = corpo?.data?.session_id || corpo?.data?.content?.session_id;
        const channelId = corpo?.data?.channel_id || "6a7b841d32e42f97704de9b2";

        if (texto) {
            console.log(`\n💬 Mensagem de ${nomePaciente} (${telefone}): "${texto}"`);
            const resposta = await responderPaciente(telefone, texto);
            console.log(`\n🤖 [Resposta do Agente]:\n${resposta}\n`);

            // Dispara envio automático direto para a API/Hub da Fortics
            await enviarMensagemFortics({
                channelId,
                sessionId,
                platformId: telefone,
                message: resposta
            });

            // Retorna a resposta em múltiplos formatos comuns de retorno de bot do SZ.chat
            return res.status(200).json({
                status: "success",
                message: resposta,
                response: resposta,
                text: resposta,
                reply: resposta,
                result: resposta,
                retorno: resposta,
                session_id: sessionId,
                vars: {
                    resposta_agente: resposta,
                    ia_resposta: resposta,
                    message: resposta,
                    response: resposta,
                    result: resposta,
                    retorno: resposta
                }
            });
        }

        return res.status(200).json({ status: "recebido_sem_texto" });
    } catch (erro) {
        console.error("❌ Erro ao processar mensagem do Fortics:", erro);
        return res.status(500).json({ error: erro.message });
    }
});

// --- API do Widget de Chat do Site ---
app.post("/chat", async (req, res) => {
    const { mensagem, sessionId } = req.body || {};

    if (!mensagem || mensagem.trim() === "") {
        return res.status(400).json({ erro: "mensagem não pode ser vazia." });
    }

    // Usa sessionId do visitante (ou um fallback) como identificador de memória
    const telefone = sessionId || `web_${Date.now()}`;

    try {
        console.log(`\n💬 [Chat do Site] ${telefone}: "${mensagem}"`);
        const resposta = await responderPaciente(telefone, mensagem);
        console.log(`🤖 [Agente]: ${resposta}`);
        return res.status(200).json({ resposta });
    } catch (erro) {
        console.error("❌ Erro no /chat:", erro);
        return res.status(500).json({ erro: "Serviço temporariamente indisponível. Tente novamente em instantes.", detalhes: erro.message });
    }
});

// --- Verificação do webhook (passo único, feito pelo painel da Meta) ---
app.get("/webhook", (req, res) => {
    const modo = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const desafio = req.query["hub.challenge"];

    if (modo === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log("Webhook verificado com sucesso.");
        return res.status(200).send(desafio);
    }
    return res.sendStatus(403);
});

// --- Recebimento de mensagens (Meta Cloud API) ---
app.post("/webhook", (req, res) => {
    res.sendStatus(200);
    processarEvento(req.body).catch((erro) =>
        console.error("Erro ao processar evento do webhook:", erro)
    );
});

async function processarEvento(corpo) {
    const value = corpo?.entry?.[0]?.changes?.[0]?.value;
    const mensagem = value?.messages?.[0];
    if (!mensagem) return; // pode ser um evento de status (entregue/lido), ignoramos

    const telefonePaciente = mensagem.from;
    await marcarComoLida(mensagem.id).catch(() => { });

    const textoParaOAgente = extrairTextoDaMensagem(mensagem);

    const respostaTexto = await responderPaciente(telefonePaciente, textoParaOAgente);
    await enviarMensagemWhatsApp(telefonePaciente, respostaTexto);
}

// Converte os diferentes tipos de mensagem do WhatsApp em texto para o
// agente. Áudio e imagem/documento ainda não são interpretados de
// verdade aqui — são sinalizados como tal, e o próprio prompt já instrui
// o agente a tratar isso como algo que provavelmente precisa de
// encaminhamento humano, em vez de arriscar um palpite.
function extrairTextoDaMensagem(mensagem) {
    switch (mensagem.type) {
        case "text":
            return mensagem.text.body;

        case "image":
        case "document": {
            const legenda = mensagem[mensagem.type]?.caption;
            return `[O paciente enviou um(a) ${mensagem.type === "image" ? "imagem" : "documento"}${legenda ? ` com a legenda: "${legenda}"` : ""
                }. Não é possível analisar o conteúdo do arquivo neste momento.]`;
        }

        case "audio":
            return "[O paciente enviou um áudio. A transcrição automática ainda não está configurada neste agente.]";

        default:
            return `[O paciente enviou uma mensagem do tipo '${mensagem.type}', não suportada ainda.]`;
    }
}

// Health check para o Railway
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor do agente rodando na porta ${PORT}`);
});
