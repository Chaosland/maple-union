import { contextBridge, ipcRenderer } from 'electron'

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
    getUnionRaider:   (ocid: string): Promise<IpcResult> => ipcRenderer.invoke('nexon:unionRaider', ocid)
  }
})

interface IpcResult { ok: boolean; data?: unknown; error?: string }
