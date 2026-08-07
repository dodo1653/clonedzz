import type {
  AnalyzeResponse,
  GenerateResult,
  OutputItem,
  PreviewInfo,
  PushResult,
  Recipe,
  SessionItem,
  ThemeItem,
  TokenPreset,
  TokenSiteData,
  VerifyReport,
} from './types'

const BASE = (import.meta.env.VITE_API as string) || 'http://localhost:4747'

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`)
  return data as T
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`)
  return data as T
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  return (await r.json()) as T
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`)
  return data as T
}

export const api = {
  analyze: (url: string, name?: string) => post<AnalyzeResponse>('/api/analyze', { url, name }),
  generate: (body: { sessionId?: string; recipe?: Recipe; name: string; token?: TokenSiteData | null; install?: boolean; removeGates?: boolean }) =>
    post<GenerateResult>('/api/generate', body),
  verify: (sourceUrl: string, replicaDir: string) => post<VerifyReport>('/api/verify', { sourceUrl, replicaDir }),
  push: (body: { dir: string; repo: string; branch?: string; token?: string; message?: string }) => post<PushResult>('/api/push', body),
  preview: (dir: string) => post<PreviewInfo>('/api/preview', { dir }),
  previewStop: (port: number) => post<{ ok: boolean }>('/api/preview/stop', { port }),
  themes: () => get<ThemeItem[]>('/api/themes'),
  saveTheme: (name: string, recipe: Recipe) => post<{ name: string }>('/api/themes', { name, recipe }),
  deleteTheme: (name: string) => del<{ ok: boolean }>(`/api/themes/${name}`),
  tokens: () => get<TokenPreset[]>('/api/tokens'),
  saveToken: (data: TokenSiteData) => post<{ id: string }>('/api/tokens', data),
  deleteToken: (id: string) => del<{ ok: boolean }>(`/api/tokens/${id}`),
  sessions: () => get<SessionItem[]>('/api/sessions'),
  session: (id: string) => get<Recipe>(`/api/sessions/${id}`),
  renameSession: (id: string, name: string) => patch<{ ok: boolean; id: string; name?: string }>(`/api/sessions/${id}`, { name }),
  deleteSession: (id: string) => del<{ ok: boolean }>(`/api/sessions/${id}`),
  outputs: () => get<OutputItem[]>('/api/outputs'),
}
