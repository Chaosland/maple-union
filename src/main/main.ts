import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
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
const UPDATE_REPO_OWNER = 'Chaosland'
const UPDATE_REPO_NAME = 'maple-union'
const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`
const UPDATE_RELEASE_URL = `https://github.com/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`
const preloadPath = existsSync(join(__dirname, 'preload.js'))
  ? join(__dirname, 'preload.js')
  : join(__dirname, 'preload.mjs')
const rendererIndexPath = join(__dirname, '../dist/index.html')
const windowIconCandidates = [
  join(process.resourcesPath, 'build', 'icon.ico'),
  join(__dirname, '../build/icon.ico'),
  join(__dirname, '../build/icon.png')
]
const windowIconPath = windowIconCandidates.find(path => existsSync(path))

interface UpdateCheckResult {
  ok: boolean
  currentVersion: string
  latestVersion: string | null
  latestUrl: string | null
  updateAvailable: boolean
  message: string
  error?: string
}

function parseVersion(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, '')
  const parts = normalized.split('.').map(part => Number.parseInt(part, 10))
  if (parts.length < 2 || parts.some(part => Number.isNaN(part) || part < 0)) return null
  while (parts.length < 3) parts.push(0)
  return parts.slice(0, 3)
}

function compareVersions(a: string, b: string): number | null {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return null
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (va[i] ?? 0) - (vb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function fetchLatestRelease(): Promise<{ tagName: string; htmlUrl: string }> {
  const res = await fetch(UPDATE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'maple-union'
    }
  })

  if (!res.ok) {
    throw new Error(`GitHub release 조회 실패 (${res.status})`)
  }

  const json = await res.json() as { tag_name?: string; html_url?: string }
  if (!json.tag_name || !json.html_url) {
    throw new Error('GitHub release 응답 형식이 올바르지 않습니다')
  }

  return { tagName: json.tag_name, htmlUrl: json.html_url }
}

function notifyNewVersion(currentVersion: string, latestVersion: string, latestUrl: string): void {
  const notification = new Notification({
    title: '업데이트가 있습니다',
    body: `현재 ${currentVersion}, 최신 ${latestVersion}`,
    silent: false
  })

  notification.on('click', () => {
    shell.openExternal(latestUrl)
  })

  notification.show()
}

async function checkForUpdates(options: { openReleaseOnUpdate: boolean; notifyOnUpdate: boolean; showResultDialog: boolean }): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  try {
    const latest = await fetchLatestRelease()
    const compare = compareVersions(currentVersion, latest.tagName)
    if (compare === null) {
      const result: UpdateCheckResult = {
        ok: false,
        currentVersion,
        latestVersion: latest.tagName,
        latestUrl: latest.htmlUrl,
        updateAvailable: false,
        message: '버전 비교 실패'
      }
      if (options.showResultDialog) {
        await dialog.showMessageBox({
          type: 'warning',
          buttons: ['확인'],
          title: '업데이트 체크',
          message: '버전 비교에 실패했습니다.',
          detail: `현재 버전: ${currentVersion}\n최신 버전: ${latest.tagName}`
        })
      }
      return result
    }

    const updateAvailable = compare < 0
    if (updateAvailable) {
      if (options.notifyOnUpdate) {
        notifyNewVersion(currentVersion, latest.tagName, latest.htmlUrl)
      }
      if (options.openReleaseOnUpdate) {
        shell.openExternal(latest.htmlUrl)
      }
      return {
        ok: true,
        currentVersion,
        latestVersion: latest.tagName,
        latestUrl: latest.htmlUrl,
        updateAvailable: true,
        message: '새 버전이 있습니다'
      }
    }

    if (options.showResultDialog) {
      await dialog.showMessageBox({
        type: 'info',
        buttons: ['확인'],
        title: '업데이트 체크',
        message: '이미 최신 버전입니다.',
        detail: `현재 버전: ${currentVersion}`
      })
    }

    return {
      ok: true,
      currentVersion,
      latestVersion: latest.tagName,
      latestUrl: latest.htmlUrl,
      updateAvailable: false,
      message: '최신 버전입니다'
    }
  } catch (error) {
    const message = String(error)
    if (options.showResultDialog) {
      await dialog.showMessageBox({
        type: 'error',
        buttons: ['확인'],
        title: '업데이트 체크 실패',
        message: '업데이트 정보를 확인하지 못했습니다.',
        detail: message
      })
    }
    return {
      ok: false,
      currentVersion,
      latestVersion: null,
      latestUrl: null,
      updateAvailable: false,
      message,
      error: message
    }
  }
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

  ipcMain.handle('updates:check', async () => {
    return checkForUpdates({
      openReleaseOnUpdate: true,
      notifyOnUpdate: false,
      showResultDialog: true
    })
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  void checkForUpdates({
    openReleaseOnUpdate: false,
    notifyOnUpdate: true,
    showResultDialog: false
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
