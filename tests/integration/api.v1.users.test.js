import request from "supertest";
import app from "../../api/v1/app.js";
import orchestrator from "../../infra/orchestrator.js";

describe("Endpoint POST /api/v1/users", () => {
  beforeEach(async () => {
    await orchestrator.clearDatabase();
  });

  afterAll(async () => {
    await orchestrator.closeConnection();
  });

  it("deve registrar um usuário com sucesso e retornar HTTP 201", async () => {
    const response = await request(app)
      .post("/api/v1/users")
      .send({
        name: "Novo Usuário",
        email: "novo@acimar.com",
        password: "senha123",
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.password).toBeUndefined();
  });

  it("deve retornar HTTP 409 ao tentar registrar e-mail duplicado", async () => {
    await request(app).post("/api/v1/users").send({
      name: "User 1",
      email: "duplicado@acimar.com",
      password: "senha123",
    });

    const response = await request(app).post("/api/v1/users").send({
      name: "User 2",
      email: "duplicado@acimar.com",
      password: "senha456",
    });

    expect(response.status).toBe(409);
    expect(response.body.name).toBe("ConflictError");
  });

  it("deve retornar HTTP 400 se faltarem campos obrigatórios", async () => {
    const response = await request(app).post("/api/v1/users").send({
      name: "Falta Email",
    });

    expect(response.status).toBe(400);
    expect(response.body.name).toBe("ValidationError");
  });
});