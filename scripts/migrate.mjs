import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required before InvadersMTG can start.')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
})

try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })
} finally {
  await pool.end()
}
