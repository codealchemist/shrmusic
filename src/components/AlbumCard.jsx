import { Play, Pause, Download, FileAudio } from 'lucide-react'
import Cover from './Cover.jsx'
import { formatBytes, timeAgo, hues, zipUrl } from '../lib.js'

export default function AlbumCard({ album, isPlaying, isFresh, onOpen, onPlay, onDownload, style }) {
  const [h] = hues(album.name)
  const empty = !album.tracks.length
  return (
    <article
      className={`card ${empty ? 'card-empty' : ''} ${isFresh ? 'card-fresh' : ''}`}
      style={{ '--h1': h, ...style }}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="card-media">
        <div className="vinyl" aria-hidden />
        <Cover album={album} />
        {isFresh && <span className="badge-new">New</span>}
        {!empty && (
          <div className="card-actions" onClick={(e) => e.stopPropagation()}>
            <a className="icon-btn glass" href={zipUrl(album.id)} onClick={onDownload} title="Download album (.zip)" aria-label="Download album">
              <Download size={18} />
            </a>
            <button className={`play-fab ${isPlaying ? 'is-playing' : ''}`} onClick={onPlay} aria-label={isPlaying ? 'Pause' : 'Play album'}>
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 title={album.name}>{album.name}</h3>
        <p className="muted">
          {empty ? (
            'No matching files'
          ) : (
            <>
              <FileAudio size={13} /> {album.tracks.length} track{album.tracks.length === 1 ? '' : 's'} · {formatBytes(album.size)}
              <span className="dot-sep">·</span>
              {timeAgo(album.updatedAt)}
            </>
          )}
        </p>
      </div>
    </article>
  )
}
