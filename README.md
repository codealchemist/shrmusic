# shrmusic

Browse, preview and download music from a folder of albums.

- Every folder directly inside the **root folder** becomes an album card (folders starting with `_` or `.` are skipped).
- A **folder match** picks which audio files to list inside each album, e.g. `mp3/parts/` lists every audio file under `<album>/mp3/parts/` (recursively).
- Preview tracks in the browser, download single files or a whole album as a zip.
- The server watches the root folder; new or changed files show up in the UI instantly.

## Run

```bash
npm install
npm run demo   # optional: generates a few demo albums in ./music
cp .env.example .env  # then set MUSIC_ROOT and MUSIC_MATCH
npm run dev    # API on :4321, UI on http://localhost:5173
```

Production: `npm run build && npm start` serves the built UI and API on http://localhost:4321.

Both modes listen on all network interfaces, so other devices on your LAN can open the app. The network URLs are printed on startup (e.g. `http://192.168.x.x:5173`). On first run, macOS may ask whether to allow incoming connections for `node`.

## Configuration

Settings live in a `.env` file on the server (gitignored). Copy the example and edit it:

```bash
cp .env.example .env
```

```bash
MUSIC_ROOT=~/Music/Projects
MUSIC_MATCH=mp3/parts/
PORT=4321
```

These values stay on the server: the browser never sees the folder path or the match, and there is no way to change them from the UI. Relative roots resolve against the project folder. Real environment variables take precedence over `.env`. In dev, editing `.env` restarts the API server.

Match patterns are relative to each album folder:

| Pattern | Lists |
| --- | --- |
| *(empty)* | every audio file in the album |
| `mp3/parts/` | audio files anywhere under `mp3/parts/` |
| `**/parts/` | any `parts/` folder at any depth |
| `stems/, bounces/` | several folders (comma separated) |
| `*.mp3` | mp3 files at the top of the album |

Album covers are picked from images in the album (`cover`, `folder`, `front`… first); otherwise a cover is generated from the album name.

Keyboard: `/` search, `space` play/pause, `esc` back to all albums.
