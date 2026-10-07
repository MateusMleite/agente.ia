const registrosPorChave = new Map();

export function criarRateLimit({ janelaMs, maxRequisicoes, maxChaves = 10000 }) {
    return (req, res, next) => {
        const chave = req.ip || req.socket.remoteAddress || "desconhecido";
        const agora = Date.now();
        const registro = registrosPorChave.get(chave);

        if (!registro || agora - registro.inicio >= janelaMs) {
            if (!registro && registrosPorChave.size >= maxChaves) {
                removerRegistroMaisAntigo();
            }
            registrosPorChave.set(chave, { inicio: agora, quantidade: 1 });
            return next();
        }

        registro.quantidade += 1;
        if (registro.quantidade > maxRequisicoes) {
            const esperaSegundos = Math.ceil((janelaMs - (agora - registro.inicio)) / 1000);
            res.set("Retry-After", String(esperaSegundos));
            return res.status(429).json({
                erro: "Muitas requisições. Tente novamente em alguns instantes.",
            });
        }

        return next();
    };
}

function removerRegistroMaisAntigo() {
    let chaveMaisAntiga = null;
    let inicioMaisAntigo = Infinity;
    for (const [chave, registro] of registrosPorChave) {
        if (registro.inicio < inicioMaisAntigo) {
            chaveMaisAntiga = chave;
            inicioMaisAntigo = registro.inicio;
        }
    }
    if (chaveMaisAntiga) registrosPorChave.delete(chaveMaisAntiga);
}
