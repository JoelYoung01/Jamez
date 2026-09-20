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

// profile (emoji palette + tiny avatar helpers)
export { PLAYER_EMOJI, randomEmoji } from './profile/emoji'
export {
  AVATAR_MAX_CHARS,
  AVATAR_SIZE_PX,
  normalizeAvatarPhoto,
  stripPlayerPhotos,
} from './profile/avatar'

// session protocol
export {
  PLAYER_COLORS,
  SESSION_NICKNAME_MAX,
  isPlayerActive,
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
  asDrawSummary,
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
  type GinDealerRotation,
  type GinFinalLine,
  type GinHand,
  type GinHandScore,
  type GinOutcome,
  type GinState,
} from './games/gin-rummy'
export {
  CRIBBAGE_PEG_KIND_LABELS,
  CRIBBAGE_QUICK_PEGS,
  CRIBBAGE_RANKS,
  CRIBBAGE_SUITS,
  cribbageEngine,
  cribbageIsSkunk,
  cribbagePipValue,
  cribbageSequenceValue,
  cribbageTotals,
  scoreCribbageHand,
  type CribbageAction,
  type CribbageCard,
  type CribbageConfig,
  type CribbageHandBreakdown,
  type CribbagePeg,
  type CribbagePegKind,
  type CribbageRank,
  type CribbageState,
  type CribbageSuit,
} from './games/cribbage'
export {
  FLIP7_BONUS,
  FLIP7_NUMBER_CARDS,
  FLIP7_PLUS_MODIFIERS,
  flip7Engine,
  flip7RoundComplete,
  flip7Totals,
  scoreFlip7Round,
  type Flip7Action,
  type Flip7Config,
  type Flip7Round,
  type Flip7RoundInput,
  type Flip7State,
} from './games/flip-7'
export {
  HAND_AND_FOOT_CLEAN_BOOK,
  HAND_AND_FOOT_DIRTY_BOOK,
  HAND_AND_FOOT_GOING_OUT,
  HAND_AND_FOOT_RED_THREE,
  HAND_AND_FOOT_WILD_BOOK,
  buildHandAndFootTeams,
  clampPlayersPerTeam,
  handAndFootEngine,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  teamIdForPlayer,
  teamLabel,
  type HandAndFootAction,
  type HandAndFootConfig,
  type HandAndFootRound,
  type HandAndFootRoundInput,
  type HandAndFootState,
  type HandAndFootTeam,
} from './games/hand-and-foot'
export {
  CHIP_COLOR_PRESETS,
  DEFAULT_POKER_CHIPS,
  buildCashOverdrawConfirm,
  buildCashTransferSummary,
  chipBreakdown,
  clonePokerBankConfig,
  defaultPokerBankConfig,
  formatPokerAmount,
  fromPoints,
  pointsFromChipCounts,
  pokerBankConfigFromSession,
  pokerBankEngine,
  toPoints,
  type CashTransferSummary,
  type CashTransferSummaryTone,
  type PokerBankAction,
  type PokerBankConfig,
  type PokerBankState,
  type PokerChipDenom,
  type PokerCurrencyMode,
  type PokerLedgerEntry,
  type PokerLedgerKind,
  type PokerPlayerBank,
} from './games/poker-bank'
export {
  buildPokerBalanceReport,
  pokerBalanceChartRows,
  pokerBalanceSeriesFromLedger,
  type PokerBalanceChartRow,
  type PokerBalancePlayerMeta,
  type PokerBalanceReport,
  type PokerBalanceSample,
  type PokerBalanceSeries,
} from './games/poker-reports'

// persistence helpers (host vault keying + room lifecycle)
export {
  HOST_SESSION_LEGACY_KEY,
  HOST_SESSIONS_VAULT_KEY,
  hostSessionEntryKey,
  isOpenRoomStatus,
  normalizeRoomStatus,
  parkStatusForPhase,
  parseHostSessionEntryKey,
  roomStatusLabel,
  type RoomStatus,
} from './persistence/host-sessions'
export {
  PLAYER_ROSTER_STORAGE_KEY,
  removeRosterPlayer,
  rosterAvailableForSession,
  sortRosterPlayers,
  upsertRosterPlayer,
  type RosterPlayer,
  type RosterPlayerSource,
} from './persistence/player-roster'

// history
export {
  computeStats,
  cribbagePegsFromHistory,
  flip7RoundsFromHistory,
  ginHandsFromHistory,
  handAndFootRoundsFromHistory,
  historyDetailFromState,
  historyRecordFromState,
  type GameStats,
  type HistoryGameDetail,
  type HistoryRecord,
  type HistoryStore,
  type Stats,
} from './history/types'
export {
  buildActivityFeed,
  sessionDisplayName,
  type ActivityItem,
} from './history/activity'
export {
  historyRecordFromOngoingArchive,
  isEndedLongTermRecord,
  listLongTermSessions,
  type LongTermRoom,
  type VaultRoomSnapshot,
} from './history/long-term'
