import { jest } from "@jest/globals";

const mockQuery = jest.fn();
const mockTransaction = jest.fn(async (callback) => {
  return await callback({ query: mockQuery });
});

jest.unstable_mockModule("../../infra/database.js", () => ({
  default: {
    query: mockQuery,
    transaction: mockTransaction,
    end: jest.fn()
  },
}));

const { default: DeleteReservationUseCase } = await import("../../use_cases/DeleteReservationUseCase.js");
const { ForbiddenError, NotFoundError } = await import("../../infra/errors.js");

const OWNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const RESERVATION_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("DeleteReservationUseCase", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  describe("deleção autorizada", () => {
    it("deve deletar a reserva e retornar true quando o userId bate com o dono", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RESERVATION_ID, user_id: OWNER_ID }],
      });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await DeleteReservationUseCase.execute({
        id: RESERVATION_ID,
        userId: OWNER_ID,
      });

      expect(result).toBe(true);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM reservations WHERE id = $1;",
        [RESERVATION_ID]
      );
    });
  });

  describe("reserva não encontrada", () => {
    it("deve lançar NotFoundError quando o id não existe no banco", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        DeleteReservationUseCase.execute({
          id: RESERVATION_ID,
          userId: OWNER_ID,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("deve expor statusCode 404 no NotFoundError", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      try {
        await DeleteReservationUseCase.execute({
          id: RESERVATION_ID,
          userId: OWNER_ID,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect(err.statusCode).toBe(404);
        expect(err.message).toMatch(/n\u00e3o encontrada/i);
      }
    });

    it("não deve executar DELETE quando a reserva não existe", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        DeleteReservationUseCase.execute({ id: RESERVATION_ID, userId: OWNER_ID })
      ).rejects.toThrow(NotFoundError);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("acesso negado — usuário não é o dono", () => {
    it("deve lançar ForbiddenError quando o userId não corresponde ao dono da reserva", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RESERVATION_ID, user_id: OWNER_ID }],
      });

      await expect(
        DeleteReservationUseCase.execute({
          id: RESERVATION_ID,
          userId: OTHER_USER_ID,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("deve expor statusCode 403 e name correto no ForbiddenError", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RESERVATION_ID, user_id: OWNER_ID }],
      });

      try {
        await DeleteReservationUseCase.execute({
          id: RESERVATION_ID,
          userId: OTHER_USER_ID,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect(err.statusCode).toBe(403);
        expect(err.name).toBe("ForbiddenError");
        expect(err.message).toMatch(/permiss\u00e3o/i);
        expect(err.action).toBeDefined();
      }
    });

    it("não deve executar DELETE quando o usuário não é o dono", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RESERVATION_ID, user_id: OWNER_ID }],
      });

      await expect(
        DeleteReservationUseCase.execute({
          id: RESERVATION_ID,
          userId: OTHER_USER_ID,
        })
      ).rejects.toThrow(ForbiddenError);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});
