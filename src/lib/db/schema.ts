import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const tournamentFormat = pgEnum('tournament_format', [
  'draft',
  'sealed',
  'commander',
  'standard',
])
export const commanderMode = pgEnum('commander_mode', ['duel', 'pods'])
export const tournamentStatus = pgEnum('tournament_status', [
  'draft',
  'registration',
  'check_in',
  'active',
  'top_cut',
  'completed',
  'cancelled',
])
export const participantStatus = pgEnum('participant_status', [
  'registered',
  'waitlisted',
  'checked_in',
  'active',
  'dropped',
  'disqualified',
])
export const roundStatus = pgEnum('round_status', ['pending', 'active', 'completed'])
export const matchKind = pgEnum('match_kind', ['head_to_head', 'commander_pod'])
export const matchStatus = pgEnum('match_status', [
  'pending',
  'reported',
  'confirmed',
  'complete',
])
export const matchPlayerResult = pgEnum('match_player_result', [
  'win',
  'loss',
  'draw',
  'bye',
  'placement',
])
export const organizerRole = pgEnum('organizer_role', ['owner', 'organizer', 'judge'])
export const deckListStatus = pgEnum('deck_list_status', ['draft', 'submitted', 'locked'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
)

export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    username: varchar('username', { length: 30 }).notNull(),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    avatarUrl: text('avatar_url'),
    bio: varchar('bio', { length: 280 }),
    ...timestamps,
  },
  (table) => [uniqueIndex('profiles_username_unique').on(table.username)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash),
    index('password_reset_tokens_user_id_idx').on(table.userId),
  ],
)

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('email_verification_tokens_hash_unique').on(table.tokenHash),
    index('email_verification_tokens_user_id_idx').on(table.userId),
  ],
)

export const tournaments = pgTable(
  'tournaments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull().references(() => users.id),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    format: tournamentFormat('format').notNull(),
    commanderMode: commanderMode('commander_mode'),
    podSize: integer('pod_size'),
    status: tournamentStatus('status').default('draft').notNull(),
    isPublic: boolean('is_public').default(true).notNull(),
    accessKey: varchar('access_key', { length: 32 }).notNull(),
    inviteToken: uuid('invite_token').defaultRandom().notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    timezone: varchar('timezone', { length: 64 }).default('America/New_York').notNull(),
    venue: varchar('venue', { length: 160 }),
    registrationEndsAt: timestamp('registration_ends_at', { withTimezone: true }),
    checkInOpensAt: timestamp('check_in_opens_at', { withTimezone: true }),
    capacity: integer('capacity'),
    roundCount: integer('round_count').notNull(),
    gamesPerMatch: integer('games_per_match').default(3).notNull(),
    roundTimeLimitMinutes: integer('round_time_limit_minutes').default(50).notNull(),
    topCutSize: integer('top_cut_size'),
    deckListsRequired: boolean('deck_lists_required').default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tournaments_access_key_unique').on(table.accessKey),
    uniqueIndex('tournaments_invite_token_unique').on(table.inviteToken),
    index('tournaments_discovery_idx').on(table.isPublic, table.status, table.scheduledAt),
    index('tournaments_owner_idx').on(table.ownerId),
  ],
)

export const tournamentOrganizers = pgTable(
  'tournament_organizers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: organizerRole('role').default('organizer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tournament_organizers_unique').on(table.tournamentId, table.userId),
    index('tournament_organizers_user_idx').on(table.userId),
  ],
)

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: participantStatus('status').default('registered').notNull(),
    seedRating: integer('seed_rating').default(1200).notNull(),
    finalStanding: integer('final_standing'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    droppedAt: timestamp('dropped_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tournament_participants_unique').on(table.tournamentId, table.userId),
    index('tournament_participants_tournament_idx').on(table.tournamentId, table.status),
    index('tournament_participants_user_idx').on(table.userId),
  ],
)

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    stage: varchar('stage', { length: 32 }).default('swiss').notNull(),
    isTopCut: boolean('is_top_cut').default(false).notNull(),
    status: roundStatus('status').default('pending').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('rounds_tournament_number_unique').on(table.tournamentId, table.roundNumber),
    index('rounds_active_idx').on(table.tournamentId, table.status),
  ],
)

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    roundId: uuid('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
    kind: matchKind('kind').notNull(),
    tableNumber: integer('table_number'),
    status: matchStatus('status').default('pending').notNull(),
    reportedById: uuid('reported_by_id').references(() => users.id),
    isAdminOverride: boolean('is_admin_override').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ratingsAppliedAt: timestamp('ratings_applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('matches_round_idx').on(table.roundId, table.status),
    index('matches_tournament_idx').on(table.tournamentId),
  ],
)

export const matchPlayers = pgTable(
  'match_players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id),
    seat: integer('seat').notNull(),
    result: matchPlayerResult('result'),
    placement: integer('placement'),
    gamesWon: integer('games_won').default(0).notNull(),
    gamesDrawn: integer('games_drawn').default(0).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('match_players_match_user_unique').on(table.matchId, table.userId),
    uniqueIndex('match_players_match_seat_unique').on(table.matchId, table.seat),
    index('match_players_user_idx').on(table.userId),
  ],
)

export const userDecks = pgTable(
  'user_decks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    format: tournamentFormat('format').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    listText: text('list_text').notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index('user_decks_owner_format_idx').on(table.userId, table.format),
    index('user_decks_public_profile_idx').on(table.userId, table.isPublic, table.updatedAt),
  ],
)

export const deckLists = pgTable(
  'deck_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sourceDeckId: uuid('source_deck_id').references(() => userDecks.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 120 }),
    commanderName: varchar('commander_name', { length: 120 }),
    listText: text('list_text'),
    status: deckListStatus('status').default('draft').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('deck_lists_tournament_user_unique').on(table.tournamentId, table.userId)],
)

export const playerRatings = pgTable(
  'player_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    format: tournamentFormat('format').notNull(),
    rating: integer('rating').default(1200).notNull(),
    wins: integer('wins').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    draws: integer('draws').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('player_ratings_user_format_unique').on(table.userId, table.format),
    index('player_ratings_leaderboard_idx').on(table.format, table.rating),
  ],
)

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: uuid('entity_id'),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_events_tournament_idx').on(table.tournamentId, table.createdAt),
    index('audit_events_actor_idx').on(table.actorId, table.createdAt),
  ],
)
