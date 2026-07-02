import database from "../infra/database.js";
import { ConflictError } from "../infra/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

async function execute({ name }) {
  try {
    const result = await database.query(
      "INSERT INTO courts (name, is_active) VALUES ($1, true) RETURNING id, name, is_active;",
      [name]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError({ message: "Já existe uma quadra com este nome." });
    }
    throw error;
  }
}

export default { execute };