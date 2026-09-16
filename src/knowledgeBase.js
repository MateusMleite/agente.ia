import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

function lerBaseLocal() {
    const raw = readFileSync(join(__dirname, "knowledgeBase.json"), "utf-8");
    return JSON.parse(raw);
}

function normalizarIdSetor(nome) {
    return String(nome || "informacoes_gerais")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[-\s/]+/g, "_");
}

function normalizarBaseRemota(dados) {
    if (Array.isArray(dados?.setores)) return dados;

    const cards = Array.isArray(dados?.cards)
        ? dados.cards
        : Array.isArray(dados?.entradas)
            ? dados.entradas
        : Array.isArray(dados)
            ? dados
            : [];
    const publicados = cards.some((card) => card.status)
        ? cards.filter((card) => card.status === "publicado")
        : cards;
    const setores = new Map();

    for (const card of publicados) {
        if (!card?.pergunta || !card?.resposta) continue;
        const nomeSetor = card.setor || "Informações gerais";
        const id = normalizarIdSetor(nomeSetor);
        if (!setores.has(id)) {
            setores.set(id, { id, nome: nomeSetor, perguntas: [], avisos: [] });
        }
        const setor = setores.get(id);
        setor.perguntas.push({ pergunta: card.pergunta, resposta: card.resposta });
        if (card.aviso) setor.avisos.push(card.aviso);
    }

    return { setores: [...setores.values()] };
}

async function carregarBase() {
    const baseLocal = lerBaseLocal();
    const url = process.env.KNOWLEDGE_BASE_URL?.trim();
    if (!url) return baseLocal;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const resposta = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const dados = await resposta.json();
        const baseRemota = normalizarBaseRemota(dados);
        if (!baseRemota.setores.length) throw new Error("JSON sem cards válidos");
        console.log(`📚 Base remota carregada: ${baseRemota.setores.length} setores.`);
        return baseRemota;
    } catch (erro) {
        console.warn(`⚠️ Não foi possível carregar a base remota (${erro.message}). Usando a base local.`);
        return baseLocal;
    } finally {
        clearTimeout(timeout);
    }
}

const baseDeConhecimento = await carregarBase();

function getKB() {
    return baseDeConhecimento;
}

/**
 * Devolve a lista de setores (nome + id), usada para o prompt e para o
 * modelo saber quais valores usar na ferramenta de encaminhamento.
 */
export function listarSetores() {
    return getKB().setores.map((s) => ({ id: s.id, nome: s.nome }));
}

/**
 * Monta o texto completo da base de conhecimento, organizado por setor.
 * É esse texto que entra na "constituição" (system prompt) do agente,
 * já que o volume total é pequeno o suficiente para caber direto no prompt.
 * Se a base crescer muito (centenas de perguntas), o próximo passo seria
 * trocar isso por uma busca semântica (embeddings) — mas por enquanto
 * não precisa dessa complexidade.
 */
export function obterContextoRelevante(texto) {
    // Como a base de conhecimento inteira é enxuta (~20KB), incluir todos os setores
    // garante que o agente NUNCA omita informações por falha de palavras-chave.
    return baseDeConhecimentoCompleta();
}

export function baseDeConhecimentoCompleta() {
    return getKB().setores
        .map((setor) => {
            const avisos = setor.avisos && setor.avisos.length > 0
                ? `Avisos:\n${setor.avisos.map((a) => `• ${a}`).join("\n")}\n`
                : "";
            const itens = setor.perguntas
                .map((p) => `• ${p.pergunta} -> ${p.resposta}`)
                .join("\n");
            return `[Setor: ${setor.nome}]\n${avisos}${itens}`;
        })
        .join("\n\n");
}

export function getSetorPorId(id) {
    if (!id || typeof id !== "string") return null;
    const cleanId = id.toLowerCase().trim().replace(/[-\s]/g, "_");

    const aliasMap = {
        uti: "servico_social",
        utis: "servico_social",
        visita: "servico_social",
        visitas: "servico_social",
        enfermaria: "servico_social",
        enfermarias: "servico_social",
        boletim: "servico_social",
        acompanhante: "servico_social",
        cirurgia: "centro_cirurgico",
        cirurgias: "centro_cirurgico",
        dieta: "nutricao",
        comida: "nutricao",
        alimentacao: "nutricao",
        ouvidoria: "sau",
        reclamacao: "sau",
        elogio: "sau",
        exame: "hospital_dia",
        exames: "hospital_dia",
        agendamento: "pre_agendamento",
        hospital: "informacoes_gerais",
        especialidade: "informacoes_gerais",
        transplante: "informacoes_gerais",
        ambulatório: "informacoes_gerais",
        ambulatorio: "informacoes_gerais",
    };

    const targetId = aliasMap[cleanId] || cleanId;
    return (
        getKB().setores.find(
            (s) =>
                s.id === targetId ||
                s.id === cleanId ||
                s.nome.toLowerCase() === cleanId ||
                s.nome.toLowerCase().replace(/[-\s]/g, "_") === cleanId
        ) || null
    );
}

export default getKB;
