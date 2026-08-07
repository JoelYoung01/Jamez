import {
  getGameEngine,
  normalizeJoinCode,
  type SessionPlayer,
  type SessionState,
} from '@jamez/core'
import { router, useLocalSearchParams } from 'expo-router'
import {
  ChevronLeftIcon,
  CircleHelpIcon,
  DoorClosedIcon,
  FlagIcon,
  HandIcon,
  MedalIcon,
  MoonIcon,
  RotateCcwIcon,
  TrophyIcon,
  UserPlusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { EmojiGrid } from '@/components/emoji-grid'
import { PlayerAvatar } from '@/components/player-avatar'
import { QrCard } from '@/components/qr-card'
import { RequireProfile } from '@/components/require-profile'
import { StatusPill } from '@/components/status-pill'
import { AppButton, Card, CardTitle, Chip, Muted, Screen, SectionLabel } from '@/components/ui'
import { getGameIcon, getGameUI } from '@/games/registry'
import { randomEmoji, useProfile } from '@/lib/profile'
import { sessionIsOngoing, useSession } from '@/lib/session-store'

export default function SessionScreen() {
  const insets = useSafeAreaInsets()
  const { code: codeParam = '' } = useLocalSearchParams<{ code: string }>()
  const code = normalizeJoinCode(codeParam)
  const hasName = useProfile((s) => s.name.trim().length > 0)
  const store = useSession()

  // Attach to this session: resume hosting if we have a snapshot for the
  // code, otherwise join as a guest. Waits for a profile name so deep-linked
  // first-timers introduce themselves before joining.
  React.useEffect(() => {
    if (!code) {
      router.replace('/join')
      return
    }
    if (!hasName) return
    if (store.code === code && store.role) return
    let cancelled = false
    void store.resumeHost(code).then((resumed) => {
      if (!cancelled && !resumed) store.joinGame(code)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, hasName])

  if (!code) return null

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <RequireProfile>
          <SessionBody code={code} />
        </RequireProfile>
      </View>
    </Screen>
  )
}

function SessionBody({ code }: { code: string }) {
  const store = useSession()
  const { role, state } = store

  if (!role || store.code !== code) {
    return <ConnectingCard code={code} label="Setting up…" />
  }

  if (role === 'guest') {
    const status = store.guestStatus
    if (status === 'rejected') {
      return (
        <StatusCard
          icon={DoorClosedIcon}
          title="Couldn't join"
          body="The host turned this request down. The session may be full or already running."
          onDone={() => store.leaveSession()}
        />
      )
    }
    if (status === 'removed') {
      return (
        <StatusCard
          icon={HandIcon}
          title="You were removed"
          body="The host removed you from this session."
          onDone={() => store.leaveSession()}
        />
      )
    }
    if (status === 'ended') {
      return (
        <StatusCard
          icon={MoonIcon}
          title="Session ended"
          body="The host wrapped up this session. Finished games are saved in your history."
          onDone={() => store.leaveSession()}
        />
      )
    }
    if (!state || status === 'connecting' || status === 'waiting_host') {
      return <ConnectingCard code={code} label="Looking for the host…" waiting />
    }
  }

  if (!state) return <ConnectingCard code={code} label="Loading session…" />

  return (
    <View className="gap-4">
      <SessionHeader state={state} />
      {store.role === 'guest' && store.guestStatus === 'host_lost' && (
        <View className="flex-row items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <ActivityIndicator size="small" color="#fbbf24" />
          <Text className="flex-1 text-sm text-primary">
            Host went quiet. Hang tight, we'll resync the moment they're back.
          </Text>
        </View>
      )}
      {state.phase === 'lobby' && <LobbyView />}
      {state.phase === 'playing' && <PlayingView />}
      {state.phase === 'finished' && <FinishedView />}
    </View>
  )
}

function SessionHeader({ state }: { state: SessionState }) {
  const store = useSession()
  const game = getGameEngine(state.gameId)
  const GameIcon = getGameIcon(state.gameId)
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70"
        >
          <ChevronLeftIcon size={18} color="#f4f4f5" />
        </Pressable>
        <GameIcon size={24} color={game?.accentColor ?? '#a1a1ab'} />
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-zinc-100" numberOfLines={1}>
            {game?.name ?? state.gameId}
          </Text>
          <Text className="font-mono text-xs tracking-widest text-muted-foreground">{state.code}</Text>
        </View>
      </View>
      <StatusPill transportStatus={store.transportStatus} passAndPlay={store.passAndPlay} />
    </View>
  )
}

function ConnectingCard({ code, label, waiting }: { code: string; label: string; waiting?: boolean }) {
  return (
    <Card className="items-center gap-4 px-6 py-12">
      <ActivityIndicator size="large" color="#fbbf24" />
      <View className="items-center">
        <Text className="font-medium text-zinc-100">{label}</Text>
        <Text className="mt-1 font-mono text-sm tracking-widest text-muted-foreground">{code}</Text>
      </View>
      {waiting && (
        <Text className="max-w-xs text-center text-xs text-muted-foreground/70">
          Make sure the host's session is open and you're both online (or on the same custom
          relay). Codes expire when the host closes the session.
        </Text>
      )}
      <AppButton variant="ghost" size="sm" title="Cancel" onPress={() => router.replace('/')} />
    </Card>
  )
}

function StatusCard({
  icon: Icon,
  title,
  body,
  onDone,
}: {
  icon: LucideIcon
  title: string
  body: string
  onDone?: () => void
}) {
  return (
    <Card className="items-center gap-3 px-6 py-12">
      <Icon size={40} color="#a1a1ab" />
      <Text className="text-lg font-semibold text-zinc-100">{title}</Text>
      <Text className="max-w-xs text-center text-sm text-muted-foreground">{body}</Text>
      <AppButton
        title="Back home"
        onPress={() => {
          onDone?.()
          router.replace('/')
        }}
      />
    </Card>
  )
}

function PlayerRow({
  player,
  canKick,
  onKick,
}: {
  player: SessionPlayer
  canKick: boolean
  onKick: () => void
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-line bg-background/40 px-3 py-2">
      <PlayerAvatar player={player} size="sm" showPresence />
      <Text className="min-w-0 flex-1 text-sm font-medium text-zinc-100" numberOfLines={1}>
        {player.name}
      </Text>
      {player.isHost && <Chip>host</Chip>}
      {!player.remote && !player.isHost && <Chip tone="outline">local</Chip>}
      {canKick && (
        <Pressable onPress={onKick} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-md active:opacity-70">
          <XIcon size={14} color="#a1a1ab" />
        </Pressable>
      )}
    </View>
  )
}

function AddLocalPlayerButton() {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())

  const add = () => {
    if (!name.trim()) return
    addLocalPlayer({ name: name.trim(), emoji })
    setName('')
    setEmoji(randomEmoji())
    setOpen(false)
  }

  return (
    <>
      <AppButton
        variant="outline"
        size="sm"
        title="Local player"
        icon={<UserPlusIcon size={14} color="#f4f4f5" />}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/70 px-5" onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} className="rounded-2xl border border-line bg-card p-5">
            <Text className="mb-4 text-lg font-semibold text-zinc-100">Add a local player</Text>
            <View className="gap-4">
              <View>
                <SectionLabel>Name</SectionLabel>
                <AppTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Grandma"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  maxLength={24}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={add}
                  className="h-12 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
                />
              </View>
              <View>
                <SectionLabel>Emoji</SectionLabel>
                <EmojiGrid value={emoji} onChange={setEmoji} />
              </View>
              <AppButton title="Add player" onPress={add} disabled={!name.trim()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function LobbyView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const game = getGameEngine(state.gameId)
  const ui = getGameUI(state.gameId)
  const summary = ui?.configSummary?.(state.gameConfig) ?? []
  const canStart = state.players.length >= (game?.minPlayers ?? 1)

  return (
    <View className="gap-4">
      {isHost && !store.passAndPlay && (
        <Card className="p-4">
          <QrCard code={state.code} />
        </Card>
      )}

      <Card className="p-4">
        <View className="mb-3 flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <CardTitle>
              Players ({state.players.length}
              {game ? `/${game.maxPlayers}` : ''})
            </CardTitle>
            {summary.length > 0 && (
              <View className="mt-1.5 flex-row flex-wrap gap-1">
                {summary.map((chip) => (
                  <Chip key={chip} tone="outline">
                    {chip}
                  </Chip>
                ))}
              </View>
            )}
          </View>
          {isHost && <AddLocalPlayerButton />}
        </View>
        <View className="gap-2">
          {state.players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              canKick={isHost && !player.isHost}
              onKick={() => store.removePlayer(player.id)}
            />
          ))}
          {state.players.length === 1 && !store.passAndPlay && (
            <Text className="py-2 text-center text-xs text-muted-foreground/70">
              Waiting for friends… they can scan the QR or enter the code in the app or website.
            </Text>
          )}
        </View>
      </Card>

      {isHost ? (
        <AppButton
          size="lg"
          title={
            canStart
              ? sessionIsOngoing(state)
                ? 'Open the bank'
                : 'Start the game'
              : `Need ${game?.minPlayers ?? 1}+ players to start`
          }
          disabled={!canStart}
          onPress={() => store.startGame()}
        />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color="#a1a1ab" />
          <Text className="text-sm text-muted-foreground">Waiting for the host to start…</Text>
        </View>
      )}
      {isHost && <HostSessionControls />}
    </View>
  )
}

function PlayingView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const profileId = useProfile((s) => s.playerId)
  const ui = getGameUI(state.gameId)
  const me = state.players.find((p) => p.id === profileId) ?? null

  if (!ui) {
    return (
        <StatusCard
        icon={CircleHelpIcon}
        title="Unsupported game"
        body="This app version doesn't know this game yet. Update and rejoin."
      />
    )
  }
  const PlayView = ui.PlayView
  const ongoing = sessionIsOngoing(state)

  return (
    <View className="gap-4">
      <PlayView
        state={state}
        me={me}
        isHost={isHost}
        send={(action, actorId) => store.sendAction(action, actorId)}
      />
      {isHost && (
        <View className="gap-2">
          {!ongoing && (
            <AppButton
              variant="secondary"
              title="Finish & reveal results"
              icon={<FlagIcon size={16} color="#f4f4f5" />}
              onPress={() => store.finishGame()}
            />
          )}
          <HostSessionControls />
        </View>
      )}
    </View>
  )
}

function FinishedView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const ui = getGameUI(state.gameId)
  const summary = state.summary
  if (!summary) return null

  const medal = (rank: number) =>
    rank <= 3 ? (
      <MedalIcon size={20} color={rank === 1 ? '#facc15' : rank === 2 ? '#d4d4d8' : '#d97706'} />
    ) : (
      <Text className="text-sm font-bold text-muted-foreground">#{rank}</Text>
    )

  return (
    <View className="gap-4">
      <Card className="items-center gap-2 border-primary/40 bg-primary/10 px-4 py-8">
        <TrophyIcon size={32} color="#fbbf24" />
        <Text className="text-center text-xl font-bold tracking-tight text-zinc-100">
          {summary.headline}
        </Text>
        <Muted>Saved to everyone's local history</Muted>
      </Card>

      <Card className="gap-2 p-4">
        {summary.entries.map((entry) => {
          const player = state.players.find((p) => p.id === entry.playerId)
          if (!player) return null
          const winner = summary.winnerIds.includes(entry.playerId)
          return (
            <View
              key={entry.playerId}
              className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                winner ? 'border-primary/50 bg-primary/10' : 'border-line bg-background/40'
              }`}
            >
              <View className="w-8 items-center">{medal(entry.rank)}</View>
              <PlayerAvatar player={player} size="sm" />
              <Text className="min-w-0 flex-1 font-medium text-zinc-100" numberOfLines={1}>
                {player.name}
              </Text>
              <Text className="font-mono text-sm font-semibold text-muted-foreground">
                {entry.scoreText}
              </Text>
            </View>
          )
        })}
      </Card>

      {ui?.ResultsDetail && <ui.ResultsDetail state={state} />}

      <View className="gap-2">
        {isHost && (
          <AppButton
            size="lg"
            title="Rematch"
            icon={<RotateCcwIcon size={18} color="#251a02" />}
            onPress={() => store.rematch()}
          />
        )}
        {isHost ? (
          <HostSessionControls />
        ) : (
          <AppButton
            variant="secondary"
            title="Leave session"
            onPress={() => {
              store.leaveSession()
              router.replace('/')
            }}
          />
        )}
      </View>
    </View>
  )
}

function HostSessionControls() {
  const store = useSession()
  const ongoing = sessionIsOngoing(store.state)
  const [mode, setMode] = React.useState<'idle' | 'park' | 'end'>('idle')

  if (mode === 'idle') {
    return (
      <View className="gap-2">
        {ongoing && (
          <AppButton
            title="Close for now"
            icon={<MoonIcon size={16} color="#251a02" />}
            onPress={() => setMode('park')}
          />
        )}
        <AppButton
          variant="destructive"
          title={ongoing ? 'Dissolve bank' : 'End session for everyone'}
          onPress={() => setMode('end')}
        />
      </View>
    )
  }

  if (mode === 'park') {
    return (
      <View className="flex-row gap-2">
        <AppButton
          title="Yes, park it"
          className="flex-1"
          onPress={() => {
            store.parkSession()
            router.replace('/')
          }}
        />
        <AppButton variant="outline" title="Keep open" className="flex-1" onPress={() => setMode('idle')} />
      </View>
    )
  }

  return (
    <View className="flex-row gap-2">
      <AppButton
        variant="destructive"
        title={ongoing ? 'Yes, dissolve' : 'Yes, end it'}
        className="flex-1"
        onPress={() => {
          store.endSession()
          router.replace('/')
        }}
      />
      <AppButton
        variant="secondary"
        title="Keep playing"
        className="flex-1"
        onPress={() => setMode('idle')}
      />
    </View>
  )
}
