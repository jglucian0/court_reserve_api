
exports.shorthands = undefined;

const INDEX_NAME = "reservations_court_id_date_start_time_unique";

/**
 * Adiciona um UNIQUE INDEX composto em (court_id, reservation_date, start_time).
 *
 * Por que UNIQUE INDEX em vez de UNIQUE CONSTRAINT?
 * - Ambos criam um B-Tree index internamente; a diferença é semântica.
 * - O INDEX permite a cláusula WHERE para índices parciais no futuro
 *   (ex: WHERE payment_status != 'cancelled'), tornando a solução mais
 *   extensível sem precisar dropar e recriar a constraint.
 *
 * Comportamento sob race condition:
 * - O Postgres usa bloqueio de nível de tupla (tuple-level locking).
 * - Quando duas transações tentam inserir a mesma combinação
 *   (court_id, reservation_date, start_time) ao mesmo tempo, a segunda
 *   fica bloqueada até a primeira commitar ou fazer rollback.
 * - Se a primeira cometer (COMMIT), o Postgres lança:
 *     ERROR 23505: duplicate key value violates unique constraint
 * - O driver `pg` (node-postgres) traduz esse erro para um objeto Error
 *   com a propriedade `code === '23505'`, que deve ser capturado na
 *   camada de repositório e relançado como erro de domínio (ex: ConflictError).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    DELETE FROM reservations
    WHERE id NOT IN (
      SELECT DISTINCT ON (court_id, reservation_date, start_time) id
      FROM reservations
      ORDER BY court_id, reservation_date, start_time, created_at ASC
    )
  `);

  pgm.createIndex("reservations", ["court_id", "reservation_date", "start_time"], {
    name: INDEX_NAME,
    unique: true,
  });
};


exports.down = (pgm) => {
  pgm.dropIndex("reservations", ["court_id", "reservation_date", "start_time"], {
    name: INDEX_NAME,
  });
};
