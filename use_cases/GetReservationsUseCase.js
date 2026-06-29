import database from "../infra/database.js";

class GetReservationsUseCase {
  static async execute({ court_id, date }) {
    const query = `
      SELECT 
        id, 
        court_id, 
        customer_name, 
        to_char(reservation_date, 'YYYY-MM-DD') as reservation_date, 
        start_time, 
        end_time, 
        payment_status
      FROM reservations 
      WHERE court_id = $1 AND reservation_date = $2
      ORDER BY start_time ASC;
    `;

    const result = await database.query(query, [court_id, date]);

    return result.rows;
  }
}

export default GetReservationsUseCase;