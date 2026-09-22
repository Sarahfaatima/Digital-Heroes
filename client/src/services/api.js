// Thin fetch wrapper: base URL from VITE_API_URL, JWT from localStorage, uniform errors.
const raw = import.meta.env.VITE_API_URL || '/api'
const BASE = raw.replace(/\/+$/, '').endsWith('/api') ? raw.replace(/\/+$/, '') : `${raw.replace(/\/+$/, '')}/api`

const TOKEN_KEY = 'dh_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn)

async function request(method, path, { body, form, params, raw: rawResponse } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let url = BASE + path
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
    if (qs) url += `?${qs}`
  }

  let res
  try {
    res = await fetch(url, { method, headers, body: payload })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }
  if (rawResponse && res.ok) return res
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data && data.code)
  }
  return data
}

export const api = {
  get: (p, params) => request('GET', p, { params }),
  post: (p, body) => request('POST', p, { body }),
  put: (p, body) => request('PUT', p, { body }),
  del: (p) => request('DELETE', p),
  upload: (p, form) => request('POST', p, { form }),
  blob: async (p) => (await request('GET', p, { raw: true })).blob(),
}
