import database from "../infra/database.js";
import { NotFoundError } from "../infra/errors.js";

class UpdateReservationStatusUseCase {
  static async execute({ id, status }) {
    return await database.transaction(async (client) => {
      const selectResult = await client.query(
        "SELECT id FROM reservations WHERE id = $1 FOR UPDATE;",
        [id]
      );

      if (selectResult.rowCount === 0) {
        throw new NotFoundError({ message: "Reserva não encontrada." });
      }

      const updateResult = await client.query(
        `UPDATE reservations
         SET payment_status = $1
         WHERE id = $2
         RETURNING id, payment_status;`,
        [status, id]
      );

      return updateResult.rows[0];
    });
  }
}

export default UpdateReservationStatusUseCase;