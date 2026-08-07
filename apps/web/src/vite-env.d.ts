/// <reference types="vite/client" />

interface DesktopApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  onMaximized(cb: (value: boolean) => void): () => void
}

interface Window {
  desktop?: DesktopApi
}
