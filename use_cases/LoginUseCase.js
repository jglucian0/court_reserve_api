import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import database from "../infra/database.js";
import { UnauthorizedError } from "../infra/errors.js";

async function execute({ email, password }) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não está definido nas variáveis de ambiente.");
  }

  const result = await database.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1;",
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    throw new UnauthorizedError({
      message: "Credenciais inválidas.",
      action: "Verifique o e-mail e a senha e tente novamente.",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new UnauthorizedError({
      message: "Credenciais inválidas.",
      action: "Verifique o e-mail e a senha e tente novamente.",
    });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "1d" }
  );

  return { token };
}

export default { execute };