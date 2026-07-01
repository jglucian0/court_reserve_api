
class PaymentGateway {
  static async charge({ reservationId, idempotencyKey }) {
    // Stub: simula aprovação imediata.
    // Em produção: substituir pelo client HTTP real (fetch, axios, sdk).
    return {
      success: true,
      gatewayId: `gw_${Date.now()}`,
    };
  }
}

export default PaymentGateway;
