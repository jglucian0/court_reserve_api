import jwt from "jsonwebtoken";

/**
 * Gera um Bearer token JWT válido para uso nos testes de integração.
 *
 * Usa o JWT_SECRET do ambiente (.env.development carregado pelo jest.config.cjs).
 * O sub é o UUID do usuário — o mesmo que será injetado em req.user.id
 * pelo AuthMiddleware.
 *
 * @param {string} userId - UUID do usuário a ser incluído no `sub` do token.
 * @returns {string} Bearer token no formato "Bearer <jwt>"
 */
export function makeBearerToken(userId) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET não definido. Verifique o .env.development e o jest.config.cjs."
    );
  }

  const token = jwt.sign({ sub: userId, email: "test@acimar.com" }, secret, {
    expiresIn: "1h",
  });

  return `Bearer ${token}`;
}
