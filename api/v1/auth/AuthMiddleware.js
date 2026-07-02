import jwt from "jsonwebtoken";
import { InvalidTokenError, UnauthorizedError } from "../../../infra/errors.js";

/**
 * Middleware de autenticação JWT.
 *
 * Fluxo:
 *  1. Extrai o Bearer token do header `Authorization`.
 *  2. Verifica assinatura e expiração via `jwt.verify`.
 *  3. Injeta `req.user = { id: payload.sub }` para uso nos controllers/UseCases.
 *  4. Em caso de falha, responde com 401 — nunca com 403, pois o problema
 *     aqui é autenticação (identidade desconhecida), não autorização (permissão).
 *
 * Por que não lançar o erro e usar o error handler global?
 * O Express 5 propaga erros de middlewares async automaticamente, mas manter
 * a resposta aqui torna o middleware autocontido e testável de forma isolada.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function AuthMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new UnauthorizedError({
      message: "Token de autenticação ausente.",
      action: "Envie o header Authorization: Bearer <token>.",
    });
    return res.status(error.statusCode).json(error.toJSON());
  }

  const token = authHeader.slice(7); // remove "Bearer "
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não está definido nas variáveis de ambiente.");
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.sub };
    return next();
  } catch (err) {
    const error = new InvalidTokenError({ cause: err });
    return res.status(error.statusCode).json(error.toJSON());
  }
}

export default AuthMiddleware;
