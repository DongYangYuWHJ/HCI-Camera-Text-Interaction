"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SemanticCamera } = require("../camera-core.js");

function camera() {
  const sentences = [
    { id: "s1", text: "Original one.", issue: "absolute", score: 0.97, sectionId: "intro", paragraphId: "p1" },
    { id: "s2", text: "Original two.", issue: "scope", score: 0.85, sectionId: "intro", paragraphId: "p1" },
    { id: "s3", text: "Original three.", issue: "absolute", score: 0.82, sectionId: "intro", paragraphId: "p2" },
    { id: "s4", text: "Original four.", issue: "absolute", score: 0.64, sectionId: "design", paragraphId: "p1" },
    { id: "s5", text: "Original five.", issue: "absolute", score: 0.44, sectionId: "design", paragraphId: "p2" }
  ];
  const toneVariants = Object.fromEntries(sentences.map(sentence => [sentence.id, {
    balanced: sentence.text,
    warm: `Warm ${sentence.id}.`,
    clinical: `Clinical ${sentence.id}.`
  }]));
  return new SemanticCamera({ sentences, toneVariants });
}

test("no focus has no accidental edit target; choosing tone only stages a preview", () => {
  const state = camera();
  state.setTone("warm");
  assert.deepEqual(state.includedIds(), []);
  assert.deepEqual(state.pendingIds(), []);
  assert.equal(state.capture(), null);
  state.focus("s1");
  state.setTone("warm");
  assert.equal(state.text("s1"), "Warm s1.");
  assert.equal(state.text("s3"), "Warm s3.");
  assert.equal(state.text("s4"), "Original four.");
  assert.equal(state.text("s1", { committed: true }), "Original one.");
  assert.equal(state.committed.size, 0);
  assert.equal(state.undoStack.length, 0);
  state.preview("clinical");
  assert.equal(state.text("s3"), "Clinical s3.");
  state.preview(null);
  assert.equal(state.text("s3"), "Warm s3.");
  state.discardPreview();
  assert.equal(state.text("s1"), "Original one.");
});

test("frame is a hard boundary, aperture expands every preview, and overrides are deterministic", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  assert.deepEqual(state.includedIds(), ["s1", "s3"]);
  state.setAperture(100);
  assert.deepEqual(state.includedIds(), ["s1", "s3", "s4", "s5"]);
  assert.equal(state.text("s5"), "Warm s5.");
  assert.equal(state.toggleMembership("s3"), true);
  assert.equal(state.inFocus("s3"), false);
  state.setAperture(20);
  state.setAperture(100);
  assert.equal(state.inFocus("s3"), false);
  state.toggleMembership("s2");
  assert.equal(state.inFocus("s2"), true);
  state.setFrame("paragraph");
  assert.deepEqual(state.includedIds(), ["s1", "s2"]);
  assert.equal(state.inFrame("s4"), false, "paragraph ids in other sections cannot leak into the frame");
  assert.equal(state.toggleMembership("s4"), false);
  assert.equal(state.toggleMembership("s1"), false);
  state.setFrame("sentence");
  assert.deepEqual(state.includedIds(), ["s1"]);
  state.setFrame("section");
  assert.deepEqual(state.includedIds(), ["s1", "s2"]);
  state.resetMembership();
  assert.deepEqual(state.includedIds(), ["s1", "s3"]);
  assert.match(state.reason("s1"), /Focal/);
  assert.match(state.reason("s2"), /Different issue category/);
  assert.match(state.reason("s3"), /within semantic depth/);
  assert.match(state.reason("s4"), /Outside/);
});

test("rack focus keeps a selected treatment but clears hover and manual overrides", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  state.preview("clinical");
  state.toggleMembership("s2");
  state.focus("s4", { preserveIntent: true });
  assert.equal(state.draftTone, "warm");
  assert.equal(state.hoverTone, null);
  assert.equal(state.manualInclude.size, 0);
  assert.equal(state.focusIssue, "absolute");
  assert.equal(state.text("s4"), "Warm s4.");
  state.focus("s2");
  assert.equal(state.focusIssue, "scope");
  assert.deepEqual(state.includedIds(), ["s2"]);
  state.setIntent("absolute");
  assert.deepEqual(state.includedIds(), ["s1", "s2", "s3"]);
});

test("capture saves exactly the text on screen, immutable history, and no redundant capture", () => {
  const state = camera();
  state.focus("s1");
  state.setAperture(100);
  state.toggleMembership("s3");
  state.setTone("warm");
  state.preview("clinical");
  const shown = Object.fromEntries(state.sentences.map(sentence => [sentence.id, state.text(sentence.id)]));
  const capture = state.capture();
  assert.equal(capture.id, "01");
  assert.equal(capture.tone, "clinical");
  assert.deepEqual(capture.includedIds, ["s1", "s4", "s5"]);
  assert.deepEqual(capture.excludedIds, ["s2", "s3"]);
  assert.deepEqual(capture.changes.map(change => change.id), ["s1", "s4", "s5"]);
  for (const sentence of state.sentences) assert.equal(state.text(sentence.id), shown[sentence.id]);
  assert.equal(capture.changes[0].before, "Original one.");
  assert.equal(capture.changes[0].after, "Clinical s1.");
  assert.equal(state.draftTone, null);
  assert.equal(state.hoverTone, null);
  assert.throws(() => { capture.changes[0].before = "corrupted"; }, TypeError);
  state.setTone("clinical");
  assert.equal(state.capture(), null);
  assert.equal(state.captures.length, 1);
  assert.equal(state.undoStack.length, 1);
});

test("capture changes only actual text differences including return to original treatment", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("balanced");
  assert.equal(state.capture(), null);
  state.setFrame("sentence");
  state.setTone("warm");
  state.capture();
  state.setFrame("document");
  state.setTone("balanced");
  assert.deepEqual(state.pendingIds(), ["s1"]);
  const capture = state.capture();
  assert.deepEqual(capture.includedIds, ["s1", "s3"]);
  assert.equal(capture.changes.length, 1);
  assert.equal(capture.changes[0].beforeTone, "warm");
  assert.equal(capture.changes[0].after, "Original one.");
});

test("undo and redo restore entire committed state repeatedly and clear live previews", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  state.capture();
  state.setFrame("sentence");
  state.setTone("clinical");
  state.capture();
  for (let repeat = 0; repeat < 3; repeat++) {
    state.preview("warm");
    assert.ok(state.undo());
    assert.equal(state.text("s1"), "Warm s1.");
    assert.equal(state.text("s3"), "Warm s3.");
    assert.ok(state.undo());
    assert.equal(state.text("s1"), "Original one.");
    assert.equal(state.text("s3"), "Original three.");
    assert.equal(state.undo(), null);
    assert.ok(state.redo());
    assert.equal(state.text("s1"), "Warm s1.");
    state.setTone("warm");
    assert.ok(state.redo());
    assert.equal(state.text("s1"), "Clinical s1.");
    assert.equal(state.redo(), null);
  }
  state.undo();
  state.focus("s2");
  state.setTone("clinical");
  state.capture();
  assert.equal(state.redo(), null, "a new committed edit starts a new history branch");
  assert.equal(state.captures.length, 3, "capture snapshots survive undo and branching");
});

test("selective review protects later edits and is undoable", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  const first = state.capture();
  state.setFrame("sentence");
  state.setTone("clinical");
  const second = state.capture();
  assert.equal(state.changeStatus(first.id, "s1"), "superseded");
  assert.equal(state.revertChange(first.id, "s1"), false);
  assert.equal(state.text("s1"), "Clinical s1.");
  assert.equal(state.changeStatus(first.id, "s3"), "applied");
  assert.equal(state.revertChange(first.id, "s3"), true);
  assert.equal(state.text("s3"), "Original three.");
  assert.equal(state.changeStatus(first.id, "s3"), "reverted");
  assert.equal(state.text("s1"), "Clinical s1.");
  assert.equal(state.revertChange(first.id, "s3"), false);
  state.undo();
  assert.equal(state.text("s3"), "Warm s3.");
  assert.equal(state.revertChange(second.id, "s1"), true);
  assert.equal(state.text("s1"), "Warm s1.");
  assert.equal(state.changeStatus(first.id, "s1"), "applied");
  assert.equal(state.changeStatus(second.id, "s1"), "reverted");
});

test("restoring a capture affects its changed sentences and preserves unrelated later work", () => {
  const state = camera();
  state.focus("s1");
  state.setFrame("sentence");
  state.setTone("warm");
  const first = state.capture();
  state.focus("s2");
  state.setTone("clinical");
  state.capture();
  state.focus("s1");
  state.setTone("clinical");
  state.capture();
  assert.ok(state.restoreCapture(first.id));
  assert.equal(state.text("s1"), "Warm s1.");
  assert.equal(state.text("s2"), "Clinical s2.");
  assert.equal(state.restoreCapture(first.id), null);
  state.undo();
  assert.equal(state.text("s1"), "Clinical s1.");
  assert.equal(state.text("s2"), "Clinical s2.");
  state.redo();
  assert.equal(state.text("s1"), "Warm s1.");
});

test("color changes presentation without altering membership, text, or committed history", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  const texts = state.sentences.map(sentence => state.text(sentence.id));
  const included = state.includedIds();
  state.color = false;
  assert.deepEqual(state.sentences.map(sentence => state.text(sentence.id)), texts);
  assert.deepEqual(state.includedIds(), included);
  assert.equal(state.committed.size, 0);
  state.capture();
  const saved = [...state.committed];
  state.color = true;
  assert.deepEqual([...state.committed], saved);
  assert.deepEqual(state.sentences.map(sentence => state.text(sentence.id)), texts);
});

test("session round-trip preserves historical text and undo/redo without carrying preview", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  const capture = state.capture();
  state.revertChange(capture.id, "s3");
  state.undo();
  state.setTone("clinical");
  state.preview("balanced");
  const session = JSON.parse(JSON.stringify(state.exportSession()));
  const restored = camera();
  assert.equal(restored.restoreSession(session), true);
  assert.equal(restored.draftTone, null);
  assert.equal(restored.hoverTone, null);
  assert.equal(restored.text("s1"), "Warm s1.");
  assert.equal(restored.captures[0].changes[0].before, "Original one.");
  restored.redo();
  assert.equal(restored.text("s3"), "Original three.");
  restored.undo();
  restored.undo();
  assert.equal(restored.text("s1"), "Original one.");
  session.captures[0].changes[0].before = "mutated outside the engine";
  assert.equal(restored.captures[0].changes[0].before, "Original one.");
});

test("malformed persistence is rejected atomically, including incompatible document and damaged history", () => {
  const state = camera();
  state.focus("s1");
  state.setTone("warm");
  state.capture();
  const stable = state.exportSession();
  const corruptions = [
    session => { session.version = 2; },
    session => { session.committed = [["s1", "unknown"]]; },
    session => { session.focusId = "missing"; },
    session => { session.manualExclude = ["s1"]; },
    session => { session.aperture = -1; },
    session => { session.document[0].text = "Different document"; },
    session => { session.captures[0].changes[0].after = "Corrupt text"; },
    session => { session.undoStack[0].after = []; },
    session => { session.captures[0].changes = [null]; }
  ];
  for (const corrupt of corruptions) {
    const malformed = JSON.parse(JSON.stringify(stable));
    corrupt(malformed);
    assert.equal(state.restoreSession(malformed), false);
    assert.deepEqual(state.exportSession(), stable);
  }
  assert.equal(state.restoreSession(null), false);
  assert.equal(state.restoreSession({}), false);
});
