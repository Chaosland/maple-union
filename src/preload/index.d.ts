interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

interface UpdateCheckResult {
  ok: boolean
  currentVersion: string
  latestVersion: string | null
  latestUrl: string | null
  updateAvailable: boolean
  message: string
  error?: string
}

interface Window {
  api: {
    creds: {
      save(key: string): Promise<{ ok: boolean; error?: string }>
      clear(): Promise<{ ok: boolean }>
      hasKey(): Promise<boolean>
    }
    chars: {
      loadAll(): Promise<IpcResult>
      onProgress(cb: (done: number, total: number) => void): () => void
    }
    nexon: {
      getOcid(name: string): Promise<IpcResult>
      getCharacterBasic(ocid: string): Promise<IpcResult>
      getUnionInfo(ocid: string): Promise<IpcResult>
      getUnionRaider(ocid: string): Promise<IpcResult>
      loadAllCharacters(): Promise<IpcResult>
    }
    updates: {
      check(): Promise<UpdateCheckResult>
    }
  }
}
