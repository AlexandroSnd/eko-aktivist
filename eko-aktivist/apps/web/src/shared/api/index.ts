export type APIError = {
  code: string
  message: string
  field_errors?: Record<string, string[]>
  request_id?: string
}
let csrf = ''

export async function initCsrf() {
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' })
  csrf = (await response.json()).csrf_token
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  if (!csrf && options.method && options.method !== 'GET') await initCsrf()
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) }
  if (options.body && !(options.body instanceof FormData))
    headers['Content-Type'] = 'application/json'
  if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf
  const response = await fetch(`/api/v1${path}`, { credentials: 'include', ...options, headers })
  if (!response.ok) {
    const error: APIError = await response
      .json()
      .catch(() => ({ code: 'network_error', message: 'Не удалось выполнить запрос' }))
    throw error
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const post = (path: string, body: unknown = {}) =>
  api(path, { method: 'POST', body: JSON.stringify(body) })
export const put = (path: string, body: unknown) =>
  api(path, { method: 'PUT', body: JSON.stringify(body) })
export const patch = (path: string, body: unknown) =>
  api(path, { method: 'PATCH', body: JSON.stringify(body) })

export const eventTypes: Record<string, string> = {
  cleanup: 'Уборка',
  recycling: 'Вторсырьё',
  planting: 'Посадка',
  lecture: 'Лекция',
  quest: 'Квест',
}
export const formatDate = (value?: string | null) => {
  if (!value) return 'Дата уточняется'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата уточняется'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Yekaterinburg',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
export const toEkbISOString = (value: string) => new Date(value + ':00+05:00').toISOString()
export const toEkbInput = (value: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Yekaterinburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(value))
    .replace(' ', 'T')
