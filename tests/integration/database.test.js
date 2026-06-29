import database from "../../infra/database.js";

describe("Infraestrutura de Banco de Dados", () => {
  it("deve conectar ao banco e executar uma query simples via Pool", async () => {
    const result = await database.query("SELECT 1 + 1 AS sum");

    expect(result.rows[0].sum).toBe(2);
  });

  it("deve executar uma transação (BEGIN/COMMIT) com sucesso", async () => {
    const expectedValue = 4;

    const result = await database.transaction(async (client) => {
      const res = await client.query("SELECT 2 + 2 AS sum");
      return res.rows[0].sum;
    });

    expect(result).toBe(expectedValue);
  });

  it("deve realizar o ROLLBACK em caso de erro na transação", async () => {
    const errorMessage = "Erro forçado na transação";

    await expect(database.transaction(async (client) => {
      await client.query("SELECT 1");
      throw new Error(errorMessage);
    })).rejects.toThrow(errorMessage);
  });
});