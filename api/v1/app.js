import express from "express";
import cors from "cors";
import BookCourtUseCase from "../../use_cases/BookCourtUseCase.js";
import { ValidationError, InternalServerError } from "../../infra/errors.js";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/v1/reservations", async (req, res) => {
  try {
    const result = await BookCourtUseCase.execute(req.body);

    return res.status(201).json(result);
  } catch (error) {
    if (error.message.includes("indisponível") || error.message.includes("não encontrada")) {
      const validationError = new ValidationError({ message: error.message });
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    const serverError = new InternalServerError({ cause: error });
    return res.status(serverError.statusCode).json(serverError.toJSON());
  }
});

export default app;