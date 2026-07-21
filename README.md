# InvadersMTG

InvadersMTG is a Magic: The Gathering tournament platform for organizers and players. It supports Draft, Sealed, Standard, 1v1 Commander, and 3–4 player Commander pods. Head-to-head events are best-of-one or best-of-three; Standard players can submit a deck list in MTG Arena export format.

## Local development

1. Copy `.env.example` to `.env.local` and set a PostgreSQL `DATABASE_URL`.
2. Run `npm install`.
3. Run `npm run db:migrate` to create the schema.
4. Run `npm run dev` and open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
```

## Database and migrations

The application uses PostgreSQL and Drizzle. Schema definitions live in `src/lib/db/schema.ts`; generated, committed migrations live in `drizzle/`.

```bash
npm run db:generate  # generate a migration after a schema change
npm run db:migrate   # apply migrations to DATABASE_URL
```

The production container runs migrations before starting Next.js. This makes a fresh managed database usable without a separate migration service. Do not attach the app to a database shared with another application.

## Astroscale deployment

Create an Astroscale app with a managed PostgreSQL database in `us-east-1`, then deploy this repository as a Docker application on port `3000`. Astroscale injects `DATABASE_URL` when the database is attached.

Set these application environment variables:

```text
APP_URL=https://your-shared-domain
SESSION_LIFETIME_DAYS=30
DATABASE_POOL_MAX=5
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_your_resend_api_key
EMAIL_FROM=InvadersMTG <hello@your-verified-domain>
```

Resend is the recommended transactional mail provider. Verify the sending domain in Resend before setting `EMAIL_FROM`; its SMTP relay uses `smtp.resend.com` and can be configured with the same Resend API key. See the [Resend SMTP documentation](https://resend.com/docs/send-with-smtp).

Never commit `.env.local`, database credentials, Resend keys, or production user data.
