import { createServer } from 'node:http'
import { parse } from 'node:url'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import { Client as SshClient } from 'ssh2'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT ?? 3000)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    handle(req, res, parsedUrl)
  })

  // ---------------------------------------------------------------------------
  // WebSocket server — handles SSH bridging on path /api/ssh
  // ---------------------------------------------------------------------------

  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url ?? '/')
    if (pathname !== '/api/ssh') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  wss.on('connection', (ws: WebSocket) => {
    let ssh: SshClient | null = null
    let stream: import('ssh2').ClientChannel | null = null
    let ready = false

    // First message from the client must be the JSON handshake
    ws.once('message', (data) => {
      let params: { host: string; port: number; username: string; password: string }

      try {
        params = JSON.parse(data.toString())
      } catch {
        ws.send('\r\n\x1b[31mInvalid handshake.\x1b[0m\r\n')
        ws.close(1008, 'Invalid handshake')
        return
      }

      const { host, port, username, password } = params

      if (!host || !username || !password) {
        ws.send('\r\n\x1b[31mMissing connection parameters.\x1b[0m\r\n')
        ws.close(1008, 'Missing params')
        return
      }

      ssh = new SshClient()

      ssh.on('ready', () => {
        ready = true
        ssh!.shell({ term: 'xterm-256color' }, (err, sh) => {
          if (err) {
            ws.send(`\r\n\x1b[31mShell error: ${err.message}\x1b[0m\r\n`)
            ws.close(1011, 'Shell error')
            return
          }

          stream = sh

          // SSH → browser
          sh.on('data', (chunk: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
          })

          sh.stderr.on('data', (chunk: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
          })

          sh.on('close', () => {
            ws.close(1000, 'Session ended')
          })

          // Browser → SSH (all subsequent messages after the handshake)
          ws.on('message', (msg) => {
            if (stream && !stream.destroyed) {
              stream.write(typeof msg === 'string' ? msg : Buffer.from(msg as ArrayBuffer))
            }
          })
        })
      })

      ssh.on('error', (err) => {
        const msg = `\r\n\x1b[31mSSH error: ${err.message}\x1b[0m\r\n`
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
        ws.close(1011, err.message)
      })

      ssh.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'SSH ended')
      })

      ws.on('close', () => {
        stream?.destroy()
        if (ready) ssh?.end()
        else ssh?.destroy()
      })

      ssh.connect({
        host,
        port: port ?? 22,
        username,
        password,
        // Reasonable timeouts
        readyTimeout: 15_000,
        keepaliveInterval: 10_000,
      })
    })
  })

  // ---------------------------------------------------------------------------

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
