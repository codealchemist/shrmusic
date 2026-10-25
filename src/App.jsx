import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, Search, RefreshCw, ArrowDownAZ, Clock3, FolderSearch, Sparkles, X } from 'lucide-react'
import { useLibrary, usePlayer } from './hooks.js'
import { formatBytes } from './lib.js'
import AlbumCard from './components/AlbumCard.jsx'
import AlbumView from './components/AlbumView.jsx'
import Player from './components/Player.jsx'

const albumFromHash = () => {
  const m = location.hash.match(/^#\/album\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const [toasts, setToasts] = useState([])
  const [addedIds, setAddedIds] = useState(() => new Set())
  const [downloaded, setDownloaded] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name')
  const [openId, setOpenId] = useState(albumFromHash)
  const searchRef = useRef(null)

  const onAdded = useCallback((added) => {
    setAddedIds((s) => new Set([...s, ...added.map((a) => a.id)]))
    const byAlbum = Object.entries(Object.groupBy(added, (a) => a.album))
    const id = Date.now()
    setToasts((t) => [
      ...t,
      ...byAlbum.map(([album, items], i) => ({
        id: id + i,
        album,
        text: items.length === 1 ? items[0].name : `${items.length} new tracks`
      }))
    ])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id < id)), 6000)
  }, [])

  const { library, live, reload } = useLibrary(onAdded)
  const player = usePlayer()
  const albums = library?.albums || []

  // "New" tracks: added or modified after the page opened, until they are downloaded.
  const [openedAt] = useState(Date.now)
  const freshTracks = useMemo(
    () =>
      new Set(
        albums.flatMap((a) =>
          a.tracks.filter((t) => (t.mtime > openedAt || addedIds.has(t.id)) && !downloaded.has(t.id)).map((t) => t.id)
        )
      ),
    [albums, openedAt, addedIds, downloaded]
  )
  const markDownloaded = useCallback((tracks) => setDownloaded((s) => new Set([...s, ...tracks.map((t) => t.id)])), [])

  useEffect(() => {
    const onHash = () => setOpenId(albumFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openAlbum = (id) => {
    location.hash = id ? `#/album/${encodeURIComponent(id)}` : ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea')) return
      if (e.key === '/') (e.preventDefault(), searchRef.current?.focus())
      if (e.key === ' ') (e.preventDefault(), player.toggle())
      if (e.key === 'Escape' && openId) openAlbum(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player.toggle, openId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = albums.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.tracks.some((t) => t.name.toLowerCase().includes(q))
    )
    const cmp = sort === 'recent' ? (a, b) => b.updatedAt - a.updatedAt : (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
    // Albums with matching files first, empty ones at the end.
    return list.sort((a, b) => (!a.tracks.length - !b.tracks.length) || cmp(a, b))
  }, [albums, query, sort])

  const totals = useMemo(
    () => ({
      tracks: albums.reduce((s, a) => s + a.tracks.length, 0),
      size: albums.reduce((s, a) => s + a.size, 0)
    }),
    [albums]
  )

  const openAlbumData = openId && albums.find((a) => a.id === openId)
  const playingAlbumId = player.playing && player.current?.id.split('/')[0]

  return (
    <div className={`app ${player.current ? 'has-player' : ''}`}>
      <div className="aurora" aria-hidden />

      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => (e.preventDefault(), openAlbum(null))}>
          <Disc3 size={26} className={player.playing ? 'spin-slow' : ''} />
          <span>shr<b>music</b></span>
        </a>
        <span className="version" title={`shrmusic v${__APP_VERSION__}`}>v{__APP_VERSION__}</span>

        <label className="search">
          <Search size={17} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => (setQuery(e.target.value), openId && openAlbum(null))}
            placeholder="Search albums and tracks"
          />
          {query ? (
            <button className="icon-btn tiny" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        <div className="topbar-right">
          <span className={`live ${live ? 'is-live' : ''}`} title={live ? 'Watching for new files' : 'Reconnecting…'}>
            <i /> {live ? 'Live' : 'Offline'}
          </span>
          <button className="icon-btn" onClick={reload} title="Refresh" aria-label="Refresh"><RefreshCw size={18} /></button>
        </div>
      </header>

      <main>
        {openAlbumData ? (
          <AlbumView key={openAlbumData.id} album={openAlbumData} player={player} freshIds={freshTracks} onDownload={markDownloaded} onBack={() => openAlbum(null)} />
        ) : (
          <>
            <section className="hero">
              <div>
                <h1>Your library</h1>
                <p className="muted">
                  {albums.length} albums · {totals.tracks} tracks · {formatBytes(totals.size)}
                </p>
              </div>
              <div className="segmented" role="tablist">
                <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}><ArrowDownAZ size={15} /> Name</button>
                <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}><Clock3 size={15} /> Recent</button>
              </div>
            </section>

            {library?.error && (
              <div className="empty">
                <FolderSearch size={42} />
                <h3>Can’t read the music folder</h3>
                <p className="muted">{library.error}</p>
              </div>
            )}

            {library && !library.error && !visible.length && (
              <div className="empty">
                <FolderSearch size={42} />
                <h3>{query ? 'Nothing matches your search' : 'No albums yet'}</h3>
                <p className="muted">
                  {query ? 'Try a different name.' : 'New albums appear here as soon as they’re added to the music folder.'}
                </p>
              </div>
            )}

            {!library && (
              <div className="grid">
                {Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}
              </div>
            )}

            <div className="grid">
              {visible.map((a, i) => (
                <AlbumCard
                  key={a.id}
                  album={a}
                  style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}
                  isFresh={a.tracks.some((t) => freshTracks.has(t.id))}
                  onDownload={() => markDownloaded(a.tracks)}
                  isPlaying={playingAlbumId === a.id}
                  onOpen={() => openAlbum(a.id)}
                  onPlay={() => (playingAlbumId === a.id ? player.toggle() : player.playQueue(a.tracks, 0))}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <Player player={player} albums={albums} onOpenAlbum={openAlbum} onDownload={markDownloaded} />

      <div className="toasts">
        {toasts.map((t) => (
          <button key={t.id} className="toast" onClick={() => openAlbum(t.album)}>
            <Sparkles size={18} />
            <div>
              <strong>{t.album}</strong>
              <span className="muted">{t.text}</span>
            </div>
          </button>
        ))}
      </div>

    </div>
  )
}
