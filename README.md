# InvadersMTG

InvadersMTG is a Magic: The Gathering tournament platform for organizers and players. It supports Draft, Sealed, Standard, 1v1 Commander, and 3–4 player Commander pods. Head-to-head events are best-of-one or best-of-three; Standard players can submit a deck list in MTG Arena export format.

## Local development

1. Copy `.env.example` to `.env.local` and set a PostgreSQL `DATABASE_URL`.
2. Run `npm install`.
3. Run `npm run db:migrate` to create the schema.
4. Run `npm run dev` and open `http://localhost:3000`.

Useful checks:

```bash
npm test
npm run lint
npm run build
```

## Running a physical Booster Draft

1. Create a Draft event, then use **Organizer controls → Event settings** to confirm the start time, capacity, rounds, and deck-building timer.
2. Have account players join and check in. Add accountless players from **Participant list → Add walk-in**.
3. Generate randomized pod seating on the event page. You may reseat until deck building starts.
4. Run the physical draft at the table. When the draft is finished, click **Start deck building**.
5. When players are ready, click **Generate pairings & start round 1**. Pairings and timers refresh automatically on open event screens.
6. Players report results from their match page. An organizer can confirm guest-player matches, correct finalized results, swap players before results are reported, or reset an untouched active round.

If seating was handled outside the app, choose **Skip draft seating** before generating round one from organizer controls.

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
