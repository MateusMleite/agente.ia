import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool = null;

export function isDbConfigured() {
    // Retorna true se houver DATABASE_URL ou se os dados de conexão estiverem preenchidos
    if (process.env.DATABASE_URL) return true;
    const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
    return Boolean(DB_HOST && DB_NAME && DB_USER && DB_PASSWORD);
}

function getPool() {
    if (!pool && isDbConfigured()) {
        try {
            if (process.env.DATABASE_URL) {
                pool = mysql.createPool(process.env.DATABASE_URL);
            } else {
                pool = mysql.createPool({
                    host: process.env.DB_HOST || "localhost",
                    port: Number(process.env.DB_PORT) || 3306,
                    database: process.env.DB_NAME,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0,
                });
            }
            console.log("🗄️ [MySQL] Pool de conexões inicializado com sucesso.");
        } catch (err) {
            console.error("❌ [MySQL] Erro ao criar pool:", err.message);
            pool = null;
        }
    }
    return pool;
}

export async function query(sql, params = []) {
    const activePool = getPool();
    if (!activePool) {
        return null;
    }
    const [results] = await activePool.execute(sql, params);
    return results;
}

export default { query, isDbConfigured };