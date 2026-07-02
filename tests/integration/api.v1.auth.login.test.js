import request from "supertest";
import app from "../../api/v1/app.js";
import jwt from "jsonwebtoken";
import orchestrator from "../../infra/orchestrator.js";
import database from "../../infra/database.js";
import bcrypt from "bcrypt";

describe("Endpoint POST /api/v1/auth/login", () => {
  let activeUserId;

  beforeEach(async () => {
    await orchestrator.clearDatabase();

    const hash = await bcrypt.hash("senha123", 10);
    const userInsert = await database.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id;`,
      ["João", "joao@acimar.com", hash]
    );
    activeUserId = userInsert.rows[0].id;
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  describe("login bem-sucedido", () => {
    it("deve retornar HTTP 200 e um token JWT para credenciais válidas", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "joao@acimar.com", password: "senha123" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body.token.split(".")).toHaveLength(3);
    });

    it("o token deve ter sub igual ao UUID do usuário autenticado no banco", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "joao@acimar.com", password: "senha123" });

      const payload = jwt.decode(response.body.token);

      expect(payload.sub).toBe(activeUserId);
      expect(payload.email).toBe("joao@acimar.com");
    });

    it("o token não deve conter a senha no payload", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "joao@acimar.com", password: "senha123" });

      const payload = jwt.decode(response.body.token);

      expect(payload.password).toBeUndefined();
    });
  });

  describe("credenciais inválidas", () => {
    it("deve retornar HTTP 401 para senha incorreta", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "joao@acimar.com", password: "senha-errada" });

      expect(response.status).toBe(401);
      expect(response.body.name).toBe("UnauthorizedError");
    });

    it("deve retornar HTTP 401 para e-mail inexistente", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "fantasma@acimar.com", password: "senha123" });

      expect(response.status).toBe(401);
      expect(response.body.name).toBe("UnauthorizedError");
    });

    it("deve retornar a mesma mensagem para e-mail errado e senha errada (anti-enumeration)", async () => {
      const [resBadPass, resBadEmail] = await Promise.all([
        request(app).post("/api/v1/auth/login").send({ email: "joao@acimar.com", password: "errada" }),
        request(app).post("/api/v1/auth/login").send({ email: "nao@existe.com", password: "senha123" }),
      ]);

      expect(resBadPass.body.message).toBe(resBadEmail.body.message);
    });
  });
});