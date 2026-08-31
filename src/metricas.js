import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, isDbConfigured } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METRICAS_PATH = path.join(__dirname, "metricas.json");

// Estrutura padrão caso o arquivo ainda não exista
const METRICAS_PADRAO = {
    totalAcessos: 0,
    avaliacoes: {
        "1_estrela": 0,
        "2_estrelas": 0,
        "3_estrelas": 0,
        "4_estrelas": 0,
        "5_estrelas": 0,
    },
    comentarios: [], // { nota, comentario, data, telefone }
};

function lerMetricas() {
    try {
        if (!fs.existsSync(METRICAS_PATH)) {
            fs.writeFileSync(METRICAS_PATH, JSON.stringify(METRICAS_PADRAO, null, 2));
            return { ...METRICAS_PADRAO };
        }
        const raw = fs.readFileSync(METRICAS_PATH, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        console.error("[metricas] Erro ao ler metricas.json, usando padrão:", err.message);
        return { ...METRICAS_PADRAO };
    }
}

function salvarMetricas(dados) {
    try {
        fs.writeFileSync(METRICAS_PATH, JSON.stringify(dados, null, 2));
    } catch (err) {
        console.error("[metricas] Erro ao salvar metricas.json:", err.message);
    }
}

/**
 * Incrementa contador de acesso no JSON e persiste no MySQL se disponível
 * @param {string|null} phoneNumber - Telefone ou ID da sessão
 */
async function registrarAcesso(phoneNumber = null) {
    // 1. Atualiza métricas locais em JSON
    const dados = lerMetricas();
    dados.totalAcessos = (dados.totalAcessos || 0) + 1;
    salvarMetricas(dados);

    // 2. Grava no banco de dados MySQL se configurado
    if (isDbConfigured()) {
        try {
            await query("INSERT INTO bot_accesses (phone_number) VALUES (?)", [phoneNumber]);
            console.log(`📊 [Metricas] Acesso registrado no MySQL (${phoneNumber || "Web Session"})`);
        } catch (err) {
            console.error("⚠️ [Metricas] Falha ao salvar acesso no MySQL:", err.message);
        }
    }

    return dados;
}

/**
 * Registra avaliação (1 a 5 estrelas), comentário opcional e persiste no MySQL
 * @param {number|string} nota - Nota de 1 a 5
 * @param {string|null} comentario - Comentário opcional
 * @param {string|null} phoneNumber - Telefone ou ID da sessão
 */
async function registrarAvaliacao(nota, comentario = null, phoneNumber = null) {
    const notaNum = parseInt(nota, 10);
    if (![1, 2, 3, 4, 5].includes(notaNum)) {
        throw new Error("Nota inválida. Use um valor entre 1 e 5.");
    }

    // 1. Atualiza métricas locais em JSON
    const dados = lerMetricas();
    const chave = `${notaNum}_estrela${notaNum > 1 ? "s" : ""}`;
    dados.avaliacoes[chave] = (dados.avaliacoes[chave] || 0) + 1;

    const textoComentario = comentario && comentario.trim().length > 0 ? comentario.trim() : null;

    if (textoComentario) {
        dados.comentarios = dados.comentarios || [];
        dados.comentarios.push({
            nota: notaNum,
            comentario: textoComentario,
            data: new Date().toISOString(),
            telefone: phoneNumber || undefined,
        });
    }

    salvarMetricas(dados);

    // 2. Grava no banco de dados MySQL se configurado
    if (isDbConfigured()) {
        try {
            await query(
                "INSERT INTO bot_ratings (phone_number, rating, comment) VALUES (?, ?, ?)",
                [phoneNumber, notaNum, textoComentario]
            );
            console.log(`⭐ [Metricas] Avaliação ${notaNum} estrelas salva no MySQL (${phoneNumber || "Web Session"})`);
        } catch (err) {
            console.error("⚠️ [Metricas] Falha ao salvar avaliação no MySQL:", err.message);
        }
    }

    return dados;
}

/**
 * Calcula a média das avaliações
 */
function calcularMediaAvaliacoes(dados) {
    const av = dados.avaliacoes || {};
    let soma = 0;
    let total = 0;
    for (let i = 1; i <= 5; i++) {
        const chave = `${i}_estrela${i > 1 ? "s" : ""}`;
        const qtd = av[chave] || 0;
        soma += i * qtd;
        total += qtd;
    }
    return total > 0 ? (soma / total).toFixed(2) : null;
}

export { lerMetricas, registrarAcesso, registrarAvaliacao, calcularMediaAvaliacoes };