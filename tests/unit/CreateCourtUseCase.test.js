import { jest } from "@jest/globals";

const mockQuery = jest.fn();
jest.unstable_mockModule("../../infra/database.js", () => ({
  default: { query: mockQuery },
}));

const { default: CreateCourtUseCase } = await import("../../use_cases/CreateCourtUseCase.js");
const { ConflictError } = await import("../../infra/errors.js");

const PG_UNIQUE_VIOLATION = "23505";

describe("CreateCourtUseCase", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("deve criar uma nova quadra e retornar os dados", async () => {
    const mockCreatedCourt = { id: "uuid", name: "Nova Quadra", is_active: true };
    mockQuery.mockResolvedValueOnce({ rows: [mockCreatedCourt] });

    const result = await CreateCourtUseCase.execute({ name: "Nova Quadra" });

    expect(result.id).toBe(mockCreatedCourt.id);
    expect(result.name).toBe("Nova Quadra");
  });

  it("deve lançar ConflictError se já existir uma quadra com o mesmo nome", async () => {
    mockQuery.mockRejectedValueOnce({ code: PG_UNIQUE_VIOLATION });

    await expect(CreateCourtUseCase.execute({ name: "Quadra Duplicada" }))
      .rejects.toThrow(ConflictError);
  });
});