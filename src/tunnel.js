import { startTunnel } from "untun";

async function main() {
    console.log("Iniciando túnel Cloudflare seguro...");
    try {
        const tunnel = await startTunnel({ port: 3000 });
        const url = await tunnel.getURL();
        console.log("\n=======================================================");
        console.log("🚀 TÚNEL CLOUDFLARE ATIVO COM SUCESSO!");
        console.log(`👉 Link público: ${url}`);
        console.log(`👉 Cole no Host da Fortics: ${url}/fortics-webhook`);
        console.log("=======================================================\n");
    } catch (err) {
        console.error("Erro ao iniciar túnel:", err);
    }
}

main();
