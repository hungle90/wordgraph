# Graphical Definitions

A one-page interactive web app inspired by **word-graph**: it visualizes how English words define each other through a force-directed graph.

## What is included

- **Data builder script** (`scripts/build-graph-data.mjs`)
- **Generated graph dataset** (`public/graph-data.json`)
- **Frontend page** (`public/index.html`, `public/app.js`, `public/styles.css`)
- **Mock definitions source** (`data/mock-definitions.json`)
- **Vocabulary list** (`data/vocab/google-10000-english.txt`)

## Quick start

```bash
npm run build:data
npm run start
```

Open: `http://localhost:4173`

## Data pipeline behavior

The build script performs:

1. Read vocabulary from `.txt`
2. Load definitions (currently from mock JSON)
3. Tokenize definitions into lowercase words
4. Keep only tokens existing in vocabulary
5. Remove self-links (`word -> word` is ignored)
6. Build directed graph links (`source -> target`)
7. Compute node metrics:
   - `inDegree`
   - `outDegree`
   - `incomingNeighbors`
   - `outgoingNeighbors`

Output schema (required keys preserved):

```json
{
  "nodes": [
    { "id": "language", "freqRank": 1, "inDegree": 6, "outDegree": 7 }
  ],
  "links": [
    { "source": "language", "target": "word" }
  ]
}
```

Additional fields are included for UI convenience (`definition`, neighbors arrays, `meta`).

## Frontend features

- Header + subtitle + global stats (words, connections)
- Search bar with focus/highlight for matching node
- Zoom, pan, drag node
- Hover tooltip and neighbor highlight
- Click node to update detail panel
- Reset view button
- Loading, error, and empty data handling
- Insights section:
  - top incoming degree words
  - top outgoing degree words
  - out/in ratio highlights

## Replacing mock definitions with real Open English WordNet later

You can swap definition provider with minimal changes:

1. Keep `loadVocabulary(...)` and graph assembly logic unchanged.
2. Replace `loadDefinitions(...)` in `scripts/build-graph-data.mjs` with a WordNet-backed loader.
3. Return the same object shape:
   ```js
   {
     language: "...definition text...",
     communication: "...definition text..."
   }
   ```
4. Run `npm run build:data` again.

The rest of the pipeline and frontend can stay the same as long as node/link schema is preserved.

## Notes

- This MVP uses mock definitions so UI works end-to-end immediately.
- Architecture is intentionally simple and extensible.
