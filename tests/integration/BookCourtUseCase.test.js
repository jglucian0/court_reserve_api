import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";
import { ScheduleConflictError } from "../../infra/errors.js";

async function createActiveCourt(name = "Quadra Test") {
  const result = await database.query(
    "INSERT INTO courts (name) VALUES ($1) RETURNING id;",
    [name]
  );
  return result.rows[0].id;
}

const BASE_RESERVATION = {
  customer_name: "João Silva",
  customer_cpf: "12345678901",
  reservation_date: "2026-06-30",
  start_time: "18:00:00",
  end_time: "19:00:00",
};

describe("BookCourtUseCase", () => {
  beforeEach(async () => {
    await orchestrator.clearDatabase();
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  describe("reserva bem-sucedida", () => {
    it("deve retornar id e payment_status ao reservar um horário livre", async () => {
      const courtId = await createActiveCourt();

      const result = await BookCourtUseCase.execute({
        ...BASE_RESERVATION,
        court_id: courtId,
      });

      expect(result).toMatchObject({
        id: expect.any(String),
        payment_status: "pending",
      });
    });
  });

  describe("conflito de agenda — cenário sequencial", () => {
    it("deve lançar ScheduleConflictError ao tentar reservar um horário já ocupado", async () => {
      const courtId = await createActiveCourt();
      const requestData = { ...BASE_RESERVATION, court_id: courtId };

      await BookCourtUseCase.execute(requestData);

      await expect(BookCourtUseCase.execute(requestData)).rejects.toThrow(
        ScheduleConflictError
      );
    });

    it("deve expor statusCode 409 e name correto no erro de conflito", async () => {
      const courtId = await createActiveCourt();
      const requestData = { ...BASE_RESERVATION, court_id: courtId };

      await BookCourtUseCase.execute(requestData);

      try {
        await BookCourtUseCase.execute(requestData);
        throw new Error("Era esperado que o UseCase lançasse um erro.");
      } catch (err) {
        expect(err).toBeInstanceOf(ScheduleConflictError);
        expect(err.statusCode).toBe(409);
        expect(err.name).toBe("ScheduleConflictError");
        expect(err.message).toMatch(/Conflito de agenda/i);
        expect(err.action).toBeDefined();
      }
    });
  });

  describe("conflito de agenda — race condition simulada", () => {
    it("deve persistir exatamente 1 reserva e rejeitar as demais com ScheduleConflictError ao receber 100 requisições paralelas para o mesmo slot", async () => {
      const courtId = await createActiveCourt();
      const requestData = { ...BASE_RESERVATION, court_id: courtId };

      const concurrentRequests = Array.from({ length: 100 }, () =>
        BookCourtUseCase.execute(requestData)
      );

      const results = await Promise.allSettled(concurrentRequests);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(99);

      for (const { reason } of rejected) {
        expect(reason).toBeInstanceOf(ScheduleConflictError);
        expect(reason.statusCode).toBe(409);
      }

      const { rows } = await database.query(
        "SELECT COUNT(*) AS total FROM reservations;"
      );
      expect(Number(rows[0].total)).toBe(1);
    });
  });
});