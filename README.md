# dwnmusic

Browse, preview and download music from a folder of albums.

- Every folder directly inside the **root folder** becomes an album card.
- A **folder match** picks which audio files to list inside each album, e.g. `mp3/parts/` lists every audio file under `<album>/mp3/parts/` (recursively).
- Preview tracks in the browser, download single files or a whole album as a zip.
- The server watches the root folder; new or changed files show up in the UI instantly.

## Run

```bash
npm install
npm run demo   # optional: generates a few demo albums in ./music
npm run dev    # API on :4321, UI on http://localhost:5173
```

Production: `npm run build && npm start` serves the built UI and API on http://localhost:4321.

## Configuration

Set the root folder and match from the settings button in the app, or edit `dwnmusic.config.json`:

```json
{
  "root": "~/Music/Projects",
  "match": "mp3/parts/"
}
```

Relative roots resolve against the project folder. `MUSIC_ROOT`, `MUSIC_MATCH` and `PORT` environment variables override the file.

Match patterns are relative to each album folder:

| Pattern | Lists |
| --- | --- |
| *(empty)* | every audio file in the album |
| `mp3/parts/` | audio files anywhere under `mp3/parts/` |
| `**/parts/` | any `parts/` folder at any depth |
| `stems/, bounces/` | several folders (comma or newline separated) |
| `*.mp3` | mp3 files at the top of the album |

Album covers are picked from images in the album (`cover`, `folder`, `front`… first); otherwise a cover is generated from the album name.

Keyboard: `/` search, `space` play/pause, `esc` back to all albums.
