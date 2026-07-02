import database from "../infra/database.js";
import { ForbiddenError, NotFoundError } from "../infra/errors.js";

async function execute({ id, userId }) {
  return await database.transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id, user_id FROM reservations WHERE id = $1 FOR UPDATE;",
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError({ message: "Reserva não encontrada." });
    }

    const reservation = rows[0];

    if (reservation.user_id !== userId) {
      throw new ForbiddenError({
        message: "Você não tem permissão para excluir esta reserva.",
      });
    }

    await client.query("DELETE FROM reservations WHERE id = $1;", [id]);

    return true;
  });
}

export default { execute };