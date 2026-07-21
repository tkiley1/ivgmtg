import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDatabase = globalThis as unknown as {
  pool: Pool | undefined
}

const pool = globalForDatabase.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
})

if (process.env.NODE_ENV !== 'production') globalForDatabase.pool = pool

const database = drizzle({ client: pool, schema })

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
  }
  return database
}

export { schema }
