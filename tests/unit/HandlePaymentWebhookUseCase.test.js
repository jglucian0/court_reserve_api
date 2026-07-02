import { jest } from "@jest/globals";
import crypto from "crypto";

const mockQuery = jest.fn();
jest.unstable_mockModule("../../infra/database.js", () => ({
  default: { query: mockQuery },
}));

const { default: HandlePaymentWebhookUseCase } = await import("../../use_cases/HandlePaymentWebhookUseCase.js");
const { UnauthorizedError, NotFoundError } = await import("../../infra/errors.js");

const WEBHOOK_SECRET = "test_secret_key";
const RESERVATION_ID = "123e4567-e89b-12d3-a456-426614174000";

// Helper para gerar assinatura HMAC SHA256 simulando o gateway
function generateSignature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

describe("HandlePaymentWebhookUseCase", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("deve atualizar a reserva para 'paid' quando receber evento payment.success com assinatura válida", async () => {
    const payload = { type: "payment.success", data: { reservation_id: RESERVATION_ID } };
    const signature = generateSignature(payload, WEBHOOK_SECRET);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await HandlePaymentWebhookUseCase.execute({ payload, signature });

    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[0]).toMatch(/UPDATE reservations SET payment_status = \$1/i);
    expect(queryCall[1]).toEqual(["paid", RESERVATION_ID]);
  });

  it("deve atualizar a reserva para 'failed' quando receber evento payment.failed", async () => {
    const payload = { type: "payment.failed", data: { reservation_id: RESERVATION_ID } };
    const signature = generateSignature(payload, WEBHOOK_SECRET);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await HandlePaymentWebhookUseCase.execute({ payload, signature });

    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[1]).toEqual(["failed", RESERVATION_ID]);
  });

  it("deve lançar UnauthorizedError se a assinatura for inválida", async () => {
    const payload = { type: "payment.success", data: { reservation_id: RESERVATION_ID } };
    const signature = "assinatura_falsa_123";

    await expect(HandlePaymentWebhookUseCase.execute({ payload, signature }))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError se a reserva do payload não existir no banco", async () => {
    const payload = { type: "payment.success", data: { reservation_id: RESERVATION_ID } };
    const signature = generateSignature(payload, WEBHOOK_SECRET);

    mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // Nenhuma linha atualizada

    await expect(HandlePaymentWebhookUseCase.execute({ payload, signature }))
      .rejects.toThrow(NotFoundError);
  });
});