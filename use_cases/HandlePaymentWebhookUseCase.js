import crypto from "crypto";
import database from "../infra/database.js";
import { UnauthorizedError, NotFoundError } from "../infra/errors.js";

async function execute({ payload, signature }) {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("WEBHOOK_SECRET não está definido nas variáveis de ambiente.");
  }

  // Gera a assinatura esperada com base no payload recebido
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  // Validação criptográfica
  if (signature !== expectedSignature) {
    throw new UnauthorizedError({
      message: "Assinatura do webhook inválida. Acesso negado.",
    });
  }

  const { type, data } = payload;
  const reservationId = data?.reservation_id;

  if (!reservationId) return;

  // Mapeia o tipo de evento para o status interno
  let status;
  if (type === "payment.success") {
    status = "paid";
  } else if (type === "payment.failed") {
    status = "failed";
  } else {
    return; // Ignora eventos que não afetam o status da reserva
  }

  const result = await database.query(
    "UPDATE reservations SET payment_status = $1 WHERE id = $2;",
    [status, reservationId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Reserva associada ao pagamento não foi encontrada.",
    });
  }
}

export default { execute };