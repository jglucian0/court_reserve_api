exports.up = (pgm) => {
  pgm.createTable("reservations", {
    id: {
      type: "uuid",
      default: pgm.func("uuid_generate_v4()"),
      primaryKey: true,
    },
    court_id: {
      type: "uuid",
      notNull: true,
      references: '"courts"',
      onDelete: "CASCADE",
    },
    customer_name: { type: "varchar(255)", notNull: true },
    customer_cpf: { type: "varchar(11)", notNull: true },
    reservation_date: { type: "date", notNull: true },
    start_time: { type: "time", notNull: true },
    end_time: { type: "time", notNull: true },
    payment_status: {
      type: "varchar(50)",
      notNull: true,
      default: "pending"
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("reservations", ["court_id", "reservation_date"]);
};

exports.down = (pgm) => {
  pgm.dropTable("reservations");
};