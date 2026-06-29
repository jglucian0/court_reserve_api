import express from "express";
import cors from "cors";
import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import GetReservationsUseCase from "../../use_cases/GetReservationsUseCase.js";
import ReservationValidator from "../../domain/validators/ReservationValidator.js";
import { ValidationError, InternalServerError } from "../../infra/errors.js";

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

    const reservations = await GetReservationsUseCase.execute({ court_id, date });

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
    if (error.message.includes("indisponível") || error.message.includes("não encontrada")) {
      const validationError = new ValidationError({ message: error.message });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }
    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

export default app;