import { useCallback, useEffect, useRef, useState } from 'react'
import { fileUrl } from './lib.js'

// Loads the library and keeps it fresh through the server's event stream.
export function useLibrary(onAdded) {
  const [library, setLibrary] = useState(null)
  const [live, setLive] = useState(false)
  const onAddedRef = useRef(onAdded)
  onAddedRef.current = onAdded

  const reload = useCallback(async () => {
    const res = await fetch('/api/library')
    setLibrary(await res.json())
  }, [])

  useEffect(() => {
    reload()
    const es = new EventSource('/api/events')
    es.addEventListener('hello', () => setLive(true))
    es.addEventListener('library', (e) => {
      const data = JSON.parse(e.data)
      reload()
      if (data.added?.length) onAddedRef.current?.(data.added)
    })
    es.onerror = () => setLive(false)
    es.onopen = () => setLive(true)
    return () => es.close()
  }, [reload])

  return { library, live, reload }
}

export function usePlayer() {
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }
  const audio = audioRef.current
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(() => Number(safeGet('dwn.volume') ?? 0.8))
  const [loop, setLoop] = useState(false)
  const current = queue[index] || null

  useEffect(() => {
    audio.volume = volume
    safeSet('dwn.volume', volume)
  }, [audio, volume])

  useEffect(() => {
    const on = (ev, fn) => (audio.addEventListener(ev, fn), () => audio.removeEventListener(ev, fn))
    const offs = [
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('timeupdate', () => setTime(audio.currentTime)),
      on('durationchange', () => setDuration(audio.duration)),
      on('loadedmetadata', () => setDuration(audio.duration))
    ]
    return () => offs.forEach((off) => off())
  }, [audio])

  useEffect(() => {
    const onEnded = () => {
      if (loop) return audio.play()
      if (index + 1 < queue.length) setIndex(index + 1)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [audio, queue.length, index, loop])

  useEffect(() => {
    if (!current) return
    const src = fileUrl(current.id)
    if (!audio.src.endsWith(src)) {
      audio.src = src
      setTime(0)
      audio.play().catch(() => {})
    }
  }, [audio, current])

  const playQueue = useCallback((tracks, i = 0) => {
    setQueue(tracks)
    setIndex(i)
    if (tracks[i] && audio.src.endsWith(fileUrl(tracks[i].id))) {
      audio.currentTime = 0
      audio.play()
    }
  }, [audio])

  const toggle = useCallback(() => {
    if (!current) return
    audio.paused ? audio.play() : audio.pause()
  }, [audio, current])

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length - 1)), [queue.length])
  const prev = useCallback(() => {
    if (audio.currentTime > 3) audio.currentTime = 0
    else setIndex((i) => Math.max(i - 1, 0))
  }, [audio])
  const seek = useCallback((t) => (audio.currentTime = t), [audio])
  const setVolume = useCallback((v) => setVolumeState(Math.max(0, Math.min(1, v))), [])

  return { audio, queue, index, current, playing, time, duration, volume, loop, setLoop, playQueue, toggle, next, prev, seek, setVolume }
}

function safeGet(k) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(k, v)
  } catch {}
}
