// Memória de curto prazo: guarda o histórico recente de cada paciente,
// identificado pelo número de telefone do WhatsApp.
//
// IMPORTANTE: isso fica em RAM — some se o servidor reiniciar. É o
// suficiente pra aprender e testar o agente. Quando for pra produção
// de verdade, troque esse Map por uma tabela no banco (SQLite/Postgres),
// mantendo a mesma interface (getHistorico / adicionarMensagem).

const HISTORICO_MAXIMO = 50; // últimas 50 mensagens por paciente
const historicoPorPaciente = new Map();

export function getHistorico(telefone) {
    return historicoPorPaciente.get(telefone) ?? [];
}

export function adicionarMensagem(telefone, mensagem) {
    const historico = getHistorico(telefone);
    historico.push(mensagem);

    // Descarta as mensagens mais antigas, mantendo só as últimas N
    const historicoLimitado = historico.slice(-HISTORICO_MAXIMO);
    historicoPorPaciente.set(telefone, historicoLimitado);
}

export function limparHistorico(telefone) {
    historicoPorPaciente.delete(telefone);
}
