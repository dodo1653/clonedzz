/// <reference types="vite/client" />

interface UpdateStatus {
  state: 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

interface DesktopApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  onMaximized(cb: (value: boolean) => void): () => void
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
  quitAndInstall(): void
}

interface Window {
  desktop?: DesktopApi
}
