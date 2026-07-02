import request from "supertest";
import app from "../../api/v1/app.js";
import orchestrator from "../../infra/orchestrator.js";
import database from "../../infra/database.js";
import crypto from "crypto";

const WEBHOOK_SECRET = "integration_test_secret";

function generateSignature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

describe("Endpoint POST /api/v1/webhooks/payment", () => {
  let pendingReservationId;

  beforeAll(() => {
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const courtInsert = await database.query("INSERT INTO courts (name) VALUES ('Webhook Court') RETURNING id;");
    const courtId = courtInsert.rows[0].id;

    // Insere um usuário dummy para respeitar a FK
    const userInsert = await database.query("INSERT INTO users (name, email, password_hash) VALUES ('W', 'w@acimar.com', 'hash') RETURNING id;");
    const userId = userInsert.rows[0].id;

    const resInsert = await database.query(
      `INSERT INTO reservations (court_id, user_id, customer_name, customer_cpf, reservation_date, start_time, end_time, payment_status) 
       VALUES ($1, $2, 'Cliente', '12312312312', '2026-10-10', '10:00:00', '11:00:00', 'pending') RETURNING id;`,
      [courtId, userId]
    );
    pendingReservationId = resInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve processar o webhook e retornar 200 OK (Gateway Autenticado)", async () => {
    const payload = { type: "payment.success", data: { reservation_id: pendingReservationId } };
    const signature = generateSignature(payload, WEBHOOK_SECRET);

    const response = await request(app)
      .post("/api/v1/webhooks/payment")
      .set("x-gateway-signature", signature)
      .send(payload);

    expect(response.status).toBe(200);

    const dbCheck = await database.query("SELECT payment_status FROM reservations WHERE id = $1", [pendingReservationId]);
    expect(dbCheck.rows[0].payment_status).toBe("paid");
  });

  it("deve retornar 401 Unauthorized se a assinatura não for enviada", async () => {
    const payload = { type: "payment.success", data: { reservation_id: pendingReservationId } };

    const response = await request(app)
      .post("/api/v1/webhooks/payment")
      .send(payload);

    expect(response.status).toBe(401);
  });
});