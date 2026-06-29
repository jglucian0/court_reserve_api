class AvailabilityService {
  static check(requestData, existingReservations) {
    const { court_id, reservation_date, start_time, end_time } = requestData;

    const relevantReservations = existingReservations.filter(
      (reservation) =>
        reservation.court_id === court_id &&
        reservation.reservation_date === reservation_date
    );

    for (const reservation of relevantReservations) {
      const isOverlapping =
        start_time < reservation.end_time && end_time > reservation.start_time;

      if (isOverlapping) {
        return false;
      }
    }

    return true;
  }
}

export default AvailabilityService;