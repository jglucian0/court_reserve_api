import AvailabilityService from "../domain/services/AvailabilityService.js";
import database from "../infra/database.js";
import { ScheduleConflictError } from "../infra/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

class BookCourtUseCase {
  static async execute(requestData) {
    return await database.transaction(async (client) => {
      const {
        court_id,
        user_id,
        reservation_date,
        start_time,
        end_time,
        customer_name,
        customer_cpf,
      } = requestData;

      const courtLock = await client.query(
        "SELECT id FROM courts WHERE id = $1 AND is_active = true FOR UPDATE;",
        [court_id]
      );

      if (courtLock.rowCount === 0) {
        throw new Error("Quadra não encontrada ou inativa.");
      }

      const existingReservationsQuery = await client.query(
        `SELECT court_id, to_char(reservation_date, 'YYYY-MM-DD') as reservation_date, start_time, end_time 
         FROM reservations 
         WHERE court_id = $1 AND reservation_date = $2;`,
        [court_id, reservation_date]
      );

      const isAvailable = AvailabilityService.check(
        requestData,
        existingReservationsQuery.rows
      );

      if (!isAvailable) {
        throw new ScheduleConflictError();
      }

      try {
        const insertQuery = await client.query(
          `INSERT INTO reservations 
           (court_id, user_id, customer_name, customer_cpf, reservation_date, start_time, end_time) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, payment_status;`,
          [
            court_id,
            user_id,
            customer_name,
            customer_cpf,
            reservation_date,
            start_time,
            end_time,
          ]
        );

        return insertQuery.rows[0];
      } catch (err) {
        if (err.code === PG_UNIQUE_VIOLATION) {
          throw new ScheduleConflictError({ cause: err });
        }
        throw err;
      }
    });
  }
}

export default BookCourtUseCase;