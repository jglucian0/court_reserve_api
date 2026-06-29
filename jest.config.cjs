const dotenv = require("dotenv");

dotenv.config({ path: ".env.development" });

module.exports = {
  transform: {},
  clearMocks: true,
};