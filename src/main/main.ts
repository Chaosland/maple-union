import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
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
// 패키징 시 preload는 asarUnpack으로 asar 외부에 위치 → app.asar.unpacked 경로 사용
// 개발 시에는 dist-electron/preload.js를 직접 참조
const preloadPath = app.isPackaged
  ? join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'preload.js')
  : join(__dirname, 'preload.js')
const rendererIndexPath = join(__dirname, '../dist/index.html')
const windowIconCandidates = [
  join(process.resourcesPath, 'build', 'icon.ico'),
  join(__dirname, '../build/icon.ico'),
  join(__dirname, '../build/icon.png')
]
const windowIconPath = windowIconCandidates.find(path => existsSync(path))

// ── 업데이터 상태 타입 ─────────────────────────────────────────────────────────
type UpdaterState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; error: string }

function sendUpdaterState(state: UpdaterState): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send('updater:state', state)
}

function setupAutoUpdater(): void {
  if (isDev) return

  autoUpdater.autoDownload = false       // 사용자 확인 후 다운로드
  autoUpdater.autoInstallOnAppQuit = true // 종료 시 자동 설치

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterState({ status: 'checking' })
  })
  autoUpdater.on('update-available', info => {
    sendUpdaterState({ status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    sendUpdaterState({ status: 'not-available', version: app.getVersion() })
  })
  autoUpdater.on('download-progress', progress => {
    sendUpdaterState({ status: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', info => {
    sendUpdaterState({ status: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', err => {
    sendUpdaterState({ status: 'error', error: err.message })
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1585,
    height: 886,
    minWidth: 1585,
    minHeight: 886,
    show: false,
    autoHideMenuBar: true,
    title: '메이플 유니온 도우미',
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    // 앱 시작 3초 후 조용히 업데이트 체크
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {})
      }, 3000)
    }
  })
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
  // chars 네임스페이스가 누락된 구버전 preload와의 호환용 백업 채널
  ipcMain.handle('nexon:loadAllCharacters', async (_e) => {
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

  // ── 업데이트 ──────────────────────────────────────────────────────────────
  ipcMain.handle('updates:check', async () => {
    if (isDev) {
      sendUpdaterState({ status: 'not-available', version: app.getVersion() })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      sendUpdaterState({ status: 'error', error: String(e) })
    }
  })
  ipcMain.handle('updates:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (e) {
      sendUpdaterState({ status: 'error', error: String(e) })
    }
  })
  ipcMain.handle('updates:install', () => {
    autoUpdater.quitAndInstall(true, true)
  })
}

app.whenReady().then(() => {
  setupAutoUpdater()
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
