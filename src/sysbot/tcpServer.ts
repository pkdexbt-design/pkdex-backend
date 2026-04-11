import net from 'net'
import { connectionManager } from './ConnectionManager'

export function startTcpServer(port: number) {
  const server = net.createServer((socket) => {
    // Disable Nagle algorithm since SysBot interactions are often tiny strings
    socket.setNoDelay(true)
    connectionManager.addConnection(socket)
  })

  let retries = 0
  const MAX_RETRIES = 10

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      retries++
      if (retries >= MAX_RETRIES) {
        console.error(`[TCP Server] Port ${port} still in use after ${MAX_RETRIES} retries — exiting so container restarts cleanly.`)
        process.exit(1)  // Railway will restart the container fresh
      }
      console.warn(`[TCP Server] Port ${port} is in use, retrying in 1s... (${retries}/${MAX_RETRIES})`)
      setTimeout(() => {
        server.close()
        server.listen(port, '0.0.0.0')
      }, 1000)
    } else {
      console.error('[TCP Server] Error:', e)
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`🤖 SysBot TCP Distribution Server listening on 0.0.0.0:${port}`)
  })

  return server
}
