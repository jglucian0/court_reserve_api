import { jest } from "@jest/globals";

const mockQuery = jest.fn();
const mockCharge = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule("../../infra/database.js", () => ({
  default: {
    query: mockQuery,
    transaction: mockTransaction,
  },
}));

jest.unstable_mockModule("../../infra/PaymentGateway.js", () => ({
  default: { charge: mockCharge },
}));

const { default: ProcessPaymentUseCase } = await import(
  "../../use_cases/ProcessPaymentUseCase.js"
);
const { NotFoundError, IdempotencyConflictError, PaymentGatewayError } =
  await import("../../infra/errors.js");

const RESERVATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const IDEMPOTENCY_KEY = "idem-key-test-001";
const LOG_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function setupTransaction() {
  mockTransaction.mockImplementation((action) =>
    action({ query: mockQuery })
  );
}

describe("ProcessPaymentUseCase", () => {
  afterEach(() => {
    mockQuery.mockReset();
    mockCharge.mockReset();
    mockTransaction.mockReset();
  });

  describe("reserva não encontrada", () => {
    it("deve lançar NotFoundError quando a reserva não existe", async () => {
      setupTransaction();

      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("deve expor statusCode 404", async () => {
      setupTransaction();
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      try {
        await ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect(err.statusCode).toBe(404);
      }
    });

    it("não deve consultar payment_logs quando a reserva não existe", async () => {
      setupTransaction();
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("idempotência — requisição duplicada", () => {
    it("deve lançar IdempotencyConflictError quando a chave já existe em payment_logs", async () => {
      setupTransaction();

      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: RESERVATION_ID, payment_status: "pending" }],
      });
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: LOG_ID, status: "success" }],
      });

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it("deve expor statusCode 409 e message com a chave no IdempotencyConflictError", async () => {
      setupTransaction();
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: LOG_ID, status: "success" }] });

      try {
        await ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(IdempotencyConflictError);
        expect(err.statusCode).toBe(409);
        expect(err.message).toContain(IDEMPOTENCY_KEY);
        expect(err.action).toBeDefined();
      }
    });

    it("não deve chamar o gateway quando a chave já existe", async () => {
      setupTransaction();
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: LOG_ID }] });

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(IdempotencyConflictError);

      expect(mockCharge).not.toHaveBeenCalled();
    });

    it("deve lançar IdempotencyConflictError quando o INSERT falha com 23505 (race condition)", async () => {
      setupTransaction();

      const pgUniqueError = Object.assign(new Error("duplicate key"), {
        code: "23505",
      });

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockRejectedValueOnce(pgUniqueError);

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(IdempotencyConflictError);
    });
  });

  describe("falha no gateway de pagamento", () => {
    it("deve lançar PaymentGatewayError quando o gateway lança exceção", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockRejectedValueOnce(new Error("Connection timeout"));

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(PaymentGatewayError);
    });

    it("deve expor statusCode 502 no PaymentGatewayError", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockRejectedValueOnce(new Error("DNS failure"));

      try {
        await ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentGatewayError);
        expect(err.statusCode).toBe(502);
        expect(err.name).toBe("PaymentGatewayError");
      }
    });

    it("deve persistir log com status gateway_error antes de lançar a exceção", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockRejectedValueOnce(new Error("Timeout"));

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(PaymentGatewayError);

      const fourthCall = mockQuery.mock.calls[3];
      expect(fourthCall[0]).toMatch(/UPDATE payment_logs/i);
      expect(fourthCall[0]).toMatch(/gateway_error/i);
      expect(fourthCall[1][1]).toBe(LOG_ID);
    });

    it("não deve atualizar o status da reserva quando o gateway falha", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockRejectedValueOnce(new Error("Timeout"));

      await expect(
        ProcessPaymentUseCase.execute({
          reservationId: RESERVATION_ID,
          idempotencyKey: IDEMPOTENCY_KEY,
        })
      ).rejects.toThrow(PaymentGatewayError);

      const queriesExecutadas = mockQuery.mock.calls.map((c) => c[0]);
      const atualizouReserva = queriesExecutadas.some(
        (q) => typeof q === "string" && q.includes("UPDATE reservations")
      );
      expect(atualizouReserva).toBe(false);
    });
  });

  describe("pagamento recusado pelo gateway", () => {
    it("deve retornar status failed e não atualizar a reserva", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockResolvedValueOnce({ success: false, reason: "insufficient_funds" });

      const result = await ProcessPaymentUseCase.execute({
        reservationId: RESERVATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      expect(result.status).toBe("failed");

      const queriesExecutadas = mockQuery.mock.calls.map((c) => c[0]);
      expect(
        queriesExecutadas.some(
          (q) => typeof q === "string" && q.includes("UPDATE reservations")
        )
      ).toBe(false);
    });
  });

  describe("pagamento aprovado com sucesso", () => {
    it("deve retornar logId, status success e gatewayResponse", async () => {
      setupTransaction();

      const gatewayResponse = { success: true, gatewayId: "gw_abc123" };

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockResolvedValueOnce(gatewayResponse);

      const result = await ProcessPaymentUseCase.execute({
        reservationId: RESERVATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      expect(result).toEqual({
        logId: LOG_ID,
        status: "success",
        gatewayResponse,
      });
    });

    it("deve atualizar a reserva para paid quando o gateway aprova", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockResolvedValueOnce({ success: true, gatewayId: "gw_xyz" });

      await ProcessPaymentUseCase.execute({
        reservationId: RESERVATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      const fifthCall = mockQuery.mock.calls[4];
      expect(fifthCall[0]).toMatch(/UPDATE reservations/i);
      expect(fifthCall[0]).toMatch(/paid/i);
      expect(fifthCall[1][0]).toBe(RESERVATION_ID);
    });

    it("deve chamar o gateway exatamente uma vez com os parâmetros corretos", async () => {
      setupTransaction();

      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESERVATION_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: LOG_ID }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockCharge.mockResolvedValueOnce({ success: true, gatewayId: "gw_ok" });

      await ProcessPaymentUseCase.execute({
        reservationId: RESERVATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      expect(mockCharge).toHaveBeenCalledTimes(1);
      expect(mockCharge).toHaveBeenCalledWith({
        reservationId: RESERVATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });
    });
  });
});
