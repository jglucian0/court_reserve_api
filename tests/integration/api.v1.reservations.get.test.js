import request from "supertest";
import app from "../../api/v1/app.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";
import { makeBearerToken } from "./helpers/auth.js";

describe("Endpoint GET /api/v1/reservations", () => {
  let activeCourtId;
  const mockUserId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const courtInsert = await database.query(
      "INSERT INTO courts (name) VALUES ('Quadra Leitura') RETURNING id;"
    );
    activeCourtId = courtInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve listar as reservas de uma quadra em uma data específica sem vazar dados sensíveis", async () => {
    await database.query(
      `INSERT INTO reservations (court_id, user_id, customer_name, customer_cpf, reservation_date, start_time, end_time)
       VALUES
       ($1, $2, 'Cliente A', '11111111111', '2026-08-20', '10:00:00', '11:00:00'),
       ($1, $2, 'Cliente B', '22222222222', '2026-08-20', '14:00:00', '15:00:00'),
       ($1, $2, 'Cliente C', '33333333333', '2026-08-21', '10:00:00', '11:00:00');`,
      [activeCourtId, mockUserId]
    );

    const response = await request(app)
      .get(`/api/v1/reservations?court_id=${activeCourtId}&date=2026-08-20`)
      .set("Authorization", makeBearerToken(mockUserId));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].customer_cpf).toBeUndefined();
    expect(response.body[0].start_time).toBeDefined();
  });

  it("deve retornar HTTP 400 se faltar o parâmetro court_id ou date", async () => {
    const token = makeBearerToken(mockUserId);

    const responseNoCourt = await request(app)
      .get("/api/v1/reservations?date=2026-08-20")
      .set("Authorization", token);
    expect(responseNoCourt.status).toBe(400);

    const responseNoDate = await request(app)
      .get(`/api/v1/reservations?court_id=${activeCourtId}`)
      .set("Authorization", token);
    expect(responseNoDate.status).toBe(400);
  });

  it("deve retornar HTTP 401 quando o header Authorization está ausente", async () => {
    const response = await request(app)
      .get(`/api/v1/reservations?court_id=${activeCourtId}&date=2026-08-20`);

    expect(response.status).toBe(401);
    expect(response.body.name).toBe("UnauthorizedError");
  });

  it("deve retornar HTTP 401 quando o token é inválido", async () => {
    const response = await request(app)
      .get(`/api/v1/reservations?court_id=${activeCourtId}&date=2026-08-20`)
      .set("Authorization", "Bearer token.invalido.aqui");

    expect(response.status).toBe(401);
    expect(response.body.name).toBe("InvalidTokenError");
  });
});