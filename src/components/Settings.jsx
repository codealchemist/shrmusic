import { useEffect, useState } from 'react'
import { X, FolderOpen, ListFilter, Check, Loader2 } from 'lucide-react'

const EXAMPLES = ['mp3/parts/', '**/parts/', 'stems/, bounces/', '*.mp3']

export default function Settings({ onClose, onSaved }) {
  const [root, setRoot] = useState('')
  const [match, setMatch] = useState('')
  const [resolved, setResolved] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => (setRoot(c.root), setMatch(c.match), setResolved(c.resolvedRoot)))
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, match })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok || data.error) return setError(data.error || 'Could not save settings')
    onSaved()
    onClose()
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={save}>
        <header>
          <h2>Library settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <label className="field">
          <span><FolderOpen size={15} /> Root folder</span>
          <input value={root} onChange={(e) => setRoot(e.target.value)} placeholder="~/Music/Projects" spellCheck={false} autoFocus />
          <small className="muted">Every folder directly inside becomes an album card. {resolved && <code>{resolved}</code>}</small>
        </label>

        <label className="field">
          <span><ListFilter size={15} /> Folder match</span>
          <textarea rows={3} value={match} onChange={(e) => setMatch(e.target.value)} placeholder="mp3/parts/" spellCheck={false} />
          <small className="muted">
            Path inside each album to look for audio in (searched recursively). Separate several with commas or new lines.
            <code>*</code> matches one folder, <code>**</code> any depth. Leave empty to list every audio file.
          </small>
        </label>

        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex} className="chip chip-btn" onClick={() => setMatch(ex)}>{ex}</button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <footer>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={17} className="spin" /> : <Check size={17} />} Save & rescan
          </button>
        </footer>
      </form>
    </div>
  )
}
