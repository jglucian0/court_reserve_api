import database from "./database.js";

async function clearDatabase() {
  await database.query("TRUNCATE TABLE reservations, courts CASCADE;");
}

async function closeConnection() {
  await database.end();
}

const orchestrator = {
  clearDatabase,
  closeConnection,
};

export default orchestrator;