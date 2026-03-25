interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

interface Window {
  api: {
    auth: {
      login(): Promise<{ ok: boolean; error?: string }>
      logout(): Promise<{ ok: boolean }>
      isLoggedIn(): Promise<boolean>
    }
    nexon: {
      getCharacterList(): Promise<IpcResult>
      getUnionInfo(ocid: string): Promise<IpcResult>
      getUnionRaider(ocid: string): Promise<IpcResult>
    }
  }
}
