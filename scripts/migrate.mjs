import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required before InvadersMTG can start.')
}

const connectionUrl = new URL(databaseUrl)
const poolConfig = { connectionString: connectionUrl.toString(), max: 1 }

// Astroscale's private RDS endpoint uses a platform-issued certificate that is
// not in Node's default trust store. This connection never leaves the private
// app-to-database network, so trust that certificate while retaining TLS.
if (connectionUrl.hostname.endsWith('.rds.amazonaws.com')) {
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    connectionUrl.searchParams.delete(key)
  }
  poolConfig.connectionString = connectionUrl.toString()
  poolConfig.ssl = { rejectUnauthorized: false }
}

const pool = new Pool(poolConfig)

try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })
} finally {
  await pool.end()
}
