import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { saveCredentials, clearCredentials, hasServiceKey } from './apikey'
import { getOcid, getCharacterBasic, getUnionInfo, getUnionRaider } from './nexon-api'
import { loadAllCharacters } from './charlist'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const shouldOpenDevTools = process.env.OPEN_DEVTOOLS === '1'
const preloadPath = existsSync(join(__dirname, 'preload.js'))
  ? join(__dirname, 'preload.js')
  : join(__dirname, 'preload.mjs')
const rendererIndexPath = join(__dirname, '../dist/index.html')
const windowIconPath = join(__dirname, '../build/icon.png')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1585,
    height: 886,
    minWidth: 1585,
    minHeight: 886,
    show: false,
    autoHideMenuBar: true,
    title: '메이플 유니온 도우미',
    ...(existsSync(windowIconPath) ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut =
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && input.key.toUpperCase() === 'I')

    if (isDevToolsShortcut) event.preventDefault()
  })
  win.webContents.on('devtools-opened', () => {
    if (!shouldOpenDevTools) win.webContents.closeDevTools()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    if (shouldOpenDevTools) win.webContents.openDevTools()
  } else {
    win.loadFile(rendererIndexPath)
  }
}

function registerIpcHandlers(): void {
  // ── API 키 관리 ──────────────────────────────────────────────────────────
  ipcMain.handle('creds:save',   (_e, key: string) => {
    try { saveCredentials(key); return { ok: true } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('creds:clear',  () => { clearCredentials(); return { ok: true } })
  ipcMain.handle('creds:hasKey', () => hasServiceKey())

  // ── 전체 캐릭터 불러오기 ─────────────────────────────────────────────────
  ipcMain.handle('chars:loadAll', async (_e) => {
    const win = BrowserWindow.getAllWindows()[0]
    try {
      const chars = await loadAllCharacters((done, total) => {
        win?.webContents.send('chars:progress', { done, total })
      })
      return { ok: true, data: chars }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // ── Nexon Open API ────────────────────────────────────────────────────────
  ipcMain.handle('nexon:ocid',           async (_e, name: string)  => {
    try { return { ok: true, data: await getOcid(name) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('nexon:characterBasic', async (_e, ocid: string)  => {
    try { return { ok: true, data: await getCharacterBasic(ocid) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('nexon:unionInfo',      async (_e, ocid: string)  => {
    try { return { ok: true, data: await getUnionInfo(ocid) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('nexon:unionRaider',    async (_e, ocid: string)  => {
    try { return { ok: true, data: await getUnionRaider(ocid) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
