import request from "supertest";
import app from "../../api/v1/app.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";

describe("Endpoint GET /api/v1/reservations", () => {
  let activeCourtId;

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const courtInsert = await database.query(`
      INSERT INTO courts (name) VALUES ('Quadra Leitura') RETURNING id;
    `);
    activeCourtId = courtInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve listar as reservas de uma quadra em uma data específica sem vazar dados sensíveis", async () => {
    // 1. Setup: Insere reservas no banco. Duas na data alvo, uma em data diferente.
    await database.query(
      `INSERT INTO reservations (court_id, customer_name, customer_cpf, reservation_date, start_time, end_time) 
       VALUES 
       ($1, 'Cliente A', '11111111111', '2026-08-20', '10:00:00', '11:00:00'),
       ($1, 'Cliente B', '22222222222', '2026-08-20', '14:00:00', '15:00:00'),
       ($1, 'Cliente C', '33333333333', '2026-08-21', '10:00:00', '11:00:00');`,
      [activeCourtId]
    );

    // 2. Requisição para a data específica
    const response = await request(app)
      .get(`/api/v1/reservations?court_id=${activeCourtId}&date=2026-08-20`);

    // 3. Asserções
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);

    // Garante que o CPF não foi retornado (Clean Code/Segurança)
    expect(response.body[0].customer_cpf).toBeUndefined();
    expect(response.body[0].start_time).toBeDefined();
    expect(response.body[0].end_time).toBeDefined();
  });

  it("deve retornar HTTP 400 se faltar o parâmetro court_id ou date", async () => {
    const responseNoCourt = await request(app).get("/api/v1/reservations?date=2026-08-20");
    expect(responseNoCourt.status).toBe(400);

    const responseNoDate = await request(app).get(`/api/v1/reservations?court_id=${activeCourtId}`);
    expect(responseNoDate.status).toBe(400);
  });
});