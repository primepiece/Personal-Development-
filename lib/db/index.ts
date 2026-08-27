import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Supabase Postgres connection string.",
  );
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
