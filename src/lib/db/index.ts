import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'
import * as schema from './schema'

const globalForDatabase = globalThis as unknown as {
  pool: Pool | undefined
}

const connectionUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined
const poolConfig: PoolConfig = {
  connectionString: connectionUrl?.toString(),
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
}

// Astroscale's private RDS endpoint uses a platform-issued certificate that is
// not in Node's default trust store. This connection stays on the private
// app-to-database network, so retain TLS and trust that certificate.
if (connectionUrl?.hostname.endsWith('.rds.amazonaws.com')) {
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    connectionUrl.searchParams.delete(key)
  }
  poolConfig.connectionString = connectionUrl.toString()
  poolConfig.ssl = { rejectUnauthorized: false }
}

const pool = globalForDatabase.pool ?? new Pool(poolConfig)

if (process.env.NODE_ENV !== 'production') globalForDatabase.pool = pool

const database = drizzle({ client: pool, schema })

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
  }
  return database
}

export { schema }
