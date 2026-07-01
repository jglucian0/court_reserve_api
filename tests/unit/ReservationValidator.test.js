import ReservationValidator from "../../domain/validators/ReservationValidator.js";

describe("ReservationValidator", () => {
  const validPayload = {
    court_id: "550e8400-e29b-41d4-a716-446655440000",
    user_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    customer_name: "João",
    customer_cpf: "12345678900",
    reservation_date: "2026-07-30",
    start_time: "08:00:00",
    end_time: "09:00:00",
  };

  it("deve validar um payload correto", () => {
    expect(() => ReservationValidator.validate(validPayload)).not.toThrow();
  });

  it("deve rejeitar se user_id estiver ausente", () => {
    const { user_id, ...payloadSemUserId } = validPayload;
    expect(() => ReservationValidator.validate(payloadSemUserId)).toThrow(
      "Todos os campos obrigatórios devem ser preenchidos."
    );
  });

  it("deve rejeitar se user_id não for um UUID válido", () => {
    const payload = { ...validPayload, user_id: "nao-e-um-uuid" };
    expect(() => ReservationValidator.validate(payload)).toThrow(
      "O user_id fornecido não é um UUID válido."
    );
  });

  it("deve rejeitar se start_time não for hora cheia", () => {
    const payload = { ...validPayload, start_time: "08:30:00" };
    expect(() => ReservationValidator.validate(payload)).toThrow("Reservas devem iniciar e terminar em horários cheios");
  });

  it("deve rejeitar se start_time >= end_time", () => {
    const payload = { ...validPayload, start_time: "10:00:00", end_time: "09:00:00" };
    expect(() => ReservationValidator.validate(payload)).toThrow("O horário de término deve ser posterior ao horário de início.");
  });

  it("deve rejeitar reservas fora do horário de funcionamento (07-22)", () => {
    const payloadStart = { ...validPayload, start_time: "06:00:00", end_time: "07:00:00" };
    const payloadEnd = { ...validPayload, start_time: "21:00:00", end_time: "23:00:00" };

    expect(() => ReservationValidator.validate(payloadStart)).toThrow("A quadra funciona apenas das 07:00 às 22:00.");
    expect(() => ReservationValidator.validate(payloadEnd)).toThrow("A quadra funciona apenas das 07:00 às 22:00.");
  });

  it("deve permitir reserva de múltiplas horas (ex: 2 horas)", () => {
    const payload = { ...validPayload, start_time: "08:00:00", end_time: "10:00:00" };
    expect(() => ReservationValidator.validate(payload)).not.toThrow();
  });
});