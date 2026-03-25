import { safeStorage, app } from 'electron'
import fs from 'fs'
import path from 'path'

const KEY_FILE = path.join(app.getPath('userData'), 'credentials.enc')

function encrypt(s: string): Buffer {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(s)
    : Buffer.from(s, 'utf-8')
}
function decrypt(buf: Buffer): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(buf)
    : buf.toString('utf-8')
}

export function saveCredentials(serviceKey: string): void {
  fs.writeFileSync(KEY_FILE, encrypt(serviceKey.trim()))
}

export function loadCredentials(): string | null {
  if (!fs.existsSync(KEY_FILE)) return null
  try { return decrypt(fs.readFileSync(KEY_FILE)) || null } catch { return null }
}

export function clearCredentials(): void {
  if (fs.existsSync(KEY_FILE)) fs.unlinkSync(KEY_FILE)
}

export function hasServiceKey(): boolean {
  return !!loadCredentials()
}

export function getServiceKey(): string | null {
  return loadCredentials()
}
