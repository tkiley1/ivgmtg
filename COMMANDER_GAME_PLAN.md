# Commander Game Development Plan

Status: deferred for potential future development
Last reviewed: September 1, 2026

## Purpose

Extend InvadersMTG with a browser-based, traditional free-for-all Commander game for two to four players. Players receive virtual access to legal cards, build or import decks, and play on a synchronized desktop game board.

The initial product should assist players while leaving card interpretation and effect resolution to them. A fully automated Magic rules engine is a possible future state, not part of the first release.

No implementation is currently authorized by this plan. It is a product and technical reference for later work.

## Confirmed product decisions

| Area | Decision |
| --- | --- |
| Players | Two to four |
| Format | Traditional multiplayer free-for-all Commander |
| Card access | Every supported legal card is available virtually; collection ownership is not tracked |
| Rules enforcement | Manual resolution with game-specific assistance initially |
| Future direction | Incremental automation, potentially leading to automatic resolution |
| Deck legality | Current official Commander construction rules and banned list |
| Rooms | Public rooms and private rooms protected by a password |
| Matchmaking | No skill, region, power, or other matchmaking filters initially |
| Communication | Game board only; no text, voice, or video chat initially |
| Undo | A player requests an undo and the host approves or rejects it |
| Persistence | No requirement to resume games after the room/game session ends |
| Target devices | Desktop browsers initially; phone layouts later |
| Pricing | Free access |
| First milestone | Deliver deck building, lobby flow, and a basic playable board together |

## Recommended assumptions to confirm before implementation

- Accounts are optional for playing. A guest can enter a display name, paste or import a legal deck, and join a room. An account adds saved decks and profile conveniences.
- A public room can be discovered and joined without a password. A private room is omitted from public discovery and requires a password.
- The host may occupy a player seat.
- If the host disconnects temporarily, authority transfers to another connected player. If everyone leaves or the in-memory room expires, the game ends.
- A short reconnect grace period is supported for refreshes and transient network failures, even though long-term game persistence is not required.
- Spectators are excluded from the first release.
- The first release uses card metadata and image references from a maintained data source such as Scryfall, subject to its terms and Wizards' intellectual-property rules.

## Existing project foundation

InvadersMTG already supplies:

- Next.js 16 App Router and React 19
- User registration, login, profiles, and sessions
- PostgreSQL with Drizzle ORM and committed migrations
- A saved deck library, currently limited to Standard Arena-format imports
- Commander tournament and three-to-four-player pod concepts
- Public/private tournament discovery and invite flows
- Organizer, participant, match, standings, and audit models

The game feature should reuse authentication, profiles, visual components, PostgreSQL access, and deck concepts where appropriate. It should not overload tournament rounds or tournament matches to represent live games; live Commander rooms need their own bounded model.

## First playable milestone

The first milestone is a complete vertical slice. A player should be able to create or import a deck, create or join a room, start a game, take normal manual game actions, and finish the game.

### Deck builder and validation

- Search and browse supported cards.
- Select one commander or a legal multi-commander combination permitted by current official rules.
- Import common plain-text deck-list formats.
- Add and remove cards without collection restrictions.
- Display card count, color identity, card types, mana curve, and validation status.
- Enforce exactly 100 cards including commanders.
- Enforce singleton rules while honoring cards whose rules permit additional copies.
- Enforce commander eligibility, color identity, and special commander combinations.
- Reject cards not legal in Commander according to the current official legality data.
- Display every validation failure with the affected card and a useful reason.
- Save decks for signed-in users.
- Let guests bring a deck by pasting/importing it for the current session.
- Snapshot the validated deck when the game starts so later deck edits cannot affect an active game.

Legality data must be refreshable. A validation result should record the card-data/rules snapshot used so a future legality update does not ambiguously rewrite past results.

### Room discovery and lobby

- Create a public or private room.
- Give private rooms a securely stored password hash; never store the plaintext password.
- List joinable public rooms with host name, occupancy, and creation time.
- Join a private room by direct link or identifier plus password.
- Support two, three, or four seats.
- Show each player's connection, ready state, and deck-validity state.
- Permit the host to remove a player before the game begins.
- Require every occupied seat to have a valid deck and be ready before starting.
- Randomize initial player order when the host starts the game.
- Prevent late player joins after game start.

### Game board

Each player has:

- Library
- Hand
- Battlefield
- Graveyard
- Exile
- Command zone
- Life total, initially 40
- Poison counters
- Commander damage received, tracked separately for every opposing commander
- Mana tracker

The shared board also provides:

- Turn number, active player, phase, and step
- Stack area
- Visible player order and connection state
- Action history
- Undo request state
- Game result and remaining-player state

### Manual gameplay actions

- Draw one or more cards.
- Move cards between legal visible or hidden zones.
- Play a card from hand without attempting to interpret its effect.
- Cast a commander from the command zone and track commander tax.
- Tap, untap, rotate, reorder, and group battlefield cards.
- Add, change, and remove named or numeric counters.
- Create, copy, edit, and remove tokens.
- Mark attackers, attack targets, blockers, and combat assignments.
- Attach one permanent to another.
- Change a permanent's controller while preserving its owner.
- Reveal a card to all players or selected players.
- Look at a private set of cards and return or reorder them.
- Shuffle a library using server-side randomness.
- Mill, discard, exile, sacrifice, destroy, and return cards through explicit commands.
- Put a spell or ability representation on the stack and manually resolve or remove it.
- Change life, poison, mana, and commander-damage totals.
- Advance phase, step, turn, and active player.
- Concede and remove the conceding player's owned objects according to the supported manual model.
- Declare the winner or end the game without a winner.

The interface should offer Commander-aware shortcuts but must never imply that an unimplemented rule or card effect has been automatically adjudicated.

### Undo and action history

- Every accepted game command receives an increasing sequence number and actor identity.
- Record enough information to display a readable action log.
- A player may request undo to a prior reversible command.
- The host sees the requested boundary and approves or rejects it.
- Approved undo restores a server-authored snapshot or applies validated inverse events.
- Do not permit undo across an unsupported boundary without a clear warning, particularly after hidden information was revealed or a shuffle occurred.
- Host decisions and resulting state changes appear in the action history.

### Ending a game

- Players can concede independently; the game continues while at least two players remain unless the table ends it manually.
- Assistance may detect obvious numeric Commander loss conditions, including zero life, lethal poison, and 21 commander combat damage, but the player/host confirms the elimination in the manual release.
- The room records a lightweight result while it remains active.
- Long-term game replays and resumable snapshots are out of scope.

## Rules-assistance boundary

The first release should automate state bookkeeping, not card meaning.

### Automate initially

- Secure shuffle and draw
- Zone visibility and access control
- Turn, phase, and step tracking
- Starting life and turn order
- Commander tax counter
- Per-commander combat damage totals
- Poison, life, counters, and tokens
- Ownership versus control
- Connection and lobby state
- Validation of user commands against permissions and basic state invariants
- Host-approved undo

### Keep manual initially

- Priority passing and response windows
- Mana-cost payment validation
- Targets and target legality
- Trigger detection and ordering
- Replacement and prevention effects
- State-based actions beyond optional warnings
- Continuous effects and dependency/layer calculations
- Combat legality and damage calculation
- Copying values and linked abilities
- Commander zone-change decisions
- Card-specific choices and resolutions
- Determining winners from card text or loops

## Technical architecture

### Separation of responsibilities

Use the existing Next.js application for:

- Pages and navigation
- Account and guest entry flows
- Deck management
- Card search endpoints
- Room discovery and creation
- Initial game-page rendering
- Administrative and policy pages

Use a separate authoritative real-time game process for:

- Live room connections
- Game commands
- Hidden-information filtering
- Turn and action ordering
- Server-side random operations
- Host authority
- Temporary snapshots and reconnects
- Broadcasting player-specific state projections

Next.js Route Handlers can establish or authorize a connection, but normal Server Actions and page revalidation should not be used as the live synchronization mechanism.

Before choosing a real-time library or service, verify that the intended container host supports long-lived WebSocket connections, connection affinity, graceful deploys, and the expected maximum connection duration.

### Authoritative command flow

1. The client sends an intent such as `DRAW_CARDS`, `MOVE_CARD`, or `CHANGE_LIFE` with its last observed sequence number.
2. The server authenticates the room participant and checks their authority for that command.
3. The server rejects stale, malformed, impossible, or unauthorized commands.
4. The server applies the command to canonical state and advances the sequence number.
5. The server writes an event-log entry and periodically creates a transient snapshot.
6. The server projects canonical state separately for each player so hidden zones remain hidden.
7. The server broadcasts the appropriate projection and acknowledged event to each client.

Clients must not be trusted to shuffle, choose unseen cards, author canonical object identifiers, read another hand/library, approve their own undo request, or declare another player's command accepted.

### State model

Prefer a normalized state model with stable identifiers:

- `GameRoom`: visibility, password hash, host, seats, lifecycle, expiry
- `GameParticipant`: user/guest identity, seat, connection, ready state, deck snapshot
- `GameState`: sequence, active player, phase, step, priority marker, status
- `CardInstance`: stable opaque ID, printed card reference, owner, controller, zone, position, face state, tapped state
- `ZoneState`: ordered or unordered collection plus visibility rules
- `PlayerState`: life, poison, mana, commander-cast counts, elimination state
- `CommanderDamage`: source commander instance/identity, recipient, total
- `CounterState`: object/player, counter name, amount
- `AttachmentState`: source object and attached object/player
- `StackItem`: source, controller, optional targets/notes, order
- `GameEvent`: sequence, actor, command type, sanitized display details, timestamp
- `UndoRequest`: requester, target sequence, status, deciding host

Do not use mutable array positions or printed card IDs as unique in-game identities. Multiple instances of the same card and control-changing effects require stable instance IDs.

### Hidden information

- Canonical state lives only on the server.
- Each connection receives a player-specific projection.
- A card in an opponent's hand is represented only by an opaque placeholder and count/order information that player is entitled to know.
- Library contents and order are never sent to unauthorized clients.
- Revealed cards are disclosed only for the duration and audience required by the user action.
- Logs must not include private card names unless the action intentionally revealed them.
- Reconnect tokens should be scoped to one participant and one active room and expire quickly.

### Temporary persistence

The game does not need durable resume-after-shutdown support, but the server still needs resilience against refreshes and brief disconnections.

- Keep canonical active state in memory for an initial single-instance prototype.
- Add a shared transient store before scaling past one real-time instance.
- Expire abandoned lobby and game state automatically.
- Store only durable metadata that provides product value, such as room creation and final result, if later desired.
- Do not write every board action to the existing audit table; game events have different volume and privacy characteristics.

## Suggested database additions

Exact tables should be designed when implementation begins. Likely durable models include:

- Commander-capable saved decks and normalized deck entries
- Card-data snapshot/version metadata
- Optional lightweight room/game result records
- Guest-safe room membership or invitation records if needed for authorization

Active board state, hands, library order, action events, and undo snapshots can remain transient in the first release. Do not add migrations until the chosen real-time architecture and persistence boundary are confirmed.

## Card data and legality

A future implementation should:

- Import bulk card metadata rather than make one upstream request per card.
- Keep the upstream stable card identifier and relevant printed-face data.
- Store or derive Commander legality, color identity, layout, faces, types, oracle text, image references, and allowed commander relationships.
- Refresh data through an explicit scheduled/admin task.
- Continue serving the last known good snapshot if a refresh fails.
- Validate and atomically promote a new snapshot.
- Respect upstream rate limits, attribution, image usage rules, and caching guidance.
- Separate deck-construction legality from the eventual runtime card-rules implementation.

Official references:

- [Magic Comprehensive Rules](https://magic.wizards.com/en/rules)
- [Magic formats and Commander overview](https://magic.wizards.com/en/formats)
- [Magic banned and restricted lists](https://magic.wizards.com/en/banned-restricted-list)
- [Scryfall API traffic guidance](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17)

## Content-policy and legal checkpoint

Free access helps but does not by itself authorize a digital Commander implementation.

Before public release:

- Review the current [Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy) and [Wizards Terms](https://company.wizards.com/en/legal/terms), because they can change.
- Obtain qualified legal advice or written clarification from Wizards concerning an interactive digital implementation.
- Pay particular attention to the policy's restrictions involving mandatory email registration, game mechanics, trademarks/logos, copying Wizards material, and third-party intellectual property.
- Make gameplay available without mandatory email registration if relying on the Fan Content Policy.
- Include the then-current required unofficial fan-content notice.
- Do not use Wizards logos or present InvadersMTG as approved, affiliated, sanctioned, or endorsed.
- Do not reproduce the Comprehensive Rules in the application; link to the official source and write only the original assistance text needed by the interface.
- Preserve copyright, trademark, artist, and other notices already present on card images.
- Review the application name and all visual branding for trademark risk.
- Confirm separate conditions for the selected card-data and image provider.

The legal checkpoint should occur before investing in automatic card resolution, because deeper reproduction of gameplay rules may present greater policy risk.

## Security and abuse controls

- Rate-limit room creation, password attempts, guest-name changes, and game commands.
- Hash private-room passwords with an appropriate password hashing function.
- Use high-entropy, unguessable room identifiers for private links.
- Validate every command on the server with a strict schema.
- Apply payload-size limits to deck imports, notes, token names, and batch actions.
- Escape all player-entered text.
- Never expose session cookies, password hashes, full canonical state, or hidden card data to real-time peers.
- Make each command idempotent or give it a unique client command ID to prevent duplicate actions on reconnect.
- Prevent spectators and unseated room members from subscribing to private projections.
- Define moderation and room-removal controls before public-room discovery launches.

## Accessibility and desktop UX

- Make every drag-and-drop operation available through click/keyboard commands.
- Provide readable text alternatives for card images.
- Preserve focus when board state updates arrive.
- Announce important actions through a screen-reader-friendly event region without reading every animation.
- Avoid color-only indications for tapped state, counters, targets, ownership, or priority.
- Offer card zoom, scalable text, reduced motion, and high-contrast selection states.
- Design the board for common laptop widths before optimizing for phones.
- Virtualize or otherwise constrain large hands, battlefields, token groups, and action logs.

## Testing strategy

### Unit tests

- Deck-list parsing and normalization
- Commander eligibility and special pairings
- Color-identity and singleton validation
- Ban-list and card-legality updates
- Game command authorization
- Zone visibility projections
- Shuffle behavior using injectable deterministic randomness in tests
- Life, poison, commander damage, tax, counters, and control changes
- Undo boundaries and inverse/snapshot restoration
- Player departure cleanup

### Integration tests

- Guest and account room entry
- Public discovery and private password failures/successes
- Ready checks and game start
- Player-specific hidden-state responses
- Duplicate/stale command handling
- Refresh/reconnect within the grace period
- Host disconnect and authority transfer
- Concession in two-, three-, and four-player games
- Card-data refresh rollback after invalid upstream data

### End-to-end multiplayer tests

Use multiple isolated browser contexts to verify:

- Four players see the same public battlefield state.
- Each player sees only their own hand and entitled reveals.
- Draw and shuffle never leak library contents.
- Simultaneous commands receive a deterministic order.
- Host-approved undo converges every client on the same state.
- A disconnected player can return without creating a duplicate participant.
- A complete representative game can begin, proceed through turns, and end.

## Delivery phases

### Phase 0: legal and hosting validation

- Complete the content-policy checkpoint.
- Confirm guest-access requirements.
- Confirm card-data and image-source conditions.
- Verify WebSocket and scaling support on the target host.
- Choose the real-time transport and transient-state store.

### Phase 1: card catalog and Commander decks

- Add bulk card-data ingestion.
- Extend the deck library to Commander.
- Implement imports, deck editing, commander selection, and legality validation.
- Support session-only guest decks.

### Phase 2: rooms and connection foundation

- Add public discovery and password-protected private rooms.
- Add seats, readiness, validated deck snapshots, and host controls.
- Establish authenticated real-time connections and player-specific state projections.

### Phase 3: playable manual board

- Implement zones, card instances, movement, tapping, counters, tokens, attachments, control changes, stack, and turn tracking.
- Add life, poison, commander damage, commander tax, concessions, and manual ending.
- Add server-side shuffle, hidden information, action history, and host-approved undo.

### Phase 4: hardening and polish

- Add reconnect grace periods and host transfer.
- Complete accessibility and keyboard interaction.
- Add abuse controls, observability, performance tests, and multiplayer end-to-end coverage.
- Run closed playtests focused on usability and missing manual actions.

### Future: incremental rules automation

Do not begin with per-card scripts. Build a general rules kernel in tested layers:

1. Turn structure, priority, and the stack
2. Costs, mana, modes, targets, and legality
3. Combat and state-based actions
4. Triggered, activated, and static abilities
5. Replacement and prevention effects
6. Continuous effects, copy effects, dependencies, and layers
7. Multiplayer departures and Commander-specific rules
8. A declarative card-definition system plus explicitly coded escape hatches
9. Card-by-card conformance tests against current Oracle text and rules updates

The manual command model should remain available as an escape hatch for unsupported cards and rules disagreements during any gradual automation rollout.

## Explicitly out of scope for the first release

- Automatic card-text interpretation or resolution
- Full priority enforcement
- Rules-complete mana payment, targeting, combat, layers, or state-based actions
- Ranked matchmaking or Commander power filters
- Text, voice, or video chat
- Spectators
- Mobile-first battlefield UI
- Durable game resume after all players leave or the service restarts
- Replays
- Tournaments that launch directly into digital game rooms
- Collection ownership, trading, crafting, packs, purchases, prizes, or virtual currency
- Two-Headed Giant, Planechase, Archenemy, Commander Draft, or other variants
- Custom cards and house-rule deck legality

## First-release acceptance criteria

The first release is complete when:

- A guest can play without providing an email address.
- A signed-in player can create, validate, save, and select an official-legal Commander deck.
- A guest can import and validate a deck for the current session.
- A host can create a discoverable public room or a non-discoverable password-protected room.
- Two to four players can join, select valid decks, become ready, and start.
- Each player's opening hand and library remain hidden from every other client.
- Players can perform all common manual zone, counter, token, turn, life, poison, commander-damage, and commander-tax actions.
- Players can place and resolve manual stack items.
- The host can approve or reject undo requests.
- Refreshing briefly does not duplicate a player or reveal private information.
- Conceding correctly removes a player while allowing a multiplayer game to continue.
- Every connected client converges on the same authorized public state after each command.
- The game can be manually completed and the room can expire without durable board-state retention.
- The required policy notice and independent branding are visible.
- Automated tests cover deck legality, hidden information, command ordering, reconnection, undo, and a representative four-player session.

## Decisions to revisit when work resumes

1. Confirm guest access, host transfer, and private-room discovery assumptions.
2. Record the outcome of the legal/content-policy review.
3. Select the card-data/image source and snapshot update schedule.
4. Confirm the production host's real-time connection capabilities.
5. Choose WebSocket infrastructure and whether a shared transient store is needed at initial launch.
6. Decide the exact reconnect grace period and abandoned-room expiry.
7. Decide whether a finished game's participants and winner should be stored permanently.
8. Decide whether Commander bracket information is displayed even though matchmaking filters are deferred.
