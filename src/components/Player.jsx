import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, Download, Repeat1, Music } from 'lucide-react'
import Cover from './Cover.jsx'
import { fileUrl, formatTime, prettyName } from '../lib.js'

export default function Player({ player, albums, onOpenAlbum }) {
  const { current, playing, time, duration, volume } = player
  const canvasRef = useRef(null)
  const [scrub, setScrub] = useState(null)
  const album = current && albums.find((a) => current.id.startsWith(a.id + '/'))

  useVisualizer(player.audio, canvasRef, playing)

  if (!current) {
    return (
      <footer className="player player-idle">
        <Music size={18} />
        <span className="muted">Pick a track to start listening — hover any album and hit play.</span>
      </footer>
    )
  }

  const shown = scrub ?? time
  const pct = duration ? (shown / duration) * 100 : 0
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <footer className="player">
      <canvas ref={canvasRef} className="viz" aria-hidden />
      <div className="player-now" onClick={() => album && onOpenAlbum(album.id)}>
        {album && <Cover album={album} size="sm" />}
        <div className="now-text">
          <strong>{prettyName(current.name)}</strong>
          <span className="muted">{album?.name}</span>
        </div>
      </div>

      <div className="player-center">
        <div className="transport">
          <button className="icon-btn" onClick={player.prev} aria-label="Previous"><SkipBack size={18} fill="currentColor" /></button>
          <button className="play-main" onClick={player.toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={player.next} disabled={player.index >= player.queue.length - 1} aria-label="Next">
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button className={`icon-btn ${player.loop ? 'is-on' : ''}`} onClick={() => player.setLoop(!player.loop)} aria-label="Repeat track" title="Repeat track">
            <Repeat1 size={17} />
          </button>
        </div>
        <div className="seek">
          <span className="time">{formatTime(shown)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={shown}
            style={{ '--pct': `${pct}%` }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={(e) => (player.seek(Number(e.currentTarget.value)), setScrub(null))}
            onKeyUp={(e) => (player.seek(Number(e.currentTarget.value)), setScrub(null))}
            aria-label="Seek"
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button className="icon-btn" onClick={() => player.setVolume(volume ? 0 : 0.8)} aria-label="Mute">
          <VolIcon size={18} />
        </button>
        <input
          className="volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={{ '--pct': `${volume * 100}%` }}
          onChange={(e) => player.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
        <a className="icon-btn" href={fileUrl(current.id, true)} title="Download this track" aria-label="Download this track">
          <Download size={18} />
        </a>
      </div>
    </footer>
  )
}

// Draws a soft frequency glow behind the player bar.
function useVisualizer(audio, canvasRef, playing) {
  const graph = useRef(null)
  useEffect(() => {
    if (!playing || !audio) return
    if (!graph.current) {
      try {
        const ctx = new AudioContext()
        const src = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.85
        src.connect(analyser)
        analyser.connect(ctx.destination)
        graph.current = { ctx, analyser, data: new Uint8Array(analyser.frequencyBinCount) }
      } catch {
        return
      }
    }
    const { ctx, analyser, data } = graph.current
    ctx.resume()
    let raf
    const draw = () => {
      const c = canvasRef.current
      if (c) {
        const w = (c.width = c.clientWidth * devicePixelRatio)
        const h = (c.height = c.clientHeight * devicePixelRatio)
        const g = c.getContext('2d')
        analyser.getByteFrequencyData(data)
        // Log-spaced bars so low and high frequencies share the width evenly.
        const n = 56
        const bw = w / n
        for (let i = 0; i < n; i++) {
          const v = data[Math.min(data.length - 1, Math.floor(data.length ** (i / n)))] / 255
          const bh = v * h
          g.fillStyle = `hsla(${18 + (i / n) * 300}, 95%, 62%, ${0.15 + v * 0.35})`
          g.fillRect(i * bw, h - bh, bw - 2 * devicePixelRatio, bh)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [audio, canvasRef, playing])
}
