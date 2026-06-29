import AvailabilityService from "../../domain/services/AvailabilityService.js";

describe("AvailabilityService", () => {
  const existingReservations = [
    {
      court_id: "court-1",
      reservation_date: "2026-06-30",
      start_time: "10:00:00",
      end_time: "12:00:00",
    },
  ];

  it("deve permitir agendamento se não houver reservas no dia", () => {
    const request = {
      court_id: "court-1",
      reservation_date: "2026-06-30",
      start_time: "08:00:00",
      end_time: "09:00:00",
    };
    const isAvailable = AvailabilityService.check(request, []);
    expect(isAvailable).toBe(true);
  });

  it("deve rejeitar agendamento com colisão de horário exato", () => {
    const request = {
      court_id: "court-1",
      reservation_date: "2026-06-30",
      start_time: "10:00:00",
      end_time: "12:00:00",
    };
    const isAvailable = AvailabilityService.check(request, existingReservations);
    expect(isAvailable).toBe(false);
  });

  it("deve rejeitar agendamento que sobrepõe parcialmente uma reserva existente", () => {
    const request = {
      court_id: "court-1",
      reservation_date: "2026-06-30",
      start_time: "11:30:00",
      end_time: "13:00:00",
    };
    const isAvailable = AvailabilityService.check(request, existingReservations);
    expect(isAvailable).toBe(false);
  });

  it("deve permitir agendamento adjacente (termina exatamente quando a outra começa)", () => {
    const request = {
      court_id: "court-1",
      reservation_date: "2026-06-30",
      start_time: "08:00:00",
      end_time: "10:00:00",
    };
    const isAvailable = AvailabilityService.check(request, existingReservations);
    expect(isAvailable).toBe(true);
  });

  it("deve permitir agendamento no mesmo horário para uma quadra diferente", () => {
    const request = {
      court_id: "court-2",
      reservation_date: "2026-06-30",
      start_time: "10:00:00",
      end_time: "12:00:00",
    };
    const isAvailable = AvailabilityService.check(request, existingReservations);
    expect(isAvailable).toBe(true);
  });
});