import "dotenv/config";

async function listar() {
    try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
        });
        const data = await res.json();
        if (data.data) {
            console.log("=== MODELOS DISPONÍVEIS NA SUA CONTA GROQ ===");
            data.data.forEach(m => console.log(`- ${m.id}`));
        } else {
            console.log("Erro na resposta:", data);
        }
    } catch (e) {
        console.error("Erro ao listar modelos:", e);
    }
}

listar();
