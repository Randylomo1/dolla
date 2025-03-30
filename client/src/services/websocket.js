import { derivConfig } from '../config.js'

const setupWebSocket = () => {
  const socket = new WebSocket(derivConfig.WSS_URL)

  socket.onopen = () => {
    console.log('WebSocket connection established')
    socket.send(JSON.stringify({
      app_id: derivConfig.APP_ID,
      account_id: derivConfig.ACCOUNT_ID
    }))
  }

  socket.onmessage = (event) => {
    console.log('Market data update:', JSON.parse(event.data))
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  return socket
}

export default setupWebSocket