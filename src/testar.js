// Testa o "cérebro" do agente direto no terminal, sem precisar conectar
// o WhatsApp ainda — o mesmo conceito de "sandbox" citado no vídeo.
//
// Uso:
//   node src/testar.js "Posso receber alimentos trazidos por familiares?"
//   node src/testar.js "Quero cancelar minha cirurgia de amanhã"

import "dotenv/config";
import { responderPaciente } from "./llamaAgent.js";

const pergunta = process.argv.slice(2).join(" ");

if (!pergunta) {
    console.log('Uso: node src/testar.js "sua pergunta aqui"');
    process.exit(1);
}

const TELEFONE_TESTE = "5592900000000";

const resposta = await responderPaciente(TELEFONE_TESTE, pergunta);
console.log("\n--- Resposta do agente ---\n");
console.log(resposta);
