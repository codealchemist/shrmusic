export const fileUrl = (id, download = false) =>
  `/api/file?path=${encodeURIComponent(id)}${download ? '&download=1' : ''}`

export const zipUrl = (albumId) => `/api/zip/${encodeURIComponent(albumId)}`

export function formatBytes(n) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

export function formatTime(s) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function timeAgo(ms) {
  if (!ms) return ''
  const s = (Date.now() - ms) / 1000
  if (s < 60) return 'just now'
  for (const [n, u] of [[86400 * 365, 'y'], [86400 * 30, 'mo'], [86400 * 7, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']])
    if (s >= n) return `${Math.floor(s / n)}${u} ago`
}

// Stable pair of hues per album name, used for generated covers and accents.
export function hues(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = h % 360
  return [a, (a + 40 + ((h >> 9) % 80)) % 360]
}

export const prettyName = (s) => s.replace(/[_]+/g, ' ').replace(/^\d+[\s.\-_]+/, '').trim() || s
export const trackNo = (s) => (s.match(/^(\d+)/) || [])[1]
