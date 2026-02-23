'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Terminal, Plus, Pencil, Trash2, Eye, EyeOff, WifiOff, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SshSession {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string   // stored locally — never leaves the browser
}

type FormState = Omit<SshSession, 'id'>

type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

const STORAGE_KEY = 'ssh-sessions'
const DEFAULT_PORT = 22

function wsEndpoint(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/ssh`
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadSessions(): SshSession[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions: SshSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

// ---------------------------------------------------------------------------
// xterm theme — dark terminal look regardless of blog theme
// ---------------------------------------------------------------------------

const TERM_THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f7850',
  black: '#0d1117',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#76e3ea',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#87deea',
  brightWhite: '#f0f6fc',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SshPage() {
  const router = useRouter()

  const [sessions, setSessions] = useState<SshSession[]>([])
  const [activeSession, setActiveSession] = useState<SshSession | null>(null)
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '', host: '', port: DEFAULT_PORT, username: '', password: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // xterm refs
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    setSessions(loadSessions())
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
  }, [])

  // Init xterm once the terminal div is rendered and a session is active
  useEffect(() => {
    if (!terminalRef.current || !activeSession) return

    let disposed = false

    async function initTerm() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      if (disposed || !terminalRef.current) return

      // Dispose previous terminal if any
      xtermRef.current?.dispose()
      fitAddonRef.current = null

      const term = new Terminal({
        theme: TERM_THEME,
        fontFamily: 'Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        convertEol: true,
      })

      const fit = new FitAddon()
      term.loadAddon(fit)
      term.loadAddon(new WebLinksAddon())
      term.open(terminalRef.current)
      fit.fit()

      xtermRef.current = term
      fitAddonRef.current = fit

      term.writeln('\x1b[1;32mSSH Client ready.\x1b[0m')
      term.writeln(`\x1b[90mTarget: ${activeSession!.username}@${activeSession!.host}:${activeSession!.port}\x1b[0m`)
      term.writeln('\x1b[90mClick \x1b[0mConnect\x1b[90m to start the session.\x1b[0m')
    }

    initTerm()

    const onResize = () => fitAddonRef.current?.fit()
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
    }
  // Re-initialize terminal only when session changes (not on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id])

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  const persistSessions = useCallback((updated: SshSession[]) => {
    setSessions(updated)
    saveSessions(updated)
  }, [])

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  function openAddForm() {
    setEditingId(null)
    setForm({ name: '', host: '', port: DEFAULT_PORT, username: '', password: '' })
    setFormError(null)
    setShowPassword(false)
    setShowForm(true)
  }

  function openEditForm(session: SshSession) {
    setEditingId(session.id)
    setForm({ name: session.name, host: session.host, port: session.port, username: session.username, password: session.password })
    setFormError(null)
    setShowPassword(false)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  function submitForm() {
    if (!form.name.trim()) return setFormError('Name is required.')
    if (!form.host.trim()) return setFormError('Host is required.')
    if (!form.username.trim()) return setFormError('Username is required.')
    const port = Number(form.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return setFormError('Port must be between 1 and 65535.')

    if (editingId) {
      const updated = sessions.map((s) => s.id === editingId ? { ...s, ...form, port } : s)
      persistSessions(updated)
      if (activeSession?.id === editingId) setActiveSession(updated.find((s) => s.id === editingId) ?? null)
    } else {
      const newSession: SshSession = { id: crypto.randomUUID(), ...form, port }
      persistSessions([...sessions, newSession])
    }
    cancelForm()
  }

  function deleteSession(id: string) {
    persistSessions(sessions.filter((s) => s.id !== id))
    if (activeSession?.id === id) {
      disconnect()
      setActiveSession(null)
    }
  }

  function selectSession(session: SshSession) {
    if (activeSession?.id !== session.id) disconnect()
    setActiveSession(session)
    setConnectStatus('idle')
    setErrorMsg(null)
    setShowForm(false)
  }

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------

  function disconnect() {
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectStatus('closed')
  }

  async function connect() {
    if (!activeSession) return
    const term = xtermRef.current
    if (!term) return

    disconnect()
    setConnectStatus('connecting')
    setErrorMsg(null)

    term.reset()
    term.writeln(`\x1b[33mConnecting to ${activeSession.username}@${activeSession.host}:${activeSession.port}…\x1b[0m`)

    try {
      const ws = new WebSocket(wsEndpoint())
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = async () => {
        // Send connection params as the first message — server reads this before streaming
        ws.send(JSON.stringify({
          host: activeSession.host,
          port: activeSession.port,
          username: activeSession.username,
          password: activeSession.password,
        }))

        // Attach xterm — all subsequent messages are raw SSH terminal data
        const { AttachAddon } = await import('@xterm/addon-attach')
        term.loadAddon(new AttachAddon(ws))

        setConnectStatus('connected')
        fitAddonRef.current?.fit()
      }

      ws.onerror = () => {
        const msg = 'WebSocket connection failed.'
        term.writeln(`\r\n\x1b[31m${msg}\x1b[0m`)
        setConnectStatus('error')
        setErrorMsg(msg)
      }

      ws.onclose = (ev) => {
        term.writeln(`\r\n\x1b[33mConnection closed (${ev.code}).\x1b[0m`)
        setConnectStatus('closed')
        wsRef.current = null
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      term.writeln(`\r\n\x1b[31mError: ${msg}\x1b[0m`)
      setConnectStatus('error')
      setErrorMsg(msg)
    }
  }

  // ---------------------------------------------------------------------------
  // Status badge
  // ---------------------------------------------------------------------------

  const statusColor: Record<ConnectStatus, string> = {
    idle: 'text-muted-foreground',
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
    error: 'text-destructive',
    closed: 'text-muted-foreground',
  }
  const statusLabel: Record<ConnectStatus, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Error',
    closed: 'Disconnected',
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-7xl flex-col px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Terminal className="h-7 w-7 text-muted-foreground" />
            <h1 className="text-4xl font-bold">SSH Client</h1>
          </div>
          <p className="text-muted-foreground pl-[88px]">
            Browser-based SSH terminal. Sessions are saved locally in your browser.
          </p>
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* ── Sessions sidebar ── */}
          <div className="w-full shrink-0 lg:w-64">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sessions</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddForm} aria-label="Add session">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New session</TooltipContent>
                </Tooltip>
              </div>

              {sessions.length === 0 && !showForm && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No sessions yet.
                  <br />
                  <button onClick={openAddForm} className="mt-1 text-primary underline underline-offset-2">
                    Add one
                  </button>
                </p>
              )}

              <ul className="space-y-1">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <div
                      className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors ${
                        activeSession?.id === session.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => selectSession(session)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectSession(session)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{session.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {session.username}@{session.host}:{session.port}
                        </div>
                      </div>
                      <div className="ml-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); openEditForm(session) }}
                              aria-label="Edit session"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                              aria-label="Delete session"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Add / Edit form */}
              {showForm && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">{editingId ? 'Edit session' : 'New session'}</h3>
                  <div className="space-y-2">
                    <Input placeholder="Name" value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="h-8 text-sm" />
                    <Input placeholder="Host / IP" value={form.host}
                      onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                      className="h-8 text-sm" />
                    <Input placeholder="Username" value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      className="h-8 text-sm" />
                    {/* Password with show/hide toggle */}
                    <div className="relative">
                      <Input
                        placeholder="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="h-8 pr-8 text-sm"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <Input placeholder="Port" type="number" min={1} max={65535} value={form.port}
                      onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                      className="h-8 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-destructive" role="alert">{formError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 flex-1 text-xs" onClick={submitForm}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={cancelForm}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Terminal panel ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {!activeSession ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Terminal className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">Select a session to open the terminal,</p>
                <p className="text-muted-foreground">
                  or{' '}
                  <button onClick={openAddForm} className="text-primary underline underline-offset-2">
                    add a new one
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{activeSession.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {activeSession.username}@{activeSession.host}:{activeSession.port}
                    </span>
                  </div>
                  {/* Status indicator */}
                  <span className={`text-xs font-medium ${statusColor[connectStatus]}`}>
                    {statusLabel[connectStatus]}
                  </span>
                  {connectStatus === 'connected' ? (
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={disconnect}>
                      <WifiOff className="h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={connect}
                      disabled={connectStatus === 'connecting'}
                    >
                      <Wifi className="h-3.5 w-3.5" />
                      {connectStatus === 'connecting' ? 'Connecting…' : connectStatus === 'closed' ? 'Reconnect' : 'Connect'}
                    </Button>
                  )}
                </div>

                {/* Error banner */}
                {errorMsg && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
                    {errorMsg}
                  </div>
                )}

                {/* xterm container */}
                <div
                  ref={terminalRef}
                  className="min-h-[480px] flex-1 overflow-hidden rounded-lg border"
                  style={{ background: TERM_THEME.background }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
