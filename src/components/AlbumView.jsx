import { useMemo, useState } from 'react'
import { ArrowLeft, Play, Pause, Download, FolderArchive, Search, Folder, Sparkles } from 'lucide-react'
import Cover from './Cover.jsx'
import Equalizer from './Equalizer.jsx'
import { fileUrl, zipUrl, formatBytes, timeAgo, hues, prettyName, trackNo } from '../lib.js'

export default function AlbumView({ album, player, freshIds, onDownload, onBack }) {
  const [filter, setFilter] = useState('')
  const [h1, h2] = hues(album.name)
  const tracks = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? album.tracks.filter((t) => t.rel.toLowerCase().includes(q)) : album.tracks
  }, [album.tracks, filter])

  const groups = useMemo(() => {
    const m = new Map()
    for (const t of tracks) {
      if (!m.has(t.group)) m.set(t.group, [])
      m.get(t.group).push(t)
    }
    return [...m.entries()]
  }, [tracks])

  const inThisAlbum = player.current && player.current.id.startsWith(album.id + '/')
  const albumPlaying = inThisAlbum && player.playing
  const playAt = (t) => {
    if (player.current?.id === t.id) return player.toggle()
    player.playQueue(album.tracks, album.tracks.indexOf(t))
  }

  return (
    <section className="album-view" style={{ '--h1': h1, '--h2': h2 }}>
      <div className="album-backdrop" aria-hidden>
        {album.cover && <img src={fileUrl(album.cover)} alt="" />}
      </div>

      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> All albums
      </button>

      <header className="album-hero">
        <Cover album={album} size="lg" />
        <div className="album-meta">
          <span className="eyebrow">Album</span>
          <h1>{album.name}</h1>
          <p className="muted">
            {album.tracks.length} tracks · {formatBytes(album.size)} · updated {timeAgo(album.updatedAt)}
          </p>
          <div className="album-actions">
            <button
              className="btn btn-primary"
              disabled={!album.tracks.length}
              onClick={() => (inThisAlbum ? player.toggle() : player.playQueue(album.tracks, 0))}
            >
              {albumPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              {albumPlaying ? 'Pause' : inThisAlbum ? 'Resume' : 'Play all'}
            </button>
            <a className={`btn btn-ghost ${album.tracks.length ? '' : 'disabled'}`} href={zipUrl(album.id)} onClick={() => onDownload(album.tracks)}>
              <FolderArchive size={18} /> Download all
            </a>
            <label className="search search-sm">
              <Search size={16} />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tracks" />
            </label>
          </div>
        </div>
      </header>

      {!tracks.length && (
        <div className="empty">
          <p>{album.tracks.length ? 'No tracks match your filter.' : 'No audio files match the folder pattern in this album.'}</p>
        </div>
      )}

      {groups.map(([group, items]) => (
        <div className="track-group" key={group}>
          {(groups.length > 1 || group) && (
            <h4 className="group-title">
              <Folder size={14} /> {group || 'Root'}
              <span className="muted">{items.length}</span>
            </h4>
          )}
          <ol className="tracks">
            {items.map((t, i) => {
              const isCurrent = player.current?.id === t.id
              const fresh = freshIds.has(t.id)
              return (
                <li
                  key={t.id}
                  className={`track ${isCurrent ? 'is-current' : ''} ${fresh ? 'is-fresh' : ''}`}
                  onDoubleClick={() => playAt(t)}
                  style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
                >
                  <button className="track-play" onClick={() => playAt(t)} aria-label={isCurrent && player.playing ? 'Pause' : 'Play'}>
                    <span className="track-no">
                      {isCurrent && player.playing ? <Equalizer /> : trackNo(t.name) || i + 1}
                    </span>
                    <span className="track-icon">
                      {isCurrent && player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </span>
                  </button>
                  <div className="track-title">
                    <span className="name">{prettyName(t.name)}</span>
                    <span className="file muted">{t.file}</span>
                  </div>
                  {fresh && (
                    <span className="chip chip-new">
                      <Sparkles size={12} /> new
                    </span>
                  )}
                  <span className="chip">{t.ext}</span>
                  <span className="muted track-size">{formatBytes(t.size)}</span>
                  <span className="muted track-date">{timeAgo(t.mtime)}</span>
                  <a className="icon-btn" href={fileUrl(t.id, true)} onClick={() => onDownload([t])} title={`Download ${t.file}`} aria-label={`Download ${t.file}`}>
                    <Download size={17} />
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </section>
  )
}
