// Memória de curto prazo: guarda o histórico recente de cada paciente,
// identificado pelo número de telefone do WhatsApp.
//
// IMPORTANTE: isso fica em RAM — some se o servidor reiniciar. É o
// suficiente pra aprender e testar o agente. Quando for pra produção
// de verdade, troque esse Map por uma tabela no banco (SQLite/Postgres),
// mantendo a mesma interface (getHistorico / adicionarMensagem).

const HISTORICO_MAXIMO = 50; // últimas 50 mensagens por paciente
const PACIENTES_MAXIMO = 5000;
const MEMORIA_TTL_MS = 30 * 60 * 1000;
const historicoPorPaciente = new Map();

export function getHistorico(telefone) {
    const chave = String(telefone || "paciente_desconhecido");
    const registro = historicoPorPaciente.get(chave);
    if (!registro) return [];
    if (Date.now() - registro.atualizadoEm > MEMORIA_TTL_MS) {
        historicoPorPaciente.delete(chave);
        return [];
    }
    registro.atualizadoEm = Date.now();
    return registro.mensagens;
}

export function adicionarMensagem(telefone, mensagem) {
    const chave = String(telefone || "paciente_desconhecido");
    const historico = getHistorico(chave);
    historico.push(mensagem);

    // Descarta as mensagens mais antigas, mantendo só as últimas N
    const historicoLimitado = historico.slice(-HISTORICO_MAXIMO);
    if (!historicoPorPaciente.has(chave) && historicoPorPaciente.size >= PACIENTES_MAXIMO) {
        removerHistoricoMaisAntigo();
    }
    historicoPorPaciente.set(chave, {
        mensagens: historicoLimitado,
        atualizadoEm: Date.now(),
    });
}

export function limparHistorico(telefone) {
    historicoPorPaciente.delete(String(telefone || "paciente_desconhecido"));
}

function removerHistoricoMaisAntigo() {
    let chaveMaisAntiga = null;
    let atualizadoMaisAntigo = Infinity;
    for (const [chave, registro] of historicoPorPaciente) {
        if (registro.atualizadoEm < atualizadoMaisAntigo) {
            chaveMaisAntiga = chave;
            atualizadoMaisAntigo = registro.atualizadoEm;
        }
    }
    if (chaveMaisAntiga) historicoPorPaciente.delete(chaveMaisAntiga);
}
