exports.up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      default: pgm.func("gen_random_uuid()"),
      primaryKey: true,
    },
    name: { type: "varchar(255)", notNull: true },
    email: { type: "varchar(255)", notNull: true, unique: true },
    password_hash: { type: "varchar(255)", notNull: true },
    created_at: {
      type: "timestamp",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};