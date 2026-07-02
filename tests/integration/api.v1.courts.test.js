import request from "supertest";
import app from "../../api/v1/app.js";
import orchestrator from "../../infra/orchestrator.js";
import database from "../../infra/database.js";
import jwt from "jsonwebtoken";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const validToken = jwt.sign({ sub: USER_ID }, process.env.JWT_SECRET || "test-secret-key-global");
const bearerToken = `Bearer ${validToken}`;

describe("Endpoints /api/v1/courts", () => {
  beforeEach(async () => {
    await orchestrator.clearDatabase();
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  describe("GET /api/v1/courts", () => {
    it("deve listar todas as quadras ativas retornando HTTP 200", async () => {
      await database.query("INSERT INTO courts (name, is_active) VALUES ('Quadra A', true);");
      await database.query("INSERT INTO courts (name, is_active) VALUES ('Quadra B', false);");

      const response = await request(app).get("/api/v1/courts");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Quadra A");
    });
  });

  describe("POST /api/v1/courts", () => {
    it("deve criar uma quadra com sucesso retornando HTTP 201 (requer autenticação)", async () => {
      const response = await request(app)
        .post("/api/v1/courts")
        .set("Authorization", bearerToken)
        .send({ name: "Quadra Society" });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe("Quadra Society");
      expect(response.body.is_active).toBe(true);
    });

    it("deve retornar HTTP 400 se o nome não for enviado", async () => {
      const response = await request(app)
        .post("/api/v1/courts")
        .set("Authorization", bearerToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.name).toBe("ValidationError");
    });

    it("deve retornar HTTP 401 se o token JWT não for enviado", async () => {
      const response = await request(app)
        .post("/api/v1/courts")
        .send({ name: "Quadra Não Autorizada" });

      expect(response.status).toBe(401);
    });
  });
});