import { jest } from "@jest/globals";

const mockQuery = jest.fn();
jest.unstable_mockModule("../../infra/database.js", () => ({
  default: { query: mockQuery },
}));

const { default: GetCourtsUseCase } = await import("../../use_cases/GetCourtsUseCase.js");

describe("GetCourtsUseCase", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("deve retornar apenas as quadras ativas", async () => {
    const mockCourts = [
      { id: "123e4567-e89b-12d3-a456-426614174000", name: "Quadra 1", is_active: true },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockCourts });

    const result = await GetCourtsUseCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Quadra 1");

    // Garante que a query aplica o filtro is_active = true
    const queryCall = mockQuery.mock.calls[0][0];
    expect(queryCall).toMatch(/WHERE is_active = true/i);
  });
});