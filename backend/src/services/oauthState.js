import fs from 'fs'
import path from 'path'
import { config } from '../config.js'

const STATE_TTL_MS = 30 * 60 * 1000

function stateFilePath() {
  return path.join(path.dirname(config.vaultPath), 'oauth-states.json')
}

function readStates() {
  const file = stateFilePath()
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function writeStates(states) {
  const file = stateFilePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(states, null, 2), 'utf8')
}

function prune(states) {
  const now = Date.now()
  const next = {}
  for (const [state, createdAt] of Object.entries(states)) {
    if (now - createdAt < STATE_TTL_MS) next[state] = createdAt
  }
  return next
}

export function registerOAuthState(state) {
  const states = prune(readStates())
  states[state] = Date.now()
  writeStates(states)
}

export function consumeOAuthState(state) {
  const states = prune(readStates())
  if (!state || !states[state]) return false
  delete states[state]
  writeStates(states)
  return true
}
