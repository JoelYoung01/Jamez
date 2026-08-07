// util
export { Emitter, type Unsubscribe } from './util/emitter'
export {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
  randomId,
} from './util/ids'
export { bytesToBase64, base64ToBytes } from './util/base64'

// crypto + nostr primitives
export { deriveRoomKey, roomTopic, roomAad, seal, open } from './protocol/crypto'
export {
  JAMEZ_EVENT_KIND,
  eventId,
  generateKeypair,
  signEvent,
  verifyEvent,
  type NostrEvent,
  type NostrKeypair,
} from './protocol/nostr-event'

// transports
export type { RoomTransport, TransportStatus } from './transport/types'
export { MemoryRoomTransport, createMemoryTransport } from './transport/memory'
export {
  DEFAULT_RELAYS,
  NostrRoomTransport,
  createNostrTransport,
  type NostrTransportOptions,
  type WebSocketFactory,
  type WebSocketLike,
} from './transport/nostr'

// session protocol
export {
  PLAYER_COLORS,
  SESSION_NICKNAME_MAX,
  makeEnvelope,
  normalizeNickname,
  parseEnvelope,
  pickPlayerColor,
  type Envelope,
  type PlayerProfile,
  type SessionPhase,
  type SessionPlayer,
  type SessionState,
  type WireMessage,
} from './protocol/session-state'
export { HostSession, createHostSession, type HostSessionOptions } from './protocol/host'
export {
  GuestSession,
  createGuestSession,
  type GuestSessionOptions,
  type GuestStatus,
} from './protocol/guest'

// games
export {
  formatPoints,
  isOngoingGame,
  namesList,
  type ActionContext,
  type GameEngine,
  type GameSessionMode,
  type GameSummary,
  type SummaryEntry,
} from './games/types'
export { gameEngines, getGameEngine } from './games/registry'
export {
  WINGSPAN_CATEGORIES,
  emptySheet,
  wingspanEngine,
  wingspanRanking,
  wingspanTotal,
  type WingspanAction,
  type WingspanCategory,
  type WingspanConfig,
  type WingspanSheet,
  type WingspanState,
} from './games/wingspan'
export {
  ginBoxes,
  ginFinalTally,
  ginRummyEngine,
  ginTotals,
  scoreGinHand,
  type GinAction,
  type GinConfig,
  type GinFinalLine,
  type GinHand,
  type GinHandScore,
  type GinOutcome,
  type GinState,
} from './games/gin-rummy'
export {
  CHIP_COLOR_PRESETS,
  DEFAULT_POKER_CHIPS,
  chipBreakdown,
  clonePokerBankConfig,
  defaultPokerBankConfig,
  formatPokerAmount,
  fromPoints,
  pokerBankConfigFromSession,
  pokerBankEngine,
  toPoints,
  type PokerBankAction,
  type PokerBankConfig,
  type PokerBankState,
  type PokerChipDenom,
  type PokerCurrencyMode,
  type PokerLedgerEntry,
  type PokerLedgerKind,
  type PokerPlayerBank,
} from './games/poker-bank'

// persistence helpers (host vault keying)
export {
  HOST_SESSION_LEGACY_KEY,
  HOST_SESSIONS_VAULT_KEY,
  hostSessionEntryKey,
  parseHostSessionEntryKey,
} from './persistence/host-sessions'

// history
export {
  computeStats,
  historyRecordFromState,
  type GameStats,
  type HistoryRecord,
  type HistoryStore,
  type Stats,
} from './history/types'
export {
  buildActivityFeed,
  sessionDisplayName,
  type ActivityItem,
} from './history/activity'
