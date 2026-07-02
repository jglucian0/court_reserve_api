import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

// ─── Configuração do ambiente ────────────────────────────────────────────────
// JWT_SECRET garantido pelo jest.config.cjs — não sobrescrever aqui.

const { default: AuthMiddleware } = await import("../../api/v1/auth/AuthMiddleware.js");
const { UnauthorizedError, InvalidTokenError } = await import("../../infra/errors.js");

// ─── Fixtures e helpers ───────────────────────────────────────────────────────
// SECRET lido em tempo de execução para usar sempre o mesmo valor que
// o AuthMiddleware usará em jwt.verify() — evita dessincronismo de secret.
const SECRET = () => process.env.JWT_SECRET;
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_EMAIL = "joao@acimar.com";

/** Gera um token válido com o sub e email fornecidos. */
function makeToken(sub = USER_ID, expiresIn = "1h") {
  return jwt.sign({ sub, email: USER_EMAIL }, SECRET(), { expiresIn });
}

/**
 * Cria um mock mínimo do objeto `req` do Express.
 * @param {string|undefined} authHeader - Valor do header Authorization.
 */
function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

/** Cria um mock de `res` que captura o status e o JSON retornados. */
function makeRes() {
  const res = {
    _status: null,
    _body: null,
  };
  res.status = jest.fn((code) => { res._status = code; return res; });
  res.json = jest.fn((body) => { res._body = body; return res; });
  return res;
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe("AuthMiddleware", () => {
  describe("token válido", () => {
    it("deve chamar next() quando o token JWT é válido", () => {
      const req = makeReq(`Bearer ${makeToken()}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("deve injetar req.user.id com o sub do payload JWT", () => {
      const req = makeReq(`Bearer ${makeToken()}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(USER_ID);
    });

    it("não deve vazar dados extras em req.user além do id", () => {
      const req = makeReq(`Bearer ${makeToken()}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      // req.user deve ter apenas `id` — sem email, iat, exp, etc.
      expect(Object.keys(req.user)).toEqual(["id"]);
    });
  });

  describe("header ausente ou malformado", () => {
    it("deve retornar 401 quando o header Authorization está ausente", () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("deve retornar 401 quando o header não começa com 'Bearer '", () => {
      const req = makeReq(`Token ${makeToken()}`); // esquema errado
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body.name).toBe("UnauthorizedError");
      expect(next).not.toHaveBeenCalled();
    });

    it("deve retornar 401 com corpo no padrão de erro de domínio", () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._body).toMatchObject({
        name: "UnauthorizedError",
        status_code: 401,
        action: expect.any(String),
      });
    });
  });

  describe("token inválido ou expirado", () => {
    it("deve retornar 401 para token assinado com secret diferente", () => {
      const forgery = jwt.sign({ sub: USER_ID }, "outra-chave-qualquer");
      const req = makeReq(`Bearer ${forgery}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body.name).toBe("InvalidTokenError");
      expect(next).not.toHaveBeenCalled();
    });

    it("deve retornar 401 para token expirado", () => {
      const expired = makeToken(USER_ID, "-1s"); // já expirado
      const req = makeReq(`Bearer ${expired}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body.name).toBe("InvalidTokenError");
      expect(next).not.toHaveBeenCalled();
    });

    it("deve retornar 401 para token com payload adulterado", () => {
      // Constrói um token com payload trocado mas sem re-assinar
      const validToken = makeToken();
      const [header, , sig] = validToken.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "hacker-id", email: "hacker@acimar.com" })
      ).toString("base64url");
      const tampered = `${header}.${tamperedPayload}.${sig}`;

      const req = makeReq(`Bearer ${tampered}`);
      const res = makeRes();
      const next = jest.fn();

      AuthMiddleware(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
