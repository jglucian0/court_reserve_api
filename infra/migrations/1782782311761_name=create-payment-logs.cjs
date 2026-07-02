exports.shorthands = undefined;

const PAYMENT_LOG_STATUSES = ["pending", "success", "failed", "gateway_error"];

/**
 * Cria a tabela payment_logs.
 *
 * Decisões de design:
 *
 * 1. idempotency_key UNIQUE:
 *    Garante no nível do banco que nenhuma chave de idempotência é processada
 *    duas vezes. É a última linha de defesa — mesmo que a aplicação falhe
 *    entre o SELECT e o INSERT, o banco rejeitará a inserção duplicada
 *    com código SQLSTATE 23505.
 *
 * 2. gateway_response JSONB (nullable):
 *    Armazena o payload bruto retornado pelo gateway externo, inclusive em
 *    casos de falha parcial. Nullable porque pode não existir resposta
 *    quando o gateway fica indisponível antes de responder.
 *
 * 3. FK para reservations com ON DELETE CASCADE:
 *    Logs de pagamento não têm sentido sem a reserva de origem.
 *
 * 4. status VARCHAR com CHECK constraint:
 *    Impede inserção de status fora do domínio sem precisar de ENUM.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable("payment_logs", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    reservation_id: {
      type: "uuid",
      notNull: true,
      references: '"reservations"',
      onDelete: "CASCADE",
    },
    idempotency_key: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    status: {
      type: "varchar(50)",
      notNull: true,
      check: `status IN ('${PAYMENT_LOG_STATUSES.join("', '")}')`,
    },
    gateway_response: {
      type: "jsonb",
      notNull: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("payment_logs", ["reservation_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("payment_logs");
};
