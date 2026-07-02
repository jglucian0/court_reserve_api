import { jest } from "@jest/globals";
import bcrypt from "bcrypt";

process.env.JWT_EXPIRES_IN = "1h";

const mockQuery = jest.fn();
jest.unstable_mockModule("../../infra/database.js", () => ({
  default: { query: mockQuery },
}));

const { default: LoginUseCase } = await import("../../use_cases/LoginUseCase.js");
const { UnauthorizedError } = await import("../../infra/errors.js");
const jwt = (await import("jsonwebtoken")).default;

const VALID_USER = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  email: "joao@acimar.com",
  password: "senha123",
};

describe("LoginUseCase", () => {
  beforeAll(async () => {
    VALID_USER.password_hash = await bcrypt.hash(VALID_USER.password, 10);
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("credenciais válidas", () => {
    it("deve retornar um token JWT ao receber credenciais corretas", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [VALID_USER] });

      const result = await LoginUseCase.execute({
        email: VALID_USER.email,
        password: VALID_USER.password,
      });

      expect(result).toHaveProperty("token");
      expect(typeof result.token).toBe("string");
      expect(result.token.split(".")).toHaveLength(3);
    });

    it("o token deve conter o sub com o UUID do usuário", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [VALID_USER] });

      const { token } = await LoginUseCase.execute({
        email: VALID_USER.email,
        password: VALID_USER.password,
      });

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      expect(payload.sub).toBe(VALID_USER.id);
      expect(payload.email).toBe(VALID_USER.email);
    });
  });

  describe("credenciais inválidas", () => {
    it("deve lançar UnauthorizedError para senha incorreta", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [VALID_USER] });

      await expect(
        LoginUseCase.execute({ email: VALID_USER.email, password: "senha-errada" })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("deve lançar UnauthorizedError para e-mail inexistente", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        LoginUseCase.execute({ email: "nao@existe.com", password: VALID_USER.password })
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});