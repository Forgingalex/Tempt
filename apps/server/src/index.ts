import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'

// Load environment variables
config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes placeholder
app.get('/api', (_req, res) => {
  res.json({
    name: 'Tempt API',
    version: '0.1.0',
    description: 'AI Agent Marketplace Backend',
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

export default app
