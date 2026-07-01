import supertest from "supertest";
import app from "../../api/v1/app.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";

const request = supertest(app);


const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const BASE_RESERVATION_BODY = {
  user_id: USER_ID,
  customer_name: "Teste Concorrência",
  customer_cpf: "12345678901",
  reservation_date: "2027-08-15",
  start_time: "10:00:00",
  end_time: "11:00:00",
};


async function createActiveCourt(name = "Quadra Concorrência") {
  const result = await database.query(
    "INSERT INTO courts (name) VALUES ($1) RETURNING id;",
    [name]
  );
  return result.rows[0].id;
}

async function countReservations() {
  const { rows } = await database.query(
    "SELECT COUNT(*) AS total FROM reservations;"
  );
  return Number(rows[0].total);
}

async function countPaymentLogs() {
  const { rows } = await database.query(
    "SELECT COUNT(*) AS total FROM payment_logs;"
  );
  return Number(rows[0].total);
}


describe("Testes de concorrência e estresse", () => {
  beforeEach(async () => {
    await orchestrator.clearDatabase();
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });


  describe("BookCourtUseCase — 10 requisições simultâneas para o mesmo slot", () => {
    it("deve criar exatamente 1 reserva e rejeitar 9 com status 409", async () => {
      const courtId = await createActiveCourt();

      const requestBody = { ...BASE_RESERVATION_BODY, court_id: courtId };

      const requests = Array.from({ length: 10 }, () =>
        request.post("/api/v1/reservations").send(requestBody)
      );

      const responses = await Promise.all(requests);

      const created = responses.filter((r) => r.status === 201);
      const conflict = responses.filter((r) => r.status === 409);

      expect(created).toHaveLength(1);
      expect(conflict).toHaveLength(9);

      for (const res of conflict) {
        expect(res.body).toMatchObject({
          name: "ScheduleConflictError",
          status_code: 409,
          action: expect.any(String),
        });
      }

      expect(await countReservations()).toBe(1);
    });

    it("deve criar 1 reserva por slot em slots distintos sem interferência", async () => {
      const courtId = await createActiveCourt();

      const [res1, res2] = await Promise.all([
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtId,
          start_time: "08:00:00",
          end_time: "09:00:00",
        }),
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtId,
          start_time: "09:00:00",
          end_time: "10:00:00",
        }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(await countReservations()).toBe(2);
    });

    it("deve criar 1 reserva por quadra para o mesmo slot em quadras distintas", async () => {
      const [courtA, courtB] = await Promise.all([
        createActiveCourt("Quadra A"),
        createActiveCourt("Quadra B"),
      ]);

      const [resA, resB] = await Promise.all([
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtA,
        }),
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtB,
        }),
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(await countReservations()).toBe(2);
    });
  });


  describe("ProcessPaymentUseCase — 10 requisições simultâneas com a mesma idempotency-key", () => {
    it("deve criar exatamente 1 log de pagamento e rejeitar 9 com status 409", async () => {
      const courtId = await createActiveCourt();

      const reservationRes = await request
        .post("/api/v1/reservations")
        .send({ ...BASE_RESERVATION_BODY, court_id: courtId });

      expect(reservationRes.status).toBe(201);
      const reservationId = reservationRes.body.id;

      const IDEMPOTENCY_KEY = "stress-test-key-shared-001";

      const paymentRequests = Array.from({ length: 10 }, () =>
        request
          .post(`/api/v1/reservations/${reservationId}/payment`)
          .set("idempotency-key", IDEMPOTENCY_KEY)
      );

      const responses = await Promise.all(paymentRequests);

      const success = responses.filter((r) => r.status === 200);
      const conflict = responses.filter((r) => r.status === 409);

      expect(success).toHaveLength(1);
      expect(conflict).toHaveLength(9);

      for (const res of conflict) {
        expect(res.body).toMatchObject({
          name: "IdempotencyConflictError",
          status_code: 409,
          action: expect.any(String),
        });
        expect(res.body.message).toContain(IDEMPOTENCY_KEY);
      }

      expect(await countPaymentLogs()).toBe(1);

      const { rows: logs } = await database.query(
        "SELECT status FROM payment_logs WHERE reservation_id = $1;",
        [reservationId]
      );
      expect(logs).toHaveLength(1);
      expect(["success", "failed"]).toContain(logs[0].status);
    });

    it("deve processar pagamentos distintos em paralelo com chaves diferentes", async () => {
      const [courtA, courtB] = await Promise.all([
        createActiveCourt("Quadra Pay A"),
        createActiveCourt("Quadra Pay B"),
      ]);

      const [resA, resB] = await Promise.all([
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtA,
        }),
        request.post("/api/v1/reservations").send({
          ...BASE_RESERVATION_BODY,
          court_id: courtB,
        }),
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      const [payA, payB] = await Promise.all([
        request
          .post(`/api/v1/reservations/${resA.body.id}/payment`)
          .set("idempotency-key", "key-quadra-a-001"),
        request
          .post(`/api/v1/reservations/${resB.body.id}/payment`)
          .set("idempotency-key", "key-quadra-b-001"),
      ]);

      expect(payA.status).toBe(200);
      expect(payB.status).toBe(200);
      expect(await countPaymentLogs()).toBe(2);
    });
  });


  describe("DeleteReservationUseCase — 10 tentativas simultâneas de deletar a mesma reserva", () => {
    it("deve deletar exatamente 1 vez e retornar 404 nas demais tentativas", async () => {
      const courtId = await createActiveCourt();

      const reservationRes = await request
        .post("/api/v1/reservations")
        .send({ ...BASE_RESERVATION_BODY, court_id: courtId });

      expect(reservationRes.status).toBe(201);
      const reservationId = reservationRes.body.id;

      const deleteRequests = Array.from({ length: 10 }, () =>
        request
          .delete(`/api/v1/reservations/${reservationId}`)
          .set("x-user-id", USER_ID)
      );

      const responses = await Promise.all(deleteRequests);

      const deleted = responses.filter((r) => r.status === 204);
      const notFound = responses.filter((r) => r.status === 404);

      expect(deleted).toHaveLength(1);
      expect(notFound).toHaveLength(9);

      expect(await countReservations()).toBe(0);
    });
  });
});
