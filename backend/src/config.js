import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

dotenv.config({ path: path.join(rootDir, '.env') })

export const config = {
  port: Number(process.env.API_PORT) || 3001,
  vaultPath: process.env.VAULT_PATH
    ? path.resolve(rootDir, process.env.VAULT_PATH)
    : path.join(rootDir, '.vault', 'monzo.vault.enc'),
  monzoRedirectUri:
    process.env.MONZO_REDIRECT_URI ||
    'http://localhost:3001/api/auth/monzo/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  monzoApiBase: 'https://api.monzo.com'
}
