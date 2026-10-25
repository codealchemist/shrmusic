import express from 'express'
import chokidar from 'chokidar'
import { ZipArchive } from 'archiver'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configFile = path.join(projectDir, 'dwnmusic.config.json')
const PORT = Number(process.env.PORT) || 4321

const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.oga', '.opus', '.aiff', '.aif', '.wma', '.webm'])
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'artwork']

// ---------- config ----------

function loadConfig() {
  let saved = {}
  try {
    saved = JSON.parse(fs.readFileSync(configFile, 'utf8'))
  } catch {}
  return {
    root: process.env.MUSIC_ROOT || saved.root || path.join(projectDir, 'music'),
    match: process.env.MUSIC_MATCH ?? saved.match ?? ''
  }
}

let config = loadConfig()

async function saveConfig(next) {
  config = { ...config, ...next }
  await fsp.writeFile(configFile, JSON.stringify(config, null, 2) + '\n')
}

const expandHome = (p) => (p.startsWith('~') ? path.join(process.env.HOME || '', p.slice(1)) : p)
// Relative roots are resolved against the project folder.
const rootDir = () => path.resolve(projectDir, expandHome(config.root))

// ---------- matching ----------

// Patterns are relative to each album folder, e.g. "mp3/parts/". Several can be
// separated by commas or new lines. Supports * (one segment) and ** (any depth).
// A pattern matches every audio file inside the folder it points to (recursively).
export function parsePatterns(match) {
  return String(match || '')
    .split(/[\n,]/)
    .map((p) => p.trim().replace(/\\/g, '/').replace(/^\.?\/+/, ''))
    .filter(Boolean)
}

function patternToRegex(pattern) {
  const dirOnly = pattern.endsWith('/') || !/[*?]|\.[a-z0-9]+$/i.test(pattern)
  const body = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) =>
      seg === '**'
        ? '(?:.*/)?'
        : seg.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '/'
    )
    .join('')
  // Directory patterns match anything below them; file patterns must match exactly.
  return new RegExp('^' + (dirOnly ? body + '.*' : body.replace(/\/$/, '') + '$'), 'i')
}

function matcher(match) {
  const patterns = parsePatterns(match)
  if (!patterns.length) return { test: () => true, base: () => '' }
  const compiled = patterns.map((p) => ({ re: patternToRegex(p), depth: p.replace(/\/+$/, '').split('/').length }))
  return {
    test: (rel) => compiled.some((c) => c.re.test(rel)),
    // Folder of the file relative to the matched pattern, used to group tracks in the UI.
    base: (rel) => {
      const c = compiled.find((c) => c.re.test(rel))
      const dirs = rel.split('/').slice(0, -1)
      return c ? dirs.slice(Math.min(c.depth, dirs.length)).join('/') : dirs.join('/')
    }
  }
}

// ---------- scanning ----------

async function walk(dir, rel = '', out = []) {
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const abs = path.join(dir, e.name)
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) await walk(abs, r, out)
    else if (e.isFile()) out.push({ abs, rel: r })
  }
  return out
}

function findCover(files) {
  const images = files.filter((f) => IMAGE_EXT.has(path.extname(f.rel).toLowerCase()))
  const byName = images.find((f) => COVER_NAMES.includes(path.basename(f.rel, path.extname(f.rel)).toLowerCase()))
  // Prefer a conventional cover name, then the shallowest image in the album.
  return byName || images.sort((a, b) => a.rel.split('/').length - b.rel.split('/').length)[0]
}

let library = { albums: [], scannedAt: 0, error: null }

async function scan() {
  const root = rootDir()
  const m = matcher(config.match)
  let dirs
  try {
    // Hidden (.) and underscore (_) folders are not albums, e.g. a shared _mp3 export folder.
    dirs = (await fsp.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
  } catch (err) {
    library = { albums: [], scannedAt: Date.now(), error: `Cannot read ${root}: ${err.code || err.message}` }
    return library
  }

  const albums = await Promise.all(
    dirs.map(async (d) => {
      const files = await walk(path.join(root, d.name))
      const cover = findCover(files)
      const tracks = []
      for (const f of files) {
        const ext = path.extname(f.rel).toLowerCase()
        if (!AUDIO_EXT.has(ext) || !m.test(f.rel)) continue
        const st = await fsp.stat(f.abs).catch(() => null)
        if (!st) continue
        tracks.push({
          id: `${d.name}/${f.rel}`,
          name: path.basename(f.rel, path.extname(f.rel)),
          file: path.basename(f.rel),
          rel: f.rel,
          group: m.base(f.rel),
          ext: ext.slice(1),
          size: st.size,
          mtime: st.mtimeMs
        })
      }
      tracks.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name, undefined, { numeric: true }))
      return {
        id: d.name,
        name: d.name,
        cover: cover ? `${d.name}/${cover.rel}` : null,
        tracks,
        size: tracks.reduce((s, t) => s + t.size, 0),
        updatedAt: tracks.reduce((s, t) => Math.max(s, t.mtime), 0)
      }
    })
  )
  albums.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  library = { albums, scannedAt: Date.now(), error: null }
  return library
}

// ---------- live updates ----------

const clients = new Set()
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) res.write(msg)
}

let watcher = null
let rescanTimer = null
function scheduleRescan(reason) {
  clearTimeout(rescanTimer)
  rescanTimer = setTimeout(async () => {
    const before = new Set(library.albums.flatMap((a) => a.tracks.map((t) => t.id)))
    await scan()
    const added = library.albums.flatMap((a) => a.tracks.filter((t) => !before.has(t.id)).map((t) => ({ id: t.id, album: a.name, name: t.name })))
    broadcast('library', { scannedAt: library.scannedAt, reason, added })
    console.log(`[dwnmusic] rescanned (${reason}) — ${added.length} new track(s)`)
  }, 350)
}

async function startWatcher() {
  await watcher?.close()
  const root = rootDir()
  if (!fs.existsSync(root)) return
  watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (p) => path.basename(p).startsWith('.') && p !== root,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 }
  })
  watcher.on('all', (event) => scheduleRescan(event))
  watcher.on('error', (err) => console.error('[dwnmusic] watcher error', err))
}

// ---------- http ----------

const app = express()
app.use(express.json())

// Resolve a "<album>/<path>" id to an absolute path, refusing anything outside the root.
function resolveInRoot(rel) {
  const root = rootDir()
  const abs = path.resolve(root, String(rel || ''))
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

app.get('/api/config', (_req, res) => res.json({ ...config, resolvedRoot: rootDir() }))

app.put('/api/config', async (req, res) => {
  const { root, match } = req.body || {}
  if (typeof root !== 'string' || !root.trim()) return res.status(400).json({ error: 'root is required' })
  await saveConfig({ root: root.trim(), match: typeof match === 'string' ? match : '' })
  await scan()
  await startWatcher()
  broadcast('library', { scannedAt: library.scannedAt, reason: 'config', added: [] })
  res.json({ ...config, resolvedRoot: rootDir(), error: library.error })
})

app.get('/api/library', (_req, res) => res.json({ ...library, root: rootDir(), match: config.match }))

app.get('/api/file', (req, res) => {
  const abs = resolveInRoot(req.query.path)
  if (!abs || !fs.existsSync(abs)) return res.sendStatus(404)
  if (req.query.download) return res.download(abs, path.basename(abs))
  res.sendFile(abs, { acceptRanges: true, maxAge: '1h' })
})

app.get('/api/zip/:album', (req, res) => {
  const album = library.albums.find((a) => a.id === req.params.album)
  if (!album || !album.tracks.length) return res.sendStatus(404)
  res.attachment(`${album.name}.zip`)
  const zip = new ZipArchive({ zlib: { level: 0 } }) // audio is already compressed
  zip.on('error', (err) => res.destroy(err))
  zip.pipe(res)
  for (const t of album.tracks) zip.file(path.join(rootDir(), album.id, t.rel), { name: t.rel })
  zip.finalize()
})

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`event: hello\ndata: ${JSON.stringify({ scannedAt: library.scannedAt })}\n\n`)
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => {
    clearInterval(ping)
    clients.delete(res)
  })
})

const dist = path.join(projectDir, 'dist')
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*any}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

await scan()
await startWatcher()
const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)

app.listen(PORT, '0.0.0.0', () => {
  const label = process.env.NODE_ENV === 'production' ? 'app' : 'api'
  console.log(`[dwnmusic] ${label} on http://localhost:${PORT}`)
  for (const ip of lanAddresses()) console.log(`[dwnmusic] ${label} on http://${ip}:${PORT} (network)`)
  console.log(`[dwnmusic] root: ${rootDir()}  match: ${config.match || '(all audio files)'}`)
})
