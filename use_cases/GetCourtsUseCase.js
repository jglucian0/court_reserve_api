import database from "../infra/database.js";

async function execute() {
  const result = await database.query(
    "SELECT id, name, is_active FROM courts WHERE is_active = true ORDER BY name ASC;"
  );
  return result.rows;
}

export default { execute };