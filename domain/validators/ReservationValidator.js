import { ValidationError } from "../../infra/errors.js";

class ReservationValidator {
  static validate(payload) {
    const { court_id, user_id, customer_name, customer_cpf, reservation_date, start_time, end_time } = payload;

    if (!court_id || !user_id || !customer_name || !customer_cpf || !reservation_date || !start_time || !end_time) {
      throw new ValidationError({ message: "Todos os campos obrigatórios devem ser preenchidos." });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(court_id)) {
      throw new ValidationError({ message: "O court_id fornecido não é um UUID válido." });
    }

    if (!uuidRegex.test(user_id)) {
      throw new ValidationError({ message: "O user_id fornecido não é um UUID válido." });
    }

    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return { hour: h, minute: m };
    };

    const start = parseTime(start_time);
    const end = parseTime(end_time);

    if (start.minute !== 0 || end.minute !== 0) {
      throw new ValidationError({ message: "Reservas devem iniciar e terminar em horários cheios (ex: 08:00, 09:00)." });
    }

    if (start.hour >= end.hour) {
      throw new ValidationError({ message: "O horário de término deve ser posterior ao horário de início." });
    }

    if (start.hour < 7 || end.hour > 22) {
      throw new ValidationError({ message: "A quadra funciona apenas das 07:00 às 22:00." });
    }

    const duration = end.hour - start.hour;
    if (duration < 1) {
      throw new ValidationError({ message: "A reserva deve ter duração mínima de 1 hora." });
    }
  }
}

export default ReservationValidator;