exports.up = (pgm) => {
  pgm.createExtension("uuid-ossp", { ifNotExists: true });

  pgm.createTable("courts", {
    id: {
      type: "uuid",
      default: pgm.func("uuid_generate_v4()"),
      primaryKey: true,
    },
    name: { type: "varchar(100)", notNull: true },
    is_active: { type: "boolean", default: true, notNull: true },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("courts");
  pgm.dropExtension("uuid-ossp");
};