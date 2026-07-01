import express from "express";
import cors from "cors";
import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import GetReservationsUseCase from "../../use_cases/GetReservationsUseCase.js";
import ReservationValidator from "../../domain/validators/ReservationValidator.js";
import DeleteReservationUseCase from "../../use_cases/DeleteReservationUseCase.js";
import { ValidationError, InternalServerError, ScheduleConflictError, ForbiddenError, NotFoundError, IdempotencyConflictError, PaymentGatewayError } from "../../infra/errors.js";
import ProcessPaymentUseCase from "../../use_cases/ProcessPaymentUseCase.js";
import UpdateReservationStatusUseCase from "../../use_cases/UpdateReservationStatusUseCase.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/v1/reservations", async (req, res) => {
  try {
    const { court_id, date } = req.query;

    if (!court_id || !date) {
      const validationError = new ValidationError({
        message: "Os parâmetros 'court_id' e 'date' são obrigatórios na query string.",
      });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    // userId virá do token JWT após a camada de autenticação ser implementada.
    // Por ora é lido do header x-user-id para permitir integração sem auth.
    const userId = req.headers["x-user-id"];

    if (!userId) {
      const forbiddenError = new ForbiddenError({
        message: "Identificação do usuário ausente.",
        action: "Forneça o header x-user-id na requisição.",
      });
      return res.status(forbiddenError.statusCode).json(forbiddenError.toJSON());
    }

    const reservations = await GetReservationsUseCase.execute({ court_id, date, userId });

    return res.status(200).json(reservations);
  } catch (error) {
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

app.post("/api/v1/reservations", async (req, res) => {
  try {
    ReservationValidator.validate(req.body);
    const result = await BookCourtUseCase.execute(req.body);
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

    const userId = req.headers["x-user-id"];

    if (!userId) {
      const forbiddenError = new ForbiddenError({
        message: "Identificação do usuário ausente.",
        action: "Forneça o header x-user-id na requisição.",
      });
      return res.status(forbiddenError.statusCode).json(forbiddenError.toJSON());
    }

    await DeleteReservationUseCase.execute({ id, userId });

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

export default app;