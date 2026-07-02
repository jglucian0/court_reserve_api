import bcrypt from "bcrypt";
import database from "../infra/database.js";
import { ConflictError } from "../infra/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

async function execute({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await database.query(
      `INSERT INTO users (name, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, email;`,
      [name, email, passwordHash]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError({ message: "Este e-mail já está em uso." });
    }
    throw error;
  }
}

export default { execute };