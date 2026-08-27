# Textgraphy MVP

A small interaction prototype for **Semantic Depth of Field**.

## Implemented

- Mouse-following circular lens
- Text crisp inside lens, dim/blurred outside
- Click sentence to set focus
- Aperture slider changes semantic relevance threshold
- Lens radius also changes with Aperture
- Paragraph / Section / Document frame selector
- Shift + Click to manually include/exclude a sentence
- Shutter opens a mock revision contact sheet

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
