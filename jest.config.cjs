const dotenv = require("dotenv");

dotenv.config({ path: ".env.development" });

// Garante que JWT_SECRET exista em todos os ambientes de teste.
// O valor do .env.development é usado quando disponível;
// este fallback cobre execuções sem o arquivo (CI, containers limpos).
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-fallback-do-not-use-in-production";
}

module.exports = {
  transform: {},
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/setup.js"],
};