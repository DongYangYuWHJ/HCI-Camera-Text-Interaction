# Textgraphy MVP

A camera-shaped interaction prototype for exploring **Semantic Depth of Field**,
style propagation, and argument panoramas in a long-form manuscript.

## Current interaction step

- The prototype opens as a normal, readable **Document Space**, without a control-console-first workflow.
- Clicking a sentence selects it without immediately changing modes or modifying text.
- The temporary selection card closes when the writer clicks elsewhere in the document or interface; clicks inside the card, its revision bar, or an open comparison keep it available. The close button and Escape remain equivalent shortcuts.
- An explicit **Focus** action gathers passages with the same semantic concern into a separate **Semantic Viewfinder**.
- The focal passage is pinned first; every related card shows its section, paragraph, sentence ID, and why it was gathered.
- The gather transition starts from each passage's document location so the spatial change explains the system's interpretation.
- Frame is a four-detent physical dial: point or drag around its face to snap between **Sentence / Paragraph / Section / Document**, deciding where Related passages may come from and updating the visible card set. Arrow keys move one structural level at a time.
- Aperture is a physical polar dial inside the current Frame: point or drag around its face and the indicator follows the cursor angle relative to the center. The left arc is **Tighter / Fewer**, the right arc is **Wider / More**, the center has a jitter-resistant dead zone, and arrow keys provide precise control.
- On desktop, the compact header and the Frame / Aperture dials form a left-hand range column while the two-dimensional Style field occupies the right column. This shallow instrument deck leaves the majority of the workspace continuous for reading; narrow screens stack the controls automatically.
- Style is presented as one continuous two-dimensional field: **Tone** runs from Qualified to Assertive on the horizontal axis, while **Warmth** runs from Detached to Approachable on the vertical axis. Dragging the point previews wording directly in every selected passage; a single external **Reset style** action returns the point to the neutral center without adding named presets inside the field.
- Color cues can be switched on to reinforce both axes through four distinct corners—soft warm, strong warm, soft cool, and strong cool—or off for a monochrome treatment; this presentation setting never changes the selected wording.
- Every Related passage remains visible for transparency. Frame and Aperture make an initial suggestion, while an explicit **Apply change / Leave unchanged** checkbox on every card—including the focal reference—is the writer's final, persistent choice.
- Clicking a passage's wording turns that sentence into a lightweight inline editor. A manual edit is locked against later Style movement, while **Use style suggestion** deliberately hands the sentence back to Style and **Restore original** returns the source wording in the preview. Apply commits the exact visible text, including direct edits, and keeps it in undo, comparison, and restored sessions.
- **View in document** returns to and highlights a card's source; **Back to document** restores the previous reading position.
- A floating Shutter capsule appears only when the preview contains real wording changes. **Cancel** restores the current document without leaving the viewfinder; pressing **Shutter** commits exactly the visible wording as a numbered Take, gives a restrained capture flash, and immediately becomes a Take receipt with **Undo**. Recently applied words stay highlighted in the viewfinder and receive a persistent marker back in the document. Selecting an edited sentence shows two actions at once: the normal **Focus** bar and a compact revision bar with **Compare / Keep current / Restore**. Keep current only closes comparison; it never removes access to the saved revision, and a one-sentence restore remains undoable.
- The persistent **Takes** counter opens Film as a safe revision history. A whole Take or one sentence can be reverted and reapplied; anything modified by a later Take is labeled **Changed later**, locked, and skipped rather than silently overwritten. Each Take summarizes current, reverted, and protected passages and keeps direct edits visible.
- **Pano** opens a document-first panoramic reading space. It begins at the currently selected sentence—or the start of the manuscript—and a second click sets the endpoint; the continuous range, argument steps, and clearly labeled example synthesis update together. A new start can be chosen directly, reverse sweeps normalize to reading order, and Shutter saves a reviewable Pano snapshot without modifying the document.
- Keyboard focus, Escape behavior, reduced-motion preferences, and screen-reader isolation are supported.

The prototype now covers the complete document-first loop: select text, gather
semantic context, control revision scope and style, capture a safe Take, review
history, and trace a continuous argument with Pano.

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
