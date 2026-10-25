// Generates a few demo albums of short synthesized WAV loops under ./music
// so the app has something to show. Usage: npm run demo
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'music')
const RATE = 22050

function wav(seconds, voice) {
  const n = Math.floor(seconds * RATE)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const fade = Math.min(1, t * 8, (seconds - t) * 8)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, voice(t) * fade)) * 32767 * 0.6), 44 + i * 2)
  }
  return buf
}

const note = (m) => 440 * 2 ** ((m - 69) / 12)
const sine = (f, t) => Math.sin(2 * Math.PI * f * t)
const env = (t, len) => Math.exp(-((t % len) / len) * 5)

const voices = {
  bass: (root) => (t) => sine(note(root + [0, 0, 7, 5][Math.floor(t * 2) % 4] - 24), t) * env(t, 0.5),
  keys: (root) => (t) => [0, 4, 7].reduce((s, i) => s + sine(note(root + i), t), 0) / 3 * (0.6 + 0.4 * sine(0.5, t)),
  lead: (root) => (t) => sine(note(root + [0, 2, 4, 7, 9, 7, 4, 2][Math.floor(t * 4) % 8] + 12), t) * env(t, 0.25),
  drums: () => (t) => (Math.random() * 2 - 1) * env(t, 0.25) * 0.5 + sine(60 * env(t, 0.5) + 40, t) * env(t, 0.5),
  pad: (root) => (t) => [0, 3, 7, 10].reduce((s, i) => s + sine(note(root + i) * (1 + 0.002 * sine(0.3, t)), t), 0) / 4
}

const albums = {
  'Midnight Circuit': { root: 57, parts: ['bass', 'keys', 'drums', 'lead'] },
  'Coastal Drift': { root: 62, parts: ['pad', 'keys', 'bass'] },
  'Neon Orchard': { root: 64, parts: ['lead', 'drums', 'bass', 'pad', 'keys'] },
  'Low Tide Sessions': { root: 55, parts: ['pad', 'bass'] }
}

for (const [album, { root, parts }] of Object.entries(albums)) {
  const dir = path.join(out, album, 'mp3', 'parts')
  fs.mkdirSync(dir, { recursive: true })
  fs.mkdirSync(path.join(out, album, 'stems'), { recursive: true })
  parts.forEach((p, i) => {
    fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, '0')} ${p}.wav`), wav(8, voices[p](root)))
  })
  // A file outside the match path, to show that matching filters it out.
  fs.writeFileSync(path.join(out, album, 'stems', 'full mix.wav'), wav(4, voices.keys(root)))
  console.log(`✓ ${album}: ${parts.length} parts`)
}
console.log(`\nDemo albums written to ${out}`)
