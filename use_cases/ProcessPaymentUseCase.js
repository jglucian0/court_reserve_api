import database from "../infra/database.js";
import PaymentGateway from "../infra/PaymentGateway.js";
import {
  NotFoundError,
  IdempotencyConflictError,
  PaymentGatewayError,
} from "../infra/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

async function execute({ reservationId, idempotencyKey }) {
  return await database.transaction(async (client) => {
    const reservationResult = await client.query(
      "SELECT id, payment_status FROM reservations WHERE id = $1 FOR UPDATE;",
      [reservationId]
    );

    if (reservationResult.rowCount === 0) {
      throw new NotFoundError({ message: "Reserva não encontrada." });
    }

    const existingLog = await client.query(
      "SELECT id, status, gateway_response FROM payment_logs WHERE idempotency_key = $1;",
      [idempotencyKey]
    );

    if (existingLog.rowCount > 0) {
      throw new IdempotencyConflictError({
        idempotencyKey,
        cause: new Error("Log existente encontrado no banco."),
      });
    }

    let logId;

    try {
      const pendingLog = await client.query(
        `INSERT INTO payment_logs (reservation_id, idempotency_key, status)
         VALUES ($1, $2, 'pending')
         RETURNING id;`,
        [reservationId, idempotencyKey]
      );
      logId = pendingLog.rows[0].id;
    } catch (err) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        throw new IdempotencyConflictError({ idempotencyKey, cause: err });
      }
      throw err;
    }

    let gatewayResponse;

    try {
      gatewayResponse = await PaymentGateway.charge({ reservationId, idempotencyKey });
    } catch (gatewayErr) {
      await client.query(
        `UPDATE payment_logs
         SET status = 'gateway_error',
             gateway_response = $1
         WHERE id = $2;`,
        [JSON.stringify({ error: gatewayErr.message }), logId]
      );

      throw new PaymentGatewayError({ cause: gatewayErr, gatewayMessage: gatewayErr.message });
    }

    const finalStatus = gatewayResponse.success ? "success" : "failed";

    await client.query(
      `UPDATE payment_logs
       SET status = $1,
           gateway_response = $2
       WHERE id = $3;`,
      [finalStatus, JSON.stringify(gatewayResponse), logId]
    );

    if (gatewayResponse.success) {
      await client.query(
        "UPDATE reservations SET payment_status = 'paid' WHERE id = $1;",
        [reservationId]
      );
    }

    return {
      logId,
      status: finalStatus,
      gatewayResponse,
    };
  });
}

export default { execute };
