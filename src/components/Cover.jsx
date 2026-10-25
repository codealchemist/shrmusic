import { hues } from '../lib.js'
import { fileUrl } from '../lib.js'

export default function Cover({ album, size = 'md' }) {
  const [a, b] = hues(album.name)
  const initials = album.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className={`cover cover-${size}`}
      style={{ '--h1': a, '--h2': b }}
    >
      {album.cover ? (
        <img src={fileUrl(album.cover)} alt="" loading="lazy" draggable={false} />
      ) : (
        <div className="cover-art" aria-hidden>
          <div className="cover-rings" />
          <span className="cover-initials">{initials}</span>
        </div>
      )}
    </div>
  )
}
