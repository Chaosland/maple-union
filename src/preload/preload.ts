import { contextBridge, ipcRenderer } from 'electron'

export type UpdaterState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; error: string }

contextBridge.exposeInMainWorld('api', {
  creds: {
    save:   (key: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('creds:save', key),
    clear:  (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('creds:clear'),
    hasKey: (): Promise<boolean> =>
      ipcRenderer.invoke('creds:hasKey')
  },
  chars: {
    loadAll: (): Promise<IpcResult> =>
      ipcRenderer.invoke('chars:loadAll'),
    onProgress: (cb: (done: number, total: number) => void) => {
      const fn = (_: unknown, d: { done: number; total: number }) => cb(d.done, d.total)
      ipcRenderer.on('chars:progress', fn)
      return () => ipcRenderer.removeListener('chars:progress', fn)
    }
  },
  nexon: {
    getOcid:          (name: string): Promise<IpcResult> => ipcRenderer.invoke('nexon:ocid', name),
    getCharacterBasic:(ocid: string): Promise<IpcResult> => ipcRenderer.invoke('nexon:characterBasic', ocid),
    getUnionInfo:     (ocid: string): Promise<IpcResult> => ipcRenderer.invoke('nexon:unionInfo', ocid),
    getUnionRaider:   (ocid: string): Promise<IpcResult> => ipcRenderer.invoke('nexon:unionRaider', ocid),
    loadAllCharacters:(): Promise<IpcResult> => ipcRenderer.invoke('nexon:loadAllCharacters')
  },
  updates: {
    check:    (): Promise<void> => ipcRenderer.invoke('updates:check'),
    download: (): Promise<void> => ipcRenderer.invoke('updates:download'),
    install:  (): Promise<void> => ipcRenderer.invoke('updates:install'),
    onState: (cb: (state: UpdaterState) => void) => {
      const fn = (_: unknown, state: UpdaterState) => cb(state)
      ipcRenderer.on('updater:state', fn)
      return () => ipcRenderer.removeListener('updater:state', fn)
    }
  }
})

interface IpcResult { ok: boolean; data?: unknown; error?: string }
