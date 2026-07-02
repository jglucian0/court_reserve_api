import { jest } from "@jest/globals";
import bcrypt from "bcrypt";

const mockQuery = jest.fn();
jest.unstable_mockModule("../../infra/database.js", () => ({
  default: { query: mockQuery },
}));

const { default: RegisterUserUseCase } = await import("../../use_cases/RegisterUserUseCase.js");
const { ConflictError } = await import("../../infra/errors.js");

describe("RegisterUserUseCase", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("deve criar um usuário e retornar os dados sem a senha", async () => {
    const mockUser = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Teste", email: "teste@acimar.com" };
    mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

    const result = await RegisterUserUseCase.execute({
      name: "Teste",
      email: "teste@acimar.com",
      password: "senha_segura",
    });

    expect(result.id).toBe(mockUser.id);
    expect(result.name).toBe(mockUser.name);
    expect(result.password).toBeUndefined();
    expect(result.password_hash).toBeUndefined();

    const insertCall = mockQuery.mock.calls[0];
    const passedHash = insertCall[1][2];
    expect(passedHash).not.toBe("senha_segura");
    expect(bcrypt.compareSync("senha_segura", passedHash)).toBe(true);
  });

  it("deve lançar ConflictError se o e-mail já existir (código 23505 do Postgres)", async () => {
    mockQuery.mockRejectedValueOnce({ code: "23505" });

    await expect(
      RegisterUserUseCase.execute({
        name: "Teste",
        email: "existente@acimar.com",
        password: "senha",
      })
    ).rejects.toThrow(ConflictError);
  });
});