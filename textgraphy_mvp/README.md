# Textgraphy MVP

A small interaction prototype for **Semantic Depth of Field**.

## Implemented

- Camera-style black viewfinder UI with physical dials and shutter
- Click a sentence to lock the optical and semantic focus together
- Focus Mode dial lets the writer choose Claim, Scope, or Flow as the relation to follow
- Hold Ctrl while moving the mouse to reframe the lens
- Mouse wheel changes semantic aperture and lens size continuously
- Shift + mouse wheel scrolls the manuscript
- Related sentences enter focus directly in the manuscript
- Color / Mono switch for comparing color cues without changing results
- Five-step tone film: Clinical, Restrained, Balanced, Warm, and Expressive
- Hovering a tone previews a real wording change in place; clicking commits it
- Committed sentences retain their tone color in Color mode and the same wording in Mono mode
- Clickable Paragraph / Section / Document frame dial
- Shift + Click to manually include/exclude a sentence
- Shutter freezes the semantic frame and compares neighboring tone treatments
- The chosen treatment can propagate across the in-focus semantic frame
- Selected takes can be applied back to the manuscript

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

This MVP intentionally uses deterministic mock semantic scores so you can first judge whether the interaction itself feels novel and useful.

Later, replace:

- `semanticScore()` with backend LLM relevance scores
- `revisions` with real LLM revision outputs

The Aperture slider should stay entirely client-side so it remains continuous and low-latency.
