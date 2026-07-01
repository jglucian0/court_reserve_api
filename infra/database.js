import pg from "pg";
const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
      max: 20,
    });
  }
  return pool;
}

async function query(queryObject, values) {
  const client = await getPool().connect();
  try {
    return await client.query(queryObject, values);
  } finally {
    client.release();
  }
}

async function transaction(action) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (originalError) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      const aggregated = new Error(
        `ROLLBACK falhou após erro na transação. Erro original: [${originalError.message}]. Erro do ROLLBACK: [${rollbackError.message}]`,
        { cause: originalError }
      );
      aggregated.name = "TransactionRollbackError";
      throw aggregated;
    }
    throw originalError;
  } finally {
    client.release();
  }
}

async function end() {
  await pool.end();
}

export default { query, transaction, end };