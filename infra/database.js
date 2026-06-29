import { Pool } from "pg";
import { ServiceError } from "./errors.js";

const sslConfig =
  process.env.POSTGRES_HOST === "localhost"
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  ssl: sslConfig,
  max: 20,
});

async function query(queryObject, values) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(queryObject, values);
    return result;
  } catch (error) {
    throw new ServiceError({
      message: "Erro na conexão com o Banco ou na Query.",
      cause: error,
    });
  } finally {
    if (client) client.release();
  }
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function end() {
  await pool.end();
}

const database = {
  query,
  transaction,
  end,
};

export default database;