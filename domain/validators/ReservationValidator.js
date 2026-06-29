import { ValidationError } from "../../infra/errors.js";

class ReservationValidator {
  static validate(payload) {
    const { court_id, customer_name, customer_cpf, reservation_date, start_time, end_time } = payload;

    if (!court_id || !customer_name || !customer_cpf || !reservation_date || !start_time || !end_time) {
      throw new ValidationError({ message: "Todos os campos obrigatórios devem ser preenchidos." });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(court_id)) {
      throw new ValidationError({ message: "O court_id fornecido não é um UUID válido." });
    }

    if (start_time >= end_time) {
      throw new ValidationError({ message: "O horário de término deve ser posterior ao horário de início." });
    }
  }
}

export default ReservationValidator;