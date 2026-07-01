exports.shorthands = undefined;

/**
 * Adiciona a coluna user_id (UUID, nullable) na tabela reservations.
 *
 * Decisões de design:
 * - nullable: permite que reservas legadas (antes da autenticação) continuem
 *   válidas sem uma migration de backfill de dados. Um NOT NULL pode ser
 *   adicionado em uma migration futura após a coluna ser populada.
 * - sem FK para users por enquanto: a tabela users ainda não existe no schema.
 *   A constraint de FK será adicionada na migration que criar a tabela users,
 *   garantindo ordem de execução e evitando dependência circular.
 * - índice simples em user_id: queries de listagem filtradas por proprietário
 *   (SELECT ... WHERE user_id = $1) se beneficiam do índice sem overhead
 *   de unicidade desnecessário nesta coluna.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.addColumn("reservations", {
    user_id: {
      type: "uuid",
      notNull: false,
    },
  });

  pgm.createIndex("reservations", ["user_id"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("reservations", ["user_id"]);
  pgm.dropColumn("reservations", "user_id");
};
