import request from "supertest";
import app from "../../api/v1/app.js";
import database from "../../infra/database.js";
import orchestrator from "../../infra/orchestrator.js";

describe("Endpoint POST /api/v1/reservations", () => {
  let activeCourtId;

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const courtInsert = await database.query(`
      INSERT INTO courts (name) VALUES ('Quadra HTTP') RETURNING id;
    `);
    activeCourtId = courtInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  describe("Regras de Negócio e Sucesso", () => {
    it("deve criar uma reserva com sucesso e retornar HTTP 201", async () => {
      const payload = {
        court_id: activeCourtId,
        customer_name: "Cliente Web",
        customer_cpf: "11122233344",
        reservation_date: "2026-07-15",
        start_time: "10:00:00",
        end_time: "11:00:00",
      };

      const response = await request(app)
        .post("/api/v1/reservations")
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.payment_status).toBe("pending");
    });

    it("deve retornar HTTP 400 se o caso de uso rejeitar por conflito de horário", async () => {
      const payload = {
        court_id: activeCourtId,
        customer_name: "Cliente Web 2",
        customer_cpf: "55566677788",
        reservation_date: "2026-07-15",
        start_time: "10:00:00",
        end_time: "11:00:00",
      };

      await database.query(
        `INSERT INTO reservations (court_id, customer_name, customer_cpf, reservation_date, start_time, end_time) 
         VALUES ($1, 'Cliente Antigo', '00000000000', '2026-07-15', '10:00:00', '11:00:00');`,
        [activeCourtId]
      );

      const response = await request(app)
        .post("/api/v1/reservations")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.name).toBe("ValidationError");
      expect(response.body.message).toMatch(/indisponível|conflito/i);
    });
  });

  describe("Validação de Dados (Input)", () => {
    it("deve retornar HTTP 400 se faltarem campos obrigatórios", async () => {
      const payload = {
        customer_name: "João Silva",
        reservation_date: "2026-07-15",
      };

      const response = await request(app)
        .post("/api/v1/reservations")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.name).toBe("ValidationError");
    });

    it("deve retornar HTTP 400 se o horário de término for menor ou igual ao de início", async () => {
      const payload = {
        court_id: activeCourtId,
        customer_name: "João Silva",
        customer_cpf: "11122233344",
        reservation_date: "2026-07-15",
        start_time: "11:00:00",
        end_time: "10:00:00",
      };

      const response = await request(app)
        .post("/api/v1/reservations")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.name).toBe("ValidationError");
      expect(response.body.message).toMatch(/horário/i);
    });

    it("deve retornar HTTP 400 se o court_id não for um UUID válido", async () => {
      const payload = {
        court_id: "id-invalido-123",
        customer_name: "João Silva",
        customer_cpf: "11122233344",
        reservation_date: "2026-07-15",
        start_time: "10:00:00",
        end_time: "11:00:00",
      };

      const response = await request(app)
        .post("/api/v1/reservations")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.name).toBe("ValidationError");
      expect(response.body.message).toMatch(/uuid/i);
    });
  });
});