# Textgraphy MVP

A camera-shaped interaction prototype for exploring **Semantic Depth of Field**,
style propagation, and argument panoramas in a long-form manuscript.

## Implemented

- Camera-style black viewfinder UI with physical dials and shutter
- Click a sentence to lock the optical and semantic focus together
- Follow controls let the writer choose Claim strength, Revision scope, or Argument flow
- Frame supports Sentence, Paragraph, Section, and Document boundaries
- Aperture continuously changes which related sentences enter the semantic plane
- Hold Ctrl while moving the mouse to inspect elsewhere without changing the focal sentence
- A visible Wheel control switches between aperture adjustment and normal manuscript scrolling
- Related sentences enter focus directly in the manuscript
- Color / Mono switch for comparing color cues without changing results
- Five-step tone film: Clinical, Restrained, Balanced, Warm, and Expressive
- Hovering a tone temporarily previews wording across the whole semantic plane
- Clicking a tone keeps that preview visible; the shutter applies exactly what is shown
- Adjust Selection exposes every included/excluded sentence without requiring a hidden gesture
- Color / Mono keeps wording and scope identical, changing only the visual cue
- Undo/Redo and per-sentence review support error recovery
- Film stores actual captures, compares saved takes, and can restore a previous take
- Pano sweeps from a chosen start to a scrolling/clicked endpoint and builds an evolving argument summary
- Captures and applied wording are retained in browser storage

## Run

From this folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

No npm install is required.

## Why mock AI?

This MVP intentionally uses a prepared manuscript, deterministic relatedness
scores, authored tone variants, and authored Pano summaries. The interface marks
the document as an example and does not imply that an AI service is connected.

Later, replace:

- `SemanticCamera.score()` with backend semantic relevance results
- `toneVariants` with generated revision outputs
- the authored Pano summary map with a grounded document summarizer

Keep Aperture filtering client-side so the interaction remains continuous and low-latency.

## Verify

```bash
node --test tests/*.cjs
```
