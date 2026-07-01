import request from "supertest";
import app from "../../api/v1/app.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";

describe("Endpoint PATCH /api/v1/reservations/:id/status", () => {
  let activeCourtId;
  let pendingReservationId;

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const courtInsert = await database.query(`
      INSERT INTO courts (name) VALUES ('Quadra Patch') RETURNING id;
    `);
    activeCourtId = courtInsert.rows[0].id;

    const reservationInsert = await database.query(
      `INSERT INTO reservations (court_id, customer_name, customer_cpf, reservation_date, start_time, end_time, payment_status) 
       VALUES ($1, 'Cliente Teste', '11122233344', '2026-09-10', '18:00:00', '19:00:00', 'pending') RETURNING id;`,
      [activeCourtId]
    );
    pendingReservationId = reservationInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve atualizar o status de pagamento para 'paid' e retornar HTTP 200", async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${pendingReservationId}/status`)
      .send({ status: "paid" });

    expect(response.status).toBe(200);
    expect(response.body.payment_status).toBe("paid");

    const dbCheck = await database.query("SELECT payment_status FROM reservations WHERE id = $1", [pendingReservationId]);
    expect(dbCheck.rows[0].payment_status).toBe("paid");
  });

  it("deve retornar HTTP 400 se o status enviado for inválido", async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${pendingReservationId}/status`)
      .send({ status: "finalizado" });

    expect(response.status).toBe(400);
    expect(response.body.name).toBe("ValidationError");
  });

  it("deve retornar HTTP 404 se a reserva não existir", async () => {
    const randomUuid = "123e4567-e89b-12d3-a456-426614174000";

    const response = await request(app)
      .patch(`/api/v1/reservations/${randomUuid}/status`)
      .send({ status: "cancelled" });

    expect(response.status).toBe(404);
    expect(response.body.name).toBe("NotFoundError");
  });
});