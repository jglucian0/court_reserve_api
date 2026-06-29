import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";

describe("BookCourtUseCase", () => {
  beforeEach(async () => {
    await orchestrator.clearDatabase();
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve processar apenas uma reserva em 100 requisições simultâneas para o mesmo horário", async () => {
    const courtInsert = await database.query(`
      INSERT INTO courts (name) VALUES ('Quadra ACIMAR 1') RETURNING id;
    `);
    const courtId = courtInsert.rows[0].id;

    const requestData = {
      court_id: courtId,
      customer_name: "João Silva",
      customer_cpf: "12345678901",
      reservation_date: "2026-06-30",
      start_time: "18:00:00",
      end_time: "19:00:00",
    };

    const requests = Array.from({ length: 100 }).map(() =>
      BookCourtUseCase.execute(requestData)
    );

    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    expect(rejected[0].reason.message).toMatch(/Horário indisponível|Conflito/i);

    const dbCheck = await database.query("SELECT count(*) FROM reservations");
    expect(parseInt(dbCheck.rows[0].count, 10)).toBe(1);
  });
});