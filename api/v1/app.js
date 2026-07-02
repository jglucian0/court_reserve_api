import express from "express";
import cors from "cors";
import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import GetReservationsUseCase from "../../use_cases/GetReservationsUseCase.js";
import ReservationValidator from "../../domain/validators/ReservationValidator.js";
import DeleteReservationUseCase from "../../use_cases/DeleteReservationUseCase.js";
import ProcessPaymentUseCase from "../../use_cases/ProcessPaymentUseCase.js";
import UpdateReservationStatusUseCase from "../../use_cases/UpdateReservationStatusUseCase.js";
import LoginUseCase from "../../use_cases/LoginUseCase.js";
import AuthMiddleware from "./auth/AuthMiddleware.js";
import RegisterUserUseCase from "../../use_cases/RegisterUserUseCase.js";
import GetCourtsUseCase from "../../use_cases/GetCourtsUseCase.js";
import CreateCourtUseCase from "../../use_cases/CreateCourtUseCase.js";
import HandlePaymentWebhookUseCase from "../../use_cases/HandlePaymentWebhookUseCase.js";
import {
  ValidationError,
  InternalServerError,
  ScheduleConflictError,
  NotFoundError,
  ForbiddenError,
  IdempotencyConflictError,
  PaymentGatewayError,
  UnauthorizedError,
  ConflictError,
} from "../../infra/errors.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/v1/reservations", AuthMiddleware);

// ── Rota pública: Login ───────────────────────────────────────────────────────
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new ValidationError({
        message: "Os campos 'email' e 'password' são obrigatórios.",
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    const result = await LoginUseCase.execute({ email, password });
    return res.status(200).json(result);
  } catch (error) {
    if (error.name === "UnauthorizedError") {
      return res.status(error.statusCode).json(error.toJSON());
    }
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

// ── Rotas protegidas: requerem JWT válido via AuthMiddleware ──────────────────
app.get("/api/v1/reservations", async (req, res) => {
  try {
    const { court_id, date } = req.query;

    if (!court_id || !date) {
      const error = new ValidationError({
        message: "Os parâmetros 'court_id' e 'date' são obrigatórios na query string.",
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    // req.user.id é injetado pelo AuthMiddleware após validar o JWT.
    const reservations = await GetReservationsUseCase.execute({
      court_id,
      date,
      userId: req.user.id,
    });

    return res.status(200).json(reservations);
  } catch (error) {
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/reservations", async (req, res) => {
  try {
    const payload = { ...req.body, user_id: req.user.id };

    ReservationValidator.validate(payload);
    const result = await BookCourtUseCase.execute(payload);
    return res.status(201).json(result);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (error.name === "ScheduleConflictError") {
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (error.message === "Quadra não encontrada ou inativa.") {
      const validationError = new ValidationError({ message: error.message });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    console.error("--- ERRO NO CONTROLLER ---");
    console.error(error);

    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.patch("/api/v1/reservations/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["paid", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      const validationError = new ValidationError({ message: "Status inválido." });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    const result = await UpdateReservationStatusUseCase.execute({ id, status });

    return res.status(200).json(result);
  } catch (error) {
    if (error.name === "NotFoundError") {
      return res.status(error.statusCode).json(error.toJSON());
    }

    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/reservations/:id/payment", async (req, res) => {
  try {
    const { id: reservationId } = req.params;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey) {
      const validationError = new ValidationError({
        message: "O header 'idempotency-key' é obrigatório.",
        action: "Gere uma chave única (ex: UUID v4) e envie no header 'idempotency-key'.",
      });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    const result = await ProcessPaymentUseCase.execute({ reservationId, idempotencyKey });

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.name === "NotFoundError" ||
      error.name === "IdempotencyConflictError" ||
      error.name === "PaymentGatewayError"
    ) {
      return res.status(error.statusCode).json(error.toJSON());
    }

    console.error("--- ERRO NO PAYMENT ---");
    console.error(error);
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.delete("/api/v1/reservations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // req.user.id é injetado pelo AuthMiddleware.
    await DeleteReservationUseCase.execute({ id, userId: req.user.id });

    return res.status(204).send();
  } catch (error) {
    if (error.name === "NotFoundError" || error.name === "ForbiddenError") {
      return res.status(error.statusCode).json(error.toJSON());
    }
    console.error("DEBUG - Erro no DELETE:", error);
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      const error = new ValidationError({
        message: "Os campos 'name', 'email' e 'password' são obrigatórios.",
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    const result = await RegisterUserUseCase.execute({ name, email, password });
    return res.status(201).json(result);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "ConflictError") {
      return res.status(error.statusCode).json(error.toJSON());
    }
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.get("/api/v1/courts", async (req, res) => {
  try {
    const courts = await GetCourtsUseCase.execute();
    return res.status(200).json(courts);
  } catch (error) {
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/courts", AuthMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      const error = new ValidationError({
        message: "O campo 'name' é obrigatório.",
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    const court = await CreateCourtUseCase.execute({ name: name.trim() });
    return res.status(201).json(court);
  } catch (error) {
    if (error.name === "ConflictError") {
      return res.status(error.statusCode).json(error.toJSON());
    }
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/webhooks/payment", async (req, res) => {
  try {
    const signature = req.headers["x-gateway-signature"];

    if (!signature) {
      const error = new UnauthorizedError({
        message: "Header 'x-gateway-signature' ausente.",
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Passa o body cru (como objeto) e a assinatura para o UseCase validar
    await HandlePaymentWebhookUseCase.execute({
      payload: req.body,
      signature,
    });

    return res.status(200).send("OK");
  } catch (error) {
    if (error.name === "UnauthorizedError" || error.name === "NotFoundError") {
      return res.status(error.statusCode).json(error.toJSON());
    }

    console.error("--- ERRO NO WEBHOOK ---", error);
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

export default app;