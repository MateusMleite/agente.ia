import "dotenv/config";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { responderPaciente } from "./llamaAgent.js";

console.log("Iniciando cliente do WhatsApp...");

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./.wwebjs_auth"
    }),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

client.on("qr", (qr) => {
    console.log("\n=======================================================");
    console.log("   ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:");
    console.log("   (WhatsApp > Dispositivos Conectados > Conectar)");
    console.log("=======================================================\n");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("\n✅ WhatsApp conectado com sucesso!");
    console.log("🤖 O agente de IA está ativo e pronto para responder mensagens.\n");
});

client.on("message", async (msg) => {
    // Ignora status/stories e mensagens de grupos
    if (msg.isStatus || msg.from.includes("@g.us")) return;

    const telefone = msg.from.replace("@c.us", "");
    const texto = msg.body;

    if (!texto || texto.trim() === "") return;

    console.log(`\n💬 [${telefone}]: ${texto}`);

    try {
        const resposta = await responderPaciente(telefone, texto);
        console.log(`🤖 [Agente]: ${resposta}`);
        await msg.reply(resposta);
    } catch (erro) {
        console.error("❌ Erro ao responder:", erro.message);
        await msg.reply("Desculpe, ocorreu uma instabilidade momentânea. Por favor, tente novamente em instantes.");
    }
});

client.initialize();
