import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-global";