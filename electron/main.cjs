// Electron 래퍼 — 웹앱(Cloudflare Pages)을 데스크탑 창으로 띄움
// 인터넷 연결 필요. API 키 등 모든 로직은 웹앱에서 처리.

const { app, BrowserWindow, shell } = require('electron')

const WEB_URL = 'https://maple-union.pages.dev'

function createWindow() {
  const win = new BrowserWindow({
    width: 1585,
    height: 886,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: '메이플 유니온 도우미',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  // 외부 링크(openapi.nexon.com 등)는 기본 브라우저로 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('ready-to-show', () => win.show())
  win.loadURL(WEB_URL)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
