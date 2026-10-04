"use strict";

const sentences = model.sections.flatMap(section => section.paragraphs.flatMap((paragraph, index) =>
  paragraph.map(sentence => ({
    ...sentence,
    sectionId: section.id,
    sectionTitle: section.title,
    paragraphId: `${section.id}-${index}`,
    paragraphIndex: index
  }))));
const camera = new SemanticCamera({ sentences, toneVariants });
const $ = id => document.getElementById(id);
const editor = $("editor");
const baseLayer = $("baseLayer");
const focusMap = $("focusMap");
const mapViewport = $("mapViewport");
const toneOrder = Object.keys(toneTreatments);
const frameOptions = ["sentence", "paragraph", "section", "document"];
const semanticFrameAngles = [-120, -40, 40, 120];
const semanticStyleAnchors = {
  clinical: { tone: 20, warmth: 20 },
  restrained: { tone: 80, warmth: 20 },
  balanced: { tone: 50, warmth: 50 },
  warm: { tone: 20, warmth: 80 },
  expressive: { tone: 80, warmth: 80 }
};
const intentOptions = Object.keys(intentLabels);
const sessionKey = "textgraphy-camera-v4";
let panoCaptures = [];
let mode = "focus";
let editingFrame = false;
let draggingMap = false;
let apertureDrag = null;
let apertureDragged = false;
let semanticApertureDrag = null;
let semanticFrameDrag = null;
let semanticStyleDrag = null;
let semanticToneValue = 50;
let semanticWarmthValue = 50;
let focusTrail = [];
let selectedCapture = null;
let compareCapture = null;
let lastMessage = "";
let refreshQueued = false;
let storageAvailable = true;
let selectedDocumentId = null;
let semanticOpen = false;
let semanticSession = null;
let semanticReadyTimer = null;
let documentScrollTop = 0;
let semanticRecentCapture = null;
let inlineRevisionId = null;
let editingSemanticId = null;

try {
  const saved = JSON.parse(localStorage.getItem(sessionKey) || "null");
  if (saved) {
    camera.restoreSession(saved.camera);
    // Pano captures contain text only; render it through textContent below.
    const panoIds = new Set();
    panoCaptures = Array.isArray(saved.panos) ? saved.panos.filter(c => c && c.kind === "pano" &&
      typeof c.id === "string" && /^P\d+$/.test(c.id) && !panoIds.has(c.id) && !!panoIds.add(c.id) &&
      sentences.some(s => s.id === c.startId) && sentences.some(s => s.id === c.endId) &&
      typeof c.createdAt === "string" && Number.isFinite(Date.parse(c.createdAt)) &&
      typeof c.summary === "string" && Array.isArray(c.sentenceIds) && c.sentenceIds.length > 0 &&
      c.sentenceIds.every(id => sentences.some(s => s.id === id)) && Array.isArray(c.steps) &&
      c.steps.every(step => step && typeof step.label === "string" && typeof step.summary === "string")) : [];
  }
} catch { storageAvailable = false; }
camera.discardPreview();
semanticRecentCapture = [...camera.captures].reverse().find(capture =>
  capture.kind === "style" && capture.changes.some(change => camera.changeStatus(capture.id, change.id) === "applied")) || null;
document.body.classList.add("semantic-redesign", "document-space");

function saveSession() {
  try {
    localStorage.setItem(sessionKey, JSON.stringify({ camera: camera.exportSession(), panos: panoCaptures }));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  $("storageNote").textContent = storageAvailable ? "Saved in this browser. Captures keep their original wording." : "Session only: browser storage is unavailable.";
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(text, className, action) {
  const el = node("button", className, text);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}

function announce(message) {
  lastMessage = message;
  $("announcement").textContent = message;
}

function renderLayer(layer, interactive) {
  layer.replaceChildren();
  layer.append(node("h2", "article-title", model.title), node("div", "byline", model.byline));
  model.sections.forEach(section => {
    const sectionEl = node("section", "section");
    sectionEl.dataset.section = section.id;
    sectionEl.append(node("h3", "section-title", section.title));
    section.paragraphs.forEach((paragraph, index) => {
      const p = node("p", "paragraph");
      p.dataset.paragraph = `${section.id}-${index}`;
      paragraph.forEach((sentence, i) => {
        const span = node("span", "sentence", sentence.text);
        span.dataset.id = sentence.id;
        if (interactive) {
          span.tabIndex = 0;
          span.setAttribute("role", "button");
          span.addEventListener("click", event => selectSentence(sentence.id, event.shiftKey));
          span.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectSentence(sentence.id, event.shiftKey);
            }
          });
        }
        p.append(span);
        if (i < paragraph.length - 1) p.append(document.createTextNode(" "));
      });
      sectionEl.append(p);
    });
    layer.append(sectionEl);
  });
}

function apertureInfo(value = camera.aperture) {
  if (value < 34) return { stop: "f/2.8", depth: "Shallow" };
  if (value < 68) return { stop: "f/5.6", depth: "Medium" };
  return { stop: "f/11", depth: "Deep" };
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; refresh(); });
}

function refresh() {
  const isFocus = mode === "focus";
  const focused = isFocus && semanticOpen && !!camera.focusId;
  const tone = isFocus ? camera.hoverTone || camera.draftTone : null;
  const included = focused ? camera.includedIds() : [];
  const pending = focused ? camera.pendingIds() : [];
  const aperture = apertureInfo();
  document.body.classList.toggle("color-on", camera.color);
  document.body.classList.toggle("has-focus", focused);
  document.body.classList.toggle("tone-active", focused);
  document.body.classList.toggle("editing-frame", editingFrame);
  document.body.classList.toggle("pano-active", !isFocus);
  document.body.classList.toggle("document-space", !semanticOpen);
  document.body.classList.toggle("semantic-space", semanticOpen);
  const selectedSentence = sentences.find(sentence => sentence.id === selectedDocumentId);
  document.body.dataset.issue = semanticOpen ? camera.focusIssue || "none" : selectedSentence?.issue || "none";
  // The Semantic Viewfinder keeps the issue color stable. Style intensity is
  // communicated locally by the spectrum rather than categorical hue jumps.
  document.body.dataset.tone = semanticOpen ? "none" : tone || "none";
  $("spaceLabel").innerHTML = semanticOpen ? "<i></i> SEMANTIC VIEWFINDER" : "<i></i> DOCUMENT SPACE";
  $("semanticWorkspace").setAttribute("aria-hidden", String(!semanticOpen));
  editor.setAttribute("aria-hidden", String(semanticOpen));
  editor.tabIndex = semanticOpen ? -1 : 0;

  baseLayer.querySelectorAll(".sentence").forEach(el => {
    const id = el.dataset.id;
    el.className = "sentence";
    if (!semanticOpen && selectedDocumentId === id) el.classList.add("focus-candidate");
    const inFocus = included.includes(id);
    if (focused && camera.focusId === id) el.classList.add("focused");
    if (inFocus) el.classList.add("semantic", camera.score(id) >= .8 ? "near-plane" : "mid-plane");
    if (focused && !camera.inFrame(id)) el.classList.add("outside-frame");
    if (focused && camera.manualInclude.has(id)) el.classList.add("manual-include");
    if (focused && camera.manualExclude.has(id)) el.classList.add("manual-exclude");
    if ((focused && tone && inFocus) || camera.committed.has(id) || camera.committedText.has(id)) {
      el.classList.add(`tone-${camera.displayedTone(id) || "balanced"}`);
    }
    if (pending.includes(id)) el.classList.add("previewing");
    if (recentAppliedChange(id)) el.classList.add("recently-applied");
    const text = isFocus && semanticOpen ? camera.text(id) : camera.text(id, { committed: true });
    if (el.textContent !== text) el.textContent = text;
    const action = !semanticOpen && isFocus ? "Select for focus" : editingFrame ? "Toggle inclusion" : !isFocus ? "Set panorama endpoint" : "Set focus";
    el.setAttribute("aria-label", `${id.toUpperCase()}: ${text}. ${action}.`);
    el.setAttribute("aria-pressed", String(focused && (editingFrame ? inFocus : camera.focusId === id)));
    el.title = focused ? `${id.toUpperCase()} · ${camera.reason(id)}` : `${id.toUpperCase()} · ${action}`;
  });
  renderInlineRevision();
  updateRevisionPrompt();

  $("intentValue").textContent = camera.focusIssue ? intentLabels[camera.focusIssue] : "Choose";
  $("intentDial").disabled = !focused;
  $("intentDial").style.setProperty("--dial-rotation", `${-95 + Math.max(0, intentOptions.indexOf(camera.focusIssue)) * 95}deg`);
  $("frameValue").textContent = camera.frame[0].toUpperCase() + camera.frame.slice(1);
  $("frameDial").style.setProperty("--dial-rotation", `${-120 + frameOptions.indexOf(camera.frame) * 80}deg`);
  $("frameDial").disabled = !isFocus;
  $("depthValue").textContent = `${aperture.stop} · ${aperture.depth}`;
  $("apertureDial").style.setProperty("--dial-rotation", `${-125 + camera.aperture * 2.5}deg`);
  $("apertureDial").disabled = !isFocus || camera.frame === "sentence";
  $("apertureDial").setAttribute("aria-label", `Semantic aperture: ${aperture.depth}. Drag the dial, scroll over it, or use arrow keys to adjust.`);
  $("focusValue").textContent = focused ? camera.focusId.toUpperCase() : "—";
  $("focusCount").textContent = String(included.length);
  $("toneValue").textContent = tone ? toneTreatments[tone].label.toUpperCase() : "—";
  $("colorToggle").setAttribute("aria-pressed", String(camera.color));
  $("colorModeValue").textContent = camera.color ? "Color" : "Mono";
  $("colorHudValue").textContent = camera.color ? "COLOR" : "MONO";
  $("semanticColorToggle").setAttribute("aria-pressed", String(camera.color));
  $("semanticColorState").textContent = camera.color ? "Color cues on" : "Color cues off";
  $("hudLabel").textContent = isFocus ? "FOCAL INTENT" : "PANORAMA · FOLLOW THE ARGUMENT";
  $("issueTitle").textContent = focused ? `${issueLabels[camera.focusIssue]} · ${camera.frame} frame` : isFocus ? "Select a sentence to focus" : "Scroll through the manuscript to build a panorama";
  $("focusTools").classList.toggle("hidden", !focused);
  $("toneStrip").classList.toggle("hidden", !focused);
  $("frameTray").classList.toggle("hidden", !focused || !editingFrame);
  $("editFrame").setAttribute("aria-pressed", String(editingFrame));
  $("editFrame").textContent = editingFrame ? "Done adjusting" : `Adjust selection · ${included.length}`;
  $("backFocus").classList.toggle("hidden", !focusTrail.length);
  if (focusTrail.length) $("backFocus").textContent = `← ${focusTrail.at(-1).toUpperCase()}`;
  document.querySelectorAll("[data-intent]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.intent === camera.focusIssue)));
  document.querySelectorAll(".tone-option").forEach(el => {
    el.classList.toggle("active", el.dataset.tone === tone);
    el.setAttribute("aria-pressed", String(el.dataset.tone === camera.draftTone));
  });
  $("tonePreviewValue").textContent = tone ? `${toneTreatments[tone].label} · ${included.length} sentences` : "Choose a treatment";
  $("previewHint").textContent = camera.hoverTone ? "Temporary preview · click to keep exploring" : tone ? "Preview selected · shutter applies it" : "Hover to preview · click to select";
  $("discardPreview").classList.toggle("hidden", !focused || !tone);
  $("shutter").disabled = isFocus && !pending.length;
  $("shutter").setAttribute("aria-label", isFocus ? `Apply preview to ${pending.length} sentences and capture` : "Capture panorama");
  $("exposureState").textContent = !isFocus ? "PANO" : pending.length ? "PREVIEW" : lastMessage ? "SAVED" : "READY";
  $("exposureSummary").textContent = !isFocus ? "Scroll to extend the range. Shutter saves this summary to Film." : pending.length
    ? `${toneTreatments[tone].label} → ${pending.map(id => id.toUpperCase()).join(", ")} · ${pending.length} changes on shutter`
    : lastMessage || (focused ? "Choose a tone to preview the sentences in this frame." : "Focus a sentence, choose a tone, then press the shutter.");
  $("undoBtn").disabled = !camera.undoStack.length;
  $("redoBtn").disabled = !camera.redoStack.length;
  $("filmCount").textContent = String(camera.captures.length + panoCaptures.length).padStart(2, "0");
  $("reviewBtn").classList.toggle("hidden", !camera.captures.length || !!tone || !isFocus);
  $("focusModeBtn").setAttribute("aria-pressed", String(isFocus));
  $("panoModeBtn").setAttribute("aria-pressed", String(!isFocus));
  $("focusModeBtn").classList.toggle("active", isFocus);
  $("panoModeBtn").classList.toggle("active", !isFocus);
  renderMap();
  if (editingFrame) refreshMembers();
  if (!isFocus) pano.refresh();
}

function selectSentence(id, manual = false) {
  if (mode === "pano") { pano.selectEnd(id); return; }
  if (!semanticOpen && !manual && !editingFrame) { selectDocumentFocus(id); return; }
  if (semanticOpen && !manual && !editingFrame) return;
  if ((manual || editingFrame) && camera.focusId) {
    if (id === camera.focusId) announce("The focal sentence stays in the frame.");
    else if (!camera.inFrame(id)) announce("This sentence is outside the frame. Widen Frame to include it.");
    else { camera.toggleMembership(id); announce(`${id.toUpperCase()} · ${camera.reason(id)}`); }
  } else {
    if (camera.focusId && camera.focusId !== id) focusTrail.push(camera.focusId);
    camera.focus(id, { preserveIntent: !!camera.focusId });
    announce(`Focused ${id.toUpperCase()}. Following ${issueLabels[camera.focusIssue].toLowerCase()}.`);
    lastMessage = "";
  }
  refresh();
}

function sentenceLocation(sentence) {
  return `${sentence.sectionTitle} · Paragraph ${sentence.paragraphIndex + 1} · ${sentence.id.toUpperCase()}`;
}

function updateFocusPrompt() {
  const sentence = sentences.find(item => item.id === selectedDocumentId);
  $("focusPrompt").classList.toggle("hidden", !sentence || semanticOpen);
  updateRevisionPrompt();
  if (!sentence) return;
  $("focusPromptText").textContent = camera.text(sentence.id, { committed: true });
  $("focusPromptTitle").textContent = issueLabels[sentence.issue];
}

function selectDocumentFocus(id, { announceSelection = true } = {}) {
  const sentence = sentences.find(item => item.id === id);
  if (!sentence) return;
  if (inlineRevisionId !== id) inlineRevisionId = null;
  selectedDocumentId = id;
  updateFocusPrompt();
  refresh();
  if (announceSelection) announce(`${id.toUpperCase()} selected. Press Focus to gather related passages.`);
}

function clearDocumentFocus({ restoreFocus = true } = {}) {
  selectedDocumentId = null;
  updateFocusPrompt();
  refresh();
  if (restoreFocus) editor.focus();
}

function semanticCandidates(focusId) {
  const focus = sentences.find(sentence => sentence.id === focusId);
  if (!focus) return [];
  const related = sentences
    .filter(sentence => sentence.issue === focus.issue && sentence.id !== focusId)
    .map(sentence => sentence.id);
  return [focusId, ...related];
}

function styleTokens(text) {
  return text.match(/\S+\s*/g) || [];
}

function styleTokenKey(token) {
  return token.trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function appendStyleDiff(container, currentText, originalText) {
  const current = styleTokens(currentText);
  const original = styleTokens(originalText);
  const currentKeys = current.map(styleTokenKey);
  const originalKeys = original.map(styleTokenKey);
  const matrix = Array.from({ length: original.length + 1 }, () => Array(current.length + 1).fill(0));

  for (let i = original.length - 1; i >= 0; i -= 1) {
    for (let j = current.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = originalKeys[i] && originalKeys[i] === currentKeys[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const retained = new Set();
  let i = 0;
  let j = 0;
  while (i < original.length && j < current.length) {
    if (originalKeys[i] && originalKeys[i] === currentKeys[j]) {
      retained.add(j);
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) i += 1;
    else j += 1;
  }

  current.forEach((token, index) => {
    if (retained.has(index)) container.append(document.createTextNode(token));
    else container.append(node("mark", "style-change", token));
  });
}

function recentAppliedChange(id) {
  for (let index = camera.captures.length - 1; index >= 0; index -= 1) {
    const capture = camera.captures[index];
    const change = capture.changes.find(item => item.id === id);
    if (change && camera.changeStatus(capture.id, id) === "applied") return { ...change, captureId: capture.id };
  }
  return null;
}

function focusDocumentSentence(id) {
  requestAnimationFrame(() => baseLayer.querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true }));
}

function renderInlineRevision() {
  baseLayer.querySelectorAll(".inline-revision-panel").forEach(panel => panel.remove());
  if (semanticOpen || !inlineRevisionId) return;
  const change = recentAppliedChange(inlineRevisionId);
  const target = baseLayer.querySelector(`[data-id="${inlineRevisionId}"]`);
  if (!change || !target) {
    inlineRevisionId = null;
    return;
  }

  const panel = node("span", "inline-revision-panel");
  panel.tabIndex = -1;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `${inlineRevisionId.toUpperCase()} revision comparison`);
  const head = node("span", "inline-revision-head");
  head.append(node("b", "", "RECENT CHANGE"), node("small", "", "Compare in place"));

  const beforeRow = node("span", "inline-revision-row before");
  beforeRow.append(node("b", "", "BEFORE"), node("span", "inline-revision-text", change.before));
  const currentRow = node("span", "inline-revision-row current");
  currentRow.append(node("b", "", "CURRENT"));
  const currentText = node("span", "inline-revision-text");
  appendStyleDiff(currentText, change.after, change.before);
  currentRow.append(currentText);

  panel.append(head, beforeRow, currentRow);
  target.after(panel);
}

function toggleInlineRevision(id = selectedDocumentId) {
  if (!id || !recentAppliedChange(id)) return false;
  inlineRevisionId = inlineRevisionId === id ? null : id;
  refresh();
  if (inlineRevisionId) {
    requestAnimationFrame(() => baseLayer.querySelector(".inline-revision-panel")?.focus({ preventScroll: true }));
    announce(`${id.toUpperCase()} comparison opened. Review the previous and current wording.`);
  }
  return true;
}

function updateRevisionPrompt() {
  const change = selectedDocumentId ? recentAppliedChange(selectedDocumentId) : null;
  const visible = !semanticOpen && !!change;
  $("revisionPrompt").classList.toggle("hidden", !visible);
  if (!visible) return;
  $("compareRevision").textContent = inlineRevisionId === selectedDocumentId ? "Close comparison" : "Compare";
  $("revisionPromptNote").textContent = `${selectedDocumentId.toUpperCase()} has a saved revision. Restore remains available.`;
}

function restoreSelectedRevision() {
  const id = selectedDocumentId;
  const change = id ? recentAppliedChange(id) : null;
  if (!change || !camera.revertChange(change.captureId, id)) return;
  inlineRevisionId = null;
  if (semanticRecentCapture?.id === change.captureId &&
      !semanticRecentCapture.changes.some(item => camera.changeStatus(semanticRecentCapture.id, item.id) === "applied")) {
    semanticRecentCapture = null;
  }
  refresh();
  updateFocusPrompt();
  saveSession();
  focusDocumentSentence(id);
  announce(`${id.toUpperCase()} restored to its previous wording. Undo is available.`);
}

function updateSemanticCardStyle(card, id, isIncluded) {
  const quote = card.querySelector(".semantic-quote");
  const committedText = camera.text(id, { committed: true });
  const previewText = camera.text(id);
  const recentChange = semanticRecentCapture?.changes.find(change => change.id === id);
  const hasManualDraft = isIncluded && camera.hasManualDraft(id);
  const hasPreview = isIncluded && (!!camera.draftTone || hasManualDraft) && previewText !== committedText;
  const wasJustApplied = !hasPreview && !!recentChange && committedText === recentChange.after;
  card.classList.toggle("is-style-preview", hasPreview);
  card.classList.toggle("is-manual-preview", hasManualDraft);
  card.classList.toggle("is-recently-applied", wasJustApplied);

  let previewBadge = card.querySelector(".semantic-style-state");
  if (hasPreview && !previewBadge) {
    previewBadge = node("span", "semantic-style-state", hasManualDraft ? "MANUAL EDIT" : "STYLE PREVIEW");
    card.querySelector(".semantic-badges")?.append(previewBadge);
  } else if (wasJustApplied && !previewBadge) {
    previewBadge = node("span", "semantic-style-state", "UPDATED");
    card.querySelector(".semantic-badges")?.append(previewBadge);
  } else if (previewBadge) {
    if (hasPreview) previewBadge.textContent = hasManualDraft ? "MANUAL EDIT" : "STYLE PREVIEW";
    else if (wasJustApplied) previewBadge.textContent = "UPDATED";
    else previewBadge.remove();
  }

  const inlineEditor = quote.querySelector(".semantic-inline-editor");
  if (inlineEditor && editingSemanticId === id) {
    if (!hasManualDraft && inlineEditor.value !== previewText) inlineEditor.value = previewText;
    return;
  }

  quote.replaceChildren();
  if (hasPreview) appendStyleDiff(quote, previewText, committedText);
  else if (wasJustApplied) appendStyleDiff(quote, committedText, recentChange.before);
  else quote.textContent = committedText;
}

function focusSemanticEditor(id) {
  requestAnimationFrame(() => {
    const editor = $("semanticCards").querySelector(`.semantic-card[data-id="${id}"] .semantic-inline-editor`);
    editor?.focus({ preventScroll: true });
    editor?.setSelectionRange(editor.value.length, editor.value.length);
  });
}

function renderSemanticInlineEditor(card, id) {
  const quote = card.querySelector(".semantic-quote");
  const editor = node("textarea", "semantic-inline-editor");
  editor.rows = 3;
  editor.value = camera.text(id);
  editor.setAttribute("aria-label", `Edit ${id.toUpperCase()} wording`);
  editor.addEventListener("input", () => {
    camera.setManualDraft(id, editor.value);
    card.classList.add("is-style-preview", "is-manual-preview");
    let badge = card.querySelector(".semantic-style-state");
    if (!badge) {
      badge = node("span", "semantic-style-state", "MANUAL EDIT");
      card.querySelector(".semantic-badges")?.append(badge);
    } else badge.textContent = "MANUAL EDIT";
    updateSemanticCommitActions();
    $("semanticStatus").innerHTML = `<i></i> ${semanticPendingIds().length} manual or style changes ready · Preview`;
  });
  editor.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.stopPropagation();
      editingSemanticId = null;
      renderSemanticCards();
      updateSemanticCommitActions();
      requestAnimationFrame(() => $("semanticCards").querySelector(`[data-id="${id}"] .semantic-quote`)?.focus({ preventScroll: true }));
    }
  });

  const actions = node("span", "semantic-edit-actions");
  actions.append(
    button("Use style suggestion", "semantic-edit-secondary", () => {
      camera.clearManualDraft(id);
      renderSemanticCards();
      updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
      focusSemanticEditor(id);
      announce(`${id.toUpperCase()} returned to the current Style suggestion.`);
    }),
    button("Restore original", "semantic-edit-secondary", () => {
      camera.setManualDraft(id, sentences.find(sentence => sentence.id === id).text);
      renderSemanticCards();
      updateSemanticCommitActions();
      focusSemanticEditor(id);
      announce(`${id.toUpperCase()} restored to its source wording in the preview.`);
    }),
    button("Done", "semantic-edit-done", () => {
      editingSemanticId = null;
      renderSemanticCards();
      updateSemanticCommitActions();
      requestAnimationFrame(() => $("semanticCards").querySelector(`[data-id="${id}"] .semantic-quote`)?.focus({ preventScroll: true }));
    })
  );
  quote.classList.add("is-editing");
  quote.removeAttribute("role");
  quote.removeAttribute("aria-label");
  quote.tabIndex = -1;
  quote.replaceChildren(editor, actions);
}

function beginSemanticEdit(id) {
  if (!semanticSession?.framedIds.includes(id)) return;
  if (!camera.inFocus(id)) camera.toggleMembership(id);
  semanticSession.includedIds = semanticIncludedIds();
  editingSemanticId = id;
  renderSemanticCards();
  updateSemanticAperture({ animate: false });
  focusSemanticEditor(id);
  announce(`${id.toUpperCase()} is ready for direct editing. Your wording will be kept when Style moves.`);
}

function renderSemanticCards() {
  const cards = $("semanticCards");
  cards.replaceChildren();
  if (!semanticSession) return;
  const included = new Set(semanticSession.includedIds);

  semanticSession.framedIds.forEach((id, index) => {
    const sentence = sentences.find(item => item.id === id);
    const isSubject = id === semanticSession.focusId;
    const isIncluded = included.has(id);
    const card = node("article", `semantic-card${isSubject ? " is-subject" : ""}${isIncluded ? " is-in-focus" : " is-outside-focus"}`);
    card.dataset.id = id;
    card.style.setProperty("--card-order", index);
    card.setAttribute("aria-label", `${isSubject ? "Focus subject" : "Related passage"}. ${isIncluded ? "In focus" : "Outside focus"}. ${sentenceLocation(sentence)}.`);

    const head = node("header", "semantic-card-head");
    const badges = node("div", "semantic-badges");
    badges.append(node("span", `semantic-role${isSubject ? " subject" : ""}`, isSubject ? "FOCUS SUBJECT" : "RELATED"));
    const applyChoice = node("label", "semantic-apply-choice");
    const applyCheckbox = node("input", "semantic-apply-checkbox");
    applyCheckbox.type = "checkbox";
    applyCheckbox.checked = isIncluded;
    applyCheckbox.setAttribute("aria-label", `${isIncluded ? "Leave unchanged" : "Apply change to"} ${id.toUpperCase()}`);
    applyCheckbox.addEventListener("change", event => {
      event.stopPropagation();
      camera.toggleMembership(id);
      updateSemanticAperture();
      saveSession();
      announce(`${id.toUpperCase()} will ${camera.inFocus(id) ? "receive the style change" : "remain unchanged"}.`);
    });
    applyChoice.append(applyCheckbox, node("span", "semantic-focus-state", isIncluded ? "APPLY CHANGE" : "LEAVE UNCHANGED"));
    badges.append(applyChoice);
    head.append(
      badges,
      node("span", "semantic-source", sentenceLocation(sentence))
    );
    const quote = node("blockquote", "semantic-quote");
    quote.tabIndex = 0;
    quote.setAttribute("role", "button");
    quote.setAttribute("aria-label", `Edit ${id.toUpperCase()} wording directly`);
    quote.addEventListener("click", event => {
      if (event.target.closest("textarea, button")) return;
      beginSemanticEdit(id);
    });
    quote.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("textarea")) {
        event.preventDefault();
        beginSemanticEdit(id);
      }
    });
    const foot = node("footer", "semantic-card-foot");
    foot.append(
      node("span", "semantic-reason", isSubject ? "The passage you chose as the reference." : `Same concern: ${issueLabels[sentence.issue]}.`),
      button("View in document", "semantic-locate", () => exitSemanticViewfinder({ locateId: id }))
    );
    card.append(head, quote, foot);
    updateSemanticCardStyle(card, id, isIncluded);
    if (editingSemanticId === id) renderSemanticInlineEditor(card, id);
    cards.append(card);
  });
}

function apertureLabel(value) {
  if (value < 34) return "Tight";
  if (value < 68) return "Balanced";
  return "Wide";
}

function semanticIncludedIds() {
  if (!semanticSession) return [];
  return semanticSession.framedIds.filter(id => camera.inFocus(id));
}

function updateSemanticAperture({ animate = true } = {}) {
  if (!semanticSession) return;
  const previous = new Set(semanticSession.includedIds);
  semanticSession.includedIds = semanticIncludedIds();
  const included = new Set(semanticSession.includedIds);
  const dial = $("semanticAperture");
  const total = semanticSession.framedIds.length;
  const count = included.size;
  dial.style.setProperty("--aperture-rotation", `${-130 + camera.aperture * 2.6}deg`);
  dial.setAttribute("aria-valuenow", String(Math.round(camera.aperture)));
  dial.setAttribute("aria-valuetext", `${apertureLabel(camera.aperture)} aperture. ${count} of ${total} passages in focus.`);
  $("semanticApertureMode").textContent = apertureLabel(camera.aperture).toUpperCase();
  $("semanticApertureStatus").textContent = `${apertureLabel(camera.aperture)} · ${count} / ${total} passages in focus`;

  $("semanticCards").querySelectorAll(".semantic-card").forEach(card => {
    const id = card.dataset.id;
    const isSubject = id === semanticSession.focusId;
    const isIncluded = included.has(id);
    const changed = previous.has(id) !== isIncluded;
    card.classList.toggle("is-in-focus", isIncluded);
    card.classList.toggle("is-outside-focus", !isIncluded);
    const checkbox = card.querySelector(".semantic-apply-checkbox");
    if (checkbox) {
      checkbox.checked = isIncluded;
      checkbox.setAttribute("aria-label", `${isIncluded ? "Leave unchanged" : "Apply change to"} ${id.toUpperCase()}`);
    }
    card.querySelector(".semantic-focus-state")?.replaceChildren(isIncluded ? "APPLY CHANGE" : "LEAVE UNCHANGED");
    updateSemanticCardStyle(card, id, isIncluded);
    const sentence = sentences.find(item => item.id === id);
    card.setAttribute("aria-label", `${isSubject ? "Focus subject" : "Related passage"}. ${isIncluded ? "In focus" : "Outside focus"}. ${sentenceLocation(sentence)}.`);
    if (animate && changed && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.animate(isIncluded ? [
        { transform: "scale(.985)", boxShadow: "0 0 0 rgba(var(--accent-rgb), 0)" },
        { transform: "scale(1.008)", boxShadow: "0 0 24px rgba(var(--accent-rgb), .18)", offset: .55 },
        { transform: "scale(1)", boxShadow: "0 7px 20px rgba(0,0,0,.22)" }
      ] : [
        { transform: "scale(1)" },
        { transform: "scale(.992)" }
      ], { duration: 320, easing: "ease-out" });
    }
  });

  updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });

  if (semanticSession.ready && !camera.draftTone && !semanticRecentCapture) {
    $("semanticStatus").innerHTML = `<i></i> ${count} of ${total} passages in focus · ${camera.frame} frame · Review only`;
  }
}

function styleToneForPosition(toneValue, warmthValue) {
  return Object.entries(semanticStyleAnchors).reduce((nearest, [tone, point]) => {
    const distance = Math.hypot(toneValue - point.tone, warmthValue - point.warmth);
    return !nearest || distance < nearest.distance ? { tone, distance } : nearest;
  }, null).tone;
}

function stylePositionForTone(tone) {
  return semanticStyleAnchors[tone] || semanticStyleAnchors.balanced;
}

function styleDimensionLabel(value, low, middle, high) {
  if (value < 34) return low;
  if (value > 66) return high;
  return middle;
}

function mixStyleChannels(from, to, amount) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

function mixStyleColor(from, to, amount) {
  const mixed = mixStyleChannels(from, to, amount);
  return `rgb(${mixed[0]} ${mixed[1]} ${mixed[2]})`;
}

function semanticPendingIds() {
  if (!semanticSession) return [];
  const candidates = new Set(semanticSession.framedIds);
  return camera.pendingIds().filter(id => candidates.has(id));
}

function clearSemanticAppliedState() {
  semanticRecentCapture = null;
  inlineRevisionId = null;
  $("semanticUndoBar").classList.add("hidden");
}

function updateSemanticCommitActions() {
  const pendingIds = semanticPendingIds();
  const hasPending = semanticOpen && pendingIds.length > 0;
  const canUndoRecent = semanticOpen && !hasPending && !!semanticRecentCapture &&
    camera.undoStack.at(-1)?.kind === "capture" && camera.undoStack.at(-1)?.captureId === semanticRecentCapture.id;
  $("semanticCommitBar").classList.toggle("hidden", !hasPending);
  $("semanticUndoBar").classList.toggle("hidden", !canUndoRecent);
  $("semanticCommitNote").textContent = `Document not changed yet · ${pendingIds.length} passage${pendingIds.length === 1 ? "" : "s"}`;
  $("semanticApplyPreview").textContent = `Apply ${pendingIds.length} change${pendingIds.length === 1 ? "" : "s"}`;
  if (semanticRecentCapture) {
    const count = semanticRecentCapture.changes.length;
    $("semanticUndoNote").textContent = `${count} passage${count === 1 ? "" : "s"} updated`;
  }
  $("semanticSafetyState").textContent = hasPending
    ? "PREVIEW · DOCUMENT NOT CHANGED"
    : canUndoRecent ? "APPLIED · UNDO AVAILABLE" : "REVIEW ONLY · NO TEXT MODIFIED";
}

function updateSemanticStyle(toneValue, warmthValue, { selectTone = true, announceChange = false } = {}) {
  semanticToneValue = Math.max(0, Math.min(100, Number(toneValue) || 0));
  semanticWarmthValue = Math.max(0, Math.min(100, Number(warmthValue) || 0));
  const tone = styleToneForPosition(semanticToneValue, semanticWarmthValue);
  const previousTone = camera.draftTone;
  if (selectTone && semanticRecentCapture) clearSemanticAppliedState();
  if (selectTone) camera.setTone(tone);

  const workspace = $("semanticWorkspace");
  const cursor = $("semanticStyleCursor");
  const assertiveness = semanticToneValue / 100;
  const warmth = semanticWarmthValue / 100;
  const detachedColor = mixStyleChannels([169, 184, 190], [59, 94, 114], assertiveness);
  const approachableColor = mixStyleChannels([232, 176, 154], [239, 103, 72], assertiveness);
  const cueColor = mixStyleColor(detachedColor, approachableColor, warmth);
  workspace.style.setProperty("--style-x", `${semanticToneValue}%`);
  workspace.style.setProperty("--style-y", `${100 - semanticWarmthValue}%`);
  workspace.style.setProperty("--style-cue-color", cueColor);
  cursor.style.left = `${semanticToneValue}%`;
  cursor.style.top = `${100 - semanticWarmthValue}%`;

  const toneLabel = styleDimensionLabel(semanticToneValue, "Qualified", "Balanced", "Assertive");
  const warmthLabel = styleDimensionLabel(semanticWarmthValue, "Detached", "Neutral", "Approachable");
  const previewCount = semanticSession?.includedIds.length || 0;
  cursor.setAttribute("aria-label", `${toneLabel} tone. ${warmthLabel} warmth. Use arrow keys to adjust.`);
  $("semanticStyleStatus").textContent = camera.draftTone
    ? `${toneLabel} tone · ${warmthLabel} warmth · ${previewCount} passages`
    : camera.manualDrafts.size
      ? `${camera.manualDrafts.size} manual edit${camera.manualDrafts.size === 1 ? "" : "s"} · Style movement will not overwrite them`
    : semanticRecentCapture
      ? `${toneLabel} tone · ${warmthLabel} warmth · Applied`
      : "Balanced tone · Neutral warmth · Move the point to preview";

  if (semanticSession && selectTone && previousTone !== camera.draftTone) {
    const included = new Set(semanticSession.includedIds);
    $("semanticCards").querySelectorAll(".semantic-card").forEach(card =>
      updateSemanticCardStyle(card, card.dataset.id, included.has(card.dataset.id)));
  }
  if (semanticSession?.ready && (camera.draftTone || camera.manualDrafts.size)) {
    $("semanticStatus").innerHTML = `<i></i> ${previewCount} passages · ${toneLabel.toLowerCase()} tone · ${warmthLabel.toLowerCase()} warmth · Preview`;
  } else if (semanticSession?.ready && semanticRecentCapture) {
    $("semanticStatus").innerHTML = `<i></i> ${semanticRecentCapture.changes.length} passages updated · Undo available`;
  }
  updateSemanticCommitActions();
  if (announceChange && semanticSession) {
    saveSession();
    announce(`${toneLabel} tone and ${warmthLabel} warmth previewed across ${previewCount} passages. No text has been changed.`);
  }
}

function updateSemanticFrame(frame, { animate = true, announceChange = true } = {}) {
  if (!semanticSession || !camera.setFrame(frame)) return;
  semanticSession.framedIds = semanticSession.candidateIds.filter(id => camera.inFrame(id));
  if (editingSemanticId && !semanticSession.framedIds.includes(editingSemanticId)) editingSemanticId = null;
  semanticSession.includedIds = semanticIncludedIds();

  const frameIndex = frameOptions.indexOf(camera.frame);
  const frameLabel = camera.frame[0].toUpperCase() + camera.frame.slice(1);
  const frameDial = $("semanticFrameDial");
  frameDial.style.setProperty("--frame-rotation", `${semanticFrameAngles[frameIndex]}deg`);
  frameDial.setAttribute("aria-valuenow", String(frameIndex));
  frameDial.setAttribute("aria-valuetext", `${frameLabel} frame. ${semanticSession.framedIds.length} of ${semanticSession.candidateIds.length} related passages in range.`);
  $("semanticFrameTitle").textContent = `${frameLabel} range`;
  $("semanticFrameMode").textContent = camera.frame.toUpperCase();
  $("semanticFrameStatus").textContent = `${semanticSession.framedIds.length} / ${semanticSession.candidateIds.length} related passages in frame`;
  renderSemanticCards();
  updateSemanticAperture({ animate: false });

  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $("semanticCards").querySelectorAll(".semantic-card").forEach((card, index) => {
      card.animate([
        { opacity: 0, transform: "translateY(12px) scale(.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ], { duration: 270, delay: index * 45, easing: "cubic-bezier(.2,.78,.2,1)" });
    });
  }
  if (announceChange) {
    saveSession();
    announce(`${camera.frame} frame. ${semanticSession.framedIds.length} related passages in range; ${semanticSession.includedIds.length} in focus.`);
  }
}

function animateSemanticGather(sourceRects, stageRect) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = [...$("semanticCards").querySelectorAll(".semantic-card")];
  if (reduceMotion || !cards.length) {
    finishSemanticGather();
    return;
  }

  cards.forEach((card, index) => {
    const source = sourceRects.get(card.dataset.id);
    const target = card.getBoundingClientRect();
    if (!source || !target.width) return;
    const sourceX = Math.max(stageRect.left + 24, Math.min(stageRect.right - 24, source.left + source.width / 2));
    const sourceY = Math.max(stageRect.top + 24, Math.min(stageRect.bottom - 24, source.top + source.height / 2));
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    card.animate([
      { transform: `translate(${sourceX - targetX}px, ${sourceY - targetY}px) scale(.32)`, opacity: 0, filter: "blur(5px)" },
      { opacity: .78, offset: .68 },
      { transform: "translate(0, 0) scale(1)", opacity: 1, filter: "blur(0)" }
    ], {
      duration: 620,
      delay: index * 95,
      easing: "cubic-bezier(.2,.78,.2,1)",
      fill: "both"
    });
  });

  window.clearTimeout(semanticReadyTimer);
  semanticReadyTimer = window.setTimeout(finishSemanticGather, 620 + cards.length * 95);
}

function finishSemanticGather() {
  if (!semanticOpen || !semanticSession) return;
  $("semanticCards").querySelectorAll(".semantic-card").forEach(card => {
    card.getAnimations().forEach(animation => animation.cancel());
  });
  semanticSession.ready = true;
  updateSemanticAperture({ animate: false });
}

function enterSemanticViewfinder() {
  const focusId = selectedDocumentId;
  if (!focusId || semanticOpen) return;
  if (semanticRecentCapture && semanticRecentCapture.focusId !== focusId) clearSemanticAppliedState();
  const focusSentence = sentences.find(sentence => sentence.id === focusId);
  const sourceRects = new Map(sentences.map(sentence => [
    sentence.id,
    baseLayer.querySelector(`[data-id="${sentence.id}"]`)?.getBoundingClientRect()
  ]));
  const stageRect = $("spaceStage").getBoundingClientRect();
  documentScrollTop = editor.scrollTop;

  camera.focus(focusId, { preserveIntent: false });
  camera.setFrame("document");
  const candidateIds = semanticCandidates(focusId);
  semanticSession = {
    focusId,
    focusConcern: focusSentence.issue,
    candidateIds,
    framedIds: candidateIds.filter(id => camera.inFrame(id)),
    includedIds: candidateIds.filter(id => camera.inFocus(id)),
    ready: false
  };
  semanticOpen = true;
  const stylePosition = stylePositionForTone(camera.draftTone || semanticRecentCapture?.tone);
  semanticToneValue = stylePosition.tone;
  semanticWarmthValue = stylePosition.warmth;
  $("focusPrompt").classList.add("hidden");
  $("semanticStatus").innerHTML = "<i></i> Gathering passages from the manuscript…";
  $("semanticSubtitle").textContent = `${issueLabels[focusSentence.issue]} · ${candidateIds.length} related passages found · Nothing in the document has been changed.`;
  updateSemanticFrame("document", { animate: false, announceChange: false });
  updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
  refresh();
  announce(`Semantic viewfinder opened. ${candidateIds.length} related passages gathered. No text changed.`);
  requestAnimationFrame(() => {
    animateSemanticGather(sourceRects, stageRect);
    $("exitViewfinder").focus();
  });
}

function exitSemanticViewfinder({ locateId = null } = {}) {
  if (!semanticOpen) return;
  window.clearTimeout(semanticReadyTimer);
  semanticOpen = false;
  semanticSession = null;
  $("semanticWorkspace").setAttribute("aria-hidden", "true");
  refresh();
  requestAnimationFrame(() => {
    if (locateId) {
      selectDocumentFocus(locateId, { announceSelection: false });
      const target = baseLayer.querySelector(`[data-id="${locateId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
      announce(`${locateId.toUpperCase()} located in the document.`);
    } else {
      selectedDocumentId = null;
      updateFocusPrompt();
      editor.scrollTop = documentScrollTop;
      refresh();
      announce("Returned to the document. No text was changed.");
      editor.focus();
    }
    window.setTimeout(() => { if (!semanticOpen) $("semanticCards").replaceChildren(); }, 260);
  });
}

$("enterViewfinder").addEventListener("click", enterSemanticViewfinder);
$("dismissFocusPrompt").addEventListener("click", () => clearDocumentFocus());
$("exitViewfinder").addEventListener("click", () => exitSemanticViewfinder());
document.addEventListener("pointerdown", event => {
  if (semanticOpen || !selectedDocumentId || !(event.target instanceof Element)) return;
  if (event.target.closest(".document-action-stack, .inline-revision-panel, .sentence")) return;
  clearDocumentFocus({ restoreFocus: false });
  announce("Selection closed. Choose another sentence whenever you are ready.");
});
$("compareRevision").addEventListener("click", () => toggleInlineRevision());
$("keepRevision").addEventListener("click", () => {
  const id = selectedDocumentId;
  inlineRevisionId = null;
  refresh();
  updateFocusPrompt();
  if (id) focusDocumentSentence(id);
  announce(`${id?.toUpperCase() || "Sentence"} kept. Its edited marker and Restore action remain available.`);
});
$("restoreRevision").addEventListener("click", restoreSelectedRevision);

function setSemanticFrameFromPointer(event) {
  if (!semanticFrameDrag) return;
  const dx = event.clientX - semanticFrameDrag.centerX;
  const dy = event.clientY - semanticFrameDrag.centerY;
  if (Math.hypot(dx, dy) < 10) return;

  // Read the pointer as a direction from the dial axis, then snap that angle
  // to one of the four structural ranges. 0deg is straight up.
  const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  const distance = target => Math.min(Math.abs(angle - target), 360 - Math.abs(angle - target));
  const distances = semanticFrameAngles.map(distance);
  const nearestDistance = Math.min(...distances);
  const tied = distances.reduce((matches, value, index) =>
    Math.abs(value - nearestDistance) < .001 ? [...matches, index] : matches, []);
  const nextIndex = tied.length === 1 ? tied[0] : angle >= 0 ? tied[tied.length - 1] : tied[0];
  const nextFrame = frameOptions[nextIndex];
  if (nextFrame === camera.frame) return;
  semanticFrameDrag.changed = true;
  updateSemanticFrame(nextFrame, { announceChange: false });
}

$("semanticFrameDial").addEventListener("pointerdown", event => {
  if (!semanticSession || event.button !== 0 || !event.target.closest(".frame-dial-face")) return;
  event.preventDefault();
  const face = $("semanticFrameDial").querySelector(".frame-dial-face");
  const rect = face.getBoundingClientRect();
  semanticFrameDrag = {
    id: event.pointerId,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    changed: false
  };
  $("semanticFrameDial").classList.add("is-adjusting");
  $("semanticFrameDial").setPointerCapture?.(event.pointerId);
  setSemanticFrameFromPointer(event);
});
$("semanticFrameDial").addEventListener("pointermove", event => {
  if (!semanticFrameDrag || semanticFrameDrag.id !== event.pointerId) return;
  event.preventDefault();
  setSemanticFrameFromPointer(event);
});
function endSemanticFrameDrag(event) {
  if (!semanticFrameDrag || semanticFrameDrag.id !== event.pointerId) return;
  const changed = semanticFrameDrag.changed;
  if ($("semanticFrameDial").hasPointerCapture?.(event.pointerId)) $("semanticFrameDial").releasePointerCapture(event.pointerId);
  semanticFrameDrag = null;
  $("semanticFrameDial").classList.remove("is-adjusting");
  if (changed && semanticSession) {
    saveSession();
    announce(`${camera.frame} frame. ${semanticSession.framedIds.length} related passages in range; ${semanticSession.includedIds.length} in focus.`);
  }
}
$("semanticFrameDial").addEventListener("pointerup", endSemanticFrameDrag);
$("semanticFrameDial").addEventListener("pointercancel", endSemanticFrameDrag);
$("semanticFrameDial").addEventListener("keydown", event => {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];
  if (!keys.includes(event.key) || !semanticSession) return;
  event.preventDefault();
  const currentIndex = frameOptions.indexOf(camera.frame);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? frameOptions.length - 1 :
    Math.max(0, Math.min(frameOptions.length - 1, currentIndex +
      (["ArrowRight", "ArrowUp", "PageUp"].includes(event.key) ? 1 : -1)));
  if (nextIndex !== currentIndex) updateSemanticFrame(frameOptions[nextIndex]);
});

function setSemanticStyleFromPointer(event) {
  if (!semanticStyleDrag) return;
  const toneValue = (event.clientX - semanticStyleDrag.left) / semanticStyleDrag.width * 100;
  const warmthValue = (semanticStyleDrag.bottom - event.clientY) / semanticStyleDrag.height * 100;
  const nextTone = Math.max(0, Math.min(100, toneValue));
  const nextWarmth = Math.max(0, Math.min(100, warmthValue));
  if (Math.abs(nextTone - semanticToneValue) > .3 || Math.abs(nextWarmth - semanticWarmthValue) > .3) {
    semanticStyleDrag.changed = true;
  }
  updateSemanticStyle(nextTone, nextWarmth);
}

$("semanticStylePlane").addEventListener("pointerdown", event => {
  if (!semanticSession || event.button !== 0) return;
  event.preventDefault();
  const plane = $("semanticStylePlane");
  const rect = plane.getBoundingClientRect();
  semanticStyleDrag = {
    id: event.pointerId,
    left: rect.left,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    changed: false
  };
  $("semanticStyleCursor").focus({ preventScroll: true });
  plane.classList.add("is-adjusting");
  plane.setPointerCapture?.(event.pointerId);
  setSemanticStyleFromPointer(event);
});
$("semanticStylePlane").addEventListener("pointermove", event => {
  if (!semanticStyleDrag || semanticStyleDrag.id !== event.pointerId) return;
  event.preventDefault();
  setSemanticStyleFromPointer(event);
});
function endSemanticStyleDrag(event) {
  if (!semanticStyleDrag || semanticStyleDrag.id !== event.pointerId) return;
  const changed = semanticStyleDrag.changed;
  const plane = $("semanticStylePlane");
  if (plane.hasPointerCapture?.(event.pointerId)) plane.releasePointerCapture(event.pointerId);
  semanticStyleDrag = null;
  plane.classList.remove("is-adjusting");
  if (changed) updateSemanticStyle(semanticToneValue, semanticWarmthValue, { announceChange: true });
}
$("semanticStylePlane").addEventListener("pointerup", endSemanticStyleDrag);
$("semanticStylePlane").addEventListener("pointercancel", endSemanticStyleDrag);

$("semanticStyleCursor").addEventListener("keydown", event => {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(event.key) || !semanticSession) return;
  event.preventDefault();
  const step = event.shiftKey ? 1 : 5;
  const nextTone = event.key === "Home" ? 50 : event.key === "End" ? 80 :
    semanticToneValue + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
  const nextWarmth = event.key === "Home" ? 50 : event.key === "End" ? 80 :
    semanticWarmthValue + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0);
  updateSemanticStyle(nextTone, nextWarmth, { announceChange: true });
});

$("semanticStyleReset").addEventListener("click", () => {
  if (!semanticSession) return;
  updateSemanticStyle(50, 50, { announceChange: true });
  $("semanticStyleCursor").focus({ preventScroll: true });
});

function resetSemanticPreview() {
  editingSemanticId = null;
  camera.discardPreview();
  semanticToneValue = 50;
  semanticWarmthValue = 50;
  renderSemanticCards();
  updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
  if (semanticSession?.ready) {
    $("semanticStatus").innerHTML = `<i></i> ${semanticSession.includedIds.length} of ${semanticSession.framedIds.length} passages in focus · ${camera.frame} frame · Review only`;
  }
  refresh();
}

$("semanticCancelPreview").addEventListener("click", () => {
  resetSemanticPreview();
  announce("Preview cancelled. The document was not changed.");
  $("semanticStyleCursor").focus({ preventScroll: true });
});

$("semanticApplyPreview").addEventListener("click", () => {
  const snapshot = camera.capture();
  if (!snapshot) {
    updateSemanticCommitActions();
    return;
  }
  semanticRecentCapture = snapshot;
  inlineRevisionId = null;
  editingSemanticId = null;
  selectedCapture = snapshot.id;
  renderSemanticCards();
  updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
  refresh();
  saveSession();
  announce(`${snapshot.changes.length} passage${snapshot.changes.length === 1 ? "" : "s"} updated. Undo is available.`);
});

$("semanticUndoApply").addEventListener("click", () => {
  if (!semanticRecentCapture || camera.undoStack.at(-1)?.kind !== "capture" || camera.undoStack.at(-1)?.captureId !== semanticRecentCapture.id) {
    clearSemanticAppliedState();
    updateSemanticCommitActions();
    return;
  }
  const count = semanticRecentCapture.changes.length;
  camera.undo();
  clearSemanticAppliedState();
  semanticToneValue = 50;
  semanticWarmthValue = 50;
  renderSemanticCards();
  updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
  if (semanticSession?.ready) {
    $("semanticStatus").innerHTML = `<i></i> ${semanticSession.includedIds.length} of ${semanticSession.framedIds.length} passages in focus · ${camera.frame} frame · Review only`;
  }
  refresh();
  saveSession();
  announce(`${count} passage${count === 1 ? "" : "s"} restored to the previous wording.`);
  $("semanticStyleCursor").focus({ preventScroll: true });
});

function toggleColorCues() {
  camera.color = !camera.color;
  refresh();
  saveSession();
  announce(camera.color
    ? "Color cues on. Warmth runs from cool to warm, while tone runs from light to strong contrast."
    : "Color cues off. Style changes remain visible with monochrome emphasis.");
}
$("semanticColorToggle").addEventListener("click", toggleColorCues);

function setSemanticAperture(value) {
  camera.setAperture(value);
  updateSemanticAperture();
}

function commitSemanticAperture() {
  if (!semanticSession) return;
  saveSession();
  announce(`${apertureLabel(camera.aperture)} aperture. ${semanticSession.includedIds.length} of ${semanticSession.candidateIds.length} passages in focus.`);
}

$("semanticAperture").addEventListener("pointerdown", event => {
  if (!semanticSession || event.button !== 0 || !event.target.closest(".aperture-dial-face")) return;
  event.preventDefault();
  const face = $("semanticAperture").querySelector(".aperture-dial-face");
  const rect = face.getBoundingClientRect();
  semanticApertureDrag = {
    id: event.pointerId,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2
  };
  $("semanticAperture").classList.add("is-adjusting");
  $("semanticAperture").setPointerCapture?.(event.pointerId);
  setSemanticApertureFromPointer(event);
});
function setSemanticApertureFromPointer(event) {
  if (!semanticApertureDrag) return;
  const dx = event.clientX - semanticApertureDrag.centerX;
  const dy = event.clientY - semanticApertureDrag.centerY;
  if (Math.hypot(dx, dy) < 10) return;

  // 0° is straight up. The usable dial arc runs from -130° (tight) to
  // +130° (wide); the lower 100° is a dead zone that snaps to the nearer end.
  const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  let dialAngle = angle;
  if (angle > 130 || angle < -130) {
    const wideDistance = Math.min(Math.abs(angle - 130), 360 - Math.abs(angle - 130));
    const tightDistance = Math.min(Math.abs(angle + 130), 360 - Math.abs(angle + 130));
    dialAngle = wideDistance === tightDistance ? (camera.aperture >= 50 ? 130 : -130) :
      wideDistance < tightDistance ? 130 : -130;
  }
  setSemanticAperture((dialAngle + 130) / 2.6);
}
$("semanticAperture").addEventListener("pointermove", event => {
  if (!semanticApertureDrag || semanticApertureDrag.id !== event.pointerId) return;
  event.preventDefault();
  setSemanticApertureFromPointer(event);
});
function endSemanticApertureDrag(event) {
  if (!semanticApertureDrag || semanticApertureDrag.id !== event.pointerId) return;
  if ($("semanticAperture").hasPointerCapture?.(event.pointerId)) $("semanticAperture").releasePointerCapture(event.pointerId);
  semanticApertureDrag = null;
  $("semanticAperture").classList.remove("is-adjusting");
  commitSemanticAperture();
}
$("semanticAperture").addEventListener("pointerup", endSemanticApertureDrag);
$("semanticAperture").addEventListener("pointercancel", endSemanticApertureDrag);
$("semanticAperture").addEventListener("keydown", event => {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];
  if (!keys.includes(event.key) || !semanticSession) return;
  event.preventDefault();
  const step = event.shiftKey ? 1 : 4;
  const next = event.key === "Home" ? 0 : event.key === "End" ? 100 :
    event.key === "PageUp" ? camera.aperture + 15 : event.key === "PageDown" ? camera.aperture - 15 :
    camera.aperture + (["ArrowRight", "ArrowUp"].includes(event.key) ? step : -step);
  setSemanticAperture(next);
  commitSemanticAperture();
});

function renderMap() {
  // The overview is navigation, not another focus control. Clicking a line
  // moves the manuscript while the user's focal sentence remains locked.
  if (!focusMap.querySelector(".map-marker")) {
    const rows = sentences.map(s => Math.max(2.4, Math.min(5.4, s.text.length / 32)));
    const totalRows = rows.reduce((sum, value) => sum + value, 0) + (sentences.length - 1) * .85;
    let cursor = 0;
    sentences.forEach((s, index) => {
      const marker = button(s.text, "map-marker", event => {
        event.stopPropagation();
        baseLayer.querySelector(`[data-id="${s.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      marker.dataset.id = s.id;
      marker.style.setProperty("--marker-top", `${2.5 + cursor / totalRows * 95}%`);
      marker.style.setProperty("--marker-height", `${rows[index] / totalRows * 95}%`);
      marker.style.setProperty("--marker-width", `${Math.min(91, 76 + s.text.length * .08)}%`);
      marker.style.setProperty("--marker-indent", `${5 + index % 3 * 2}%`);
      focusMap.append(marker);
      cursor += rows[index] + .85;
    });
  }
  const pending = new Set(mode === "focus" && camera.focusId ? camera.pendingIds() : []);
  const panoIds = new Set(mode === "pano" ? pano.snapshot().sentenceIds : []);
  focusMap.querySelectorAll(".map-marker").forEach(el => {
    const id = el.dataset.id;
    const sentence = sentences.find(item => item.id === id);
    const related = mode === "focus" && !!camera.focusId && camera.inFrame(id) && sentence?.issue === camera.focusIssue;
    const included = mode === "focus" && camera.inFocus(id);
    el.classList.toggle("is-related", related);
    el.classList.toggle("in-plane", included);
    el.classList.toggle("will-change", pending.has(id));
    el.classList.toggle("is-focal", mode === "focus" && id === camera.focusId);
    el.classList.toggle("pano-in-range", panoIds.has(id));
    const state = mode === "pano" ? (panoIds.has(id) ? "Inside the panorama sweep" : "Outside the panorama sweep") : camera.reason(id);
    el.title = `${id.toUpperCase()} · ${state} · Click to navigate`;
    el.setAttribute("aria-label", `Go to ${id.toUpperCase()} without changing focus: ${state}`);
  });
  updateViewportFrame();
}

function updateViewportFrame() {
  const scrollHeight = Math.max(editor.scrollHeight, editor.clientHeight, 1);
  const maxScroll = Math.max(0, scrollHeight - editor.clientHeight);
  const height = Math.min(100, Math.max(9, editor.clientHeight / scrollHeight * 100));
  const top = maxScroll ? editor.scrollTop / maxScroll * (100 - height) : 0;
  const start = Math.round(editor.scrollTop / scrollHeight * 100);
  const end = Math.round(Math.min(1, (editor.scrollTop + editor.clientHeight) / scrollHeight) * 100);
  mapViewport.style.top = `${top}%`;
  mapViewport.style.height = `${height}%`;
  mapViewport.setAttribute("aria-valuenow", String(start));
  mapViewport.setAttribute("aria-valuetext", `Visible manuscript range ${start} to ${end} percent`);
  $("mapStatus").textContent = `VIEW ${start}–${end}%`;
}

function navigateFromMap(clientY) {
  const rect = focusMap.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
  editor.scrollTop = Math.max(0, Math.min(editor.scrollHeight - editor.clientHeight,
    progress * editor.scrollHeight - editor.clientHeight / 2));
}

function refreshMembers() {
  if (!$("frameMembers").children.length) sentences.forEach(s => {
    const b = button("", "member-chip", () => selectSentence(s.id, true));
    b.dataset.id = s.id;
    $("frameMembers").append(b);
  });
  $("frameMembers").querySelectorAll("button").forEach(el => {
    const id = el.dataset.id;
    el.textContent = `${id.toUpperCase()} ${id === camera.focusId ? "· Focus" : camera.inFocus(id) ? "· Keep" : "· Out"}`;
    el.disabled = !camera.inFrame(id) || id === camera.focusId;
    el.setAttribute("aria-pressed", String(camera.inFocus(id)));
    el.title = `${camera.reason(id)}. ${camera.text(id, { committed: true })}`;
    el.setAttribute("aria-label", `${id.toUpperCase()}: ${camera.reason(id)}. Toggle inclusion.`);
  });
}

function changeIntent(issue) {
  camera.setIntent(issue);
  announce(`Following ${issueLabels[issue].toLowerCase()}. ${camera.includedIds().length} sentences in frame.`);
  lastMessage = "";
  refresh();
}

$("intentDial").addEventListener("click", () => changeIntent(intentOptions[(intentOptions.indexOf(camera.focusIssue) + 1) % intentOptions.length]));
document.querySelectorAll("[data-intent]").forEach(el => el.addEventListener("click", () => changeIntent(el.dataset.intent)));
$("frameDial").addEventListener("click", () => {
  camera.setFrame(frameOptions[(frameOptions.indexOf(camera.frame) + 1) % frameOptions.length]);
  announce(`${camera.frame} frame · ${camera.includedIds().length} sentences in plane.`);
  lastMessage = "";
  refresh();
});
function adjustAperture(value) { camera.setAperture(value); lastMessage = ""; queueRefresh(); }
$("apertureDial").addEventListener("click", event => {
  if (apertureDragged) { apertureDragged = false; event.preventDefault(); return; }
  adjustAperture([18, 50, 86].find(stop => stop > camera.aperture + 2) ?? 18);
});
$("apertureDial").addEventListener("pointerdown", event => {
  if (event.button !== 0 || $("apertureDial").disabled) return;
  apertureDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, value: camera.aperture };
  apertureDragged = false;
  $("apertureDial").classList.add("is-adjusting");
  $("apertureDial").setPointerCapture?.(event.pointerId);
});
$("apertureDial").addEventListener("pointermove", event => {
  if (!apertureDrag || apertureDrag.id !== event.pointerId) return;
  const delta = event.clientX - apertureDrag.x + apertureDrag.y - event.clientY;
  if (Math.abs(delta) > 3) apertureDragged = true;
  adjustAperture(apertureDrag.value + delta * .72);
});
function endApertureDrag(event) {
  if (!apertureDrag || apertureDrag.id !== event.pointerId) return;
  if ($("apertureDial").hasPointerCapture?.(event.pointerId)) $("apertureDial").releasePointerCapture(event.pointerId);
  apertureDrag = null;
  $("apertureDial").classList.remove("is-adjusting");
}
$("apertureDial").addEventListener("pointerup", endApertureDrag);
$("apertureDial").addEventListener("pointercancel", endApertureDrag);
$("apertureDial").addEventListener("wheel", event => {
  if ($("apertureDial").disabled) return;
  event.preventDefault();
  adjustAperture(camera.aperture + Math.sign(event.deltaY) * 5);
}, { passive: false });
$("apertureDial").addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  adjustAperture(event.key === "Home" ? 0 : event.key === "End" ? 100 : camera.aperture + (["ArrowUp", "ArrowRight"].includes(event.key) ? 4 : -4));
});
$("colorToggle").addEventListener("click", toggleColorCues);
$("editFrame").addEventListener("click", () => { editingFrame = !editingFrame; refresh(); });
$("resetSelection").addEventListener("click", () => { camera.resetMembership(); refresh(); });
$("backFocus").addEventListener("click", () => {
  const id = focusTrail.pop();
  if (!id) return;
  camera.focus(id, { preserveIntent: true });
  refresh();
  baseLayer.querySelector(`[data-id="${id}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelectorAll(".tone-option").forEach(el => {
  const tone = el.dataset.tone;
  el.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch") return;
    camera.preview(tone); refresh();
  });
  el.addEventListener("focus", () => { camera.preview(tone); refresh(); });
  el.addEventListener("click", () => { camera.setTone(tone); camera.preview(null); lastMessage = ""; refresh(); });
});
document.querySelector(".tone-options").addEventListener("pointerleave", () => { camera.preview(null); refresh(); });
$("toneStrip").addEventListener("focusout", event => {
  if (!document.querySelector(".tone-options").contains(event.relatedTarget)) { camera.preview(null); refresh(); }
});
$("discardPreview").addEventListener("click", () => { camera.discardPreview(); announce("Preview discarded. Manuscript unchanged."); refresh(); });

editor.addEventListener("scroll", updateViewportFrame, { passive: true });
focusMap.addEventListener("pointerdown", event => {
  if (event.target.closest(".map-marker")) return;
  draggingMap = true;
  focusMap.setPointerCapture?.(event.pointerId);
  navigateFromMap(event.clientY);
});
focusMap.addEventListener("pointermove", event => {
  if (draggingMap) navigateFromMap(event.clientY);
});
focusMap.addEventListener("pointerup", event => {
  draggingMap = false;
  if (focusMap.hasPointerCapture?.(event.pointerId)) focusMap.releasePointerCapture(event.pointerId);
});
focusMap.addEventListener("pointercancel", () => { draggingMap = false; });
// Mouse events keep dragging reliable in browsers that do not synthesize a
// full Pointer Events stream for an automated or assistive drag gesture.
focusMap.addEventListener("mousedown", event => {
  if (event.target.closest(".map-marker")) return;
  draggingMap = true;
  navigateFromMap(event.clientY);
});
window.addEventListener("mousemove", event => {
  if (draggingMap) navigateFromMap(event.clientY);
});
window.addEventListener("mouseup", () => { draggingMap = false; });
mapViewport.addEventListener("keydown", event => {
  const steps = {
    ArrowUp: -48,
    ArrowDown: 48,
    PageUp: -editor.clientHeight * .8,
    PageDown: editor.clientHeight * .8,
    Home: -Infinity,
    End: Infinity
  };
  if (!(event.key in steps)) return;
  event.preventDefault();
  if (event.key === "Home") editor.scrollTop = 0;
  else if (event.key === "End") editor.scrollTop = editor.scrollHeight;
  else editor.scrollTop += steps[event.key];
});
window.addEventListener("resize", queueRefresh);

function historyAction(action) {
  const result = camera[action]();
  if (!result) { refresh(); return; }
  clearSemanticAppliedState();
  if (semanticOpen) {
    semanticToneValue = 50;
    semanticWarmthValue = 50;
    renderSemanticCards();
    updateSemanticStyle(semanticToneValue, semanticWarmthValue, { selectTone: false });
    if (semanticSession?.ready) {
      $("semanticStatus").innerHTML = `<i></i> ${semanticSession.includedIds.length} of ${semanticSession.framedIds.length} passages in focus · ${camera.frame} frame · Review only`;
    }
  }
  announce(action === "undo" ? "Last edit undone." : "Last edit redone.");
  refresh();
  updateFocusPrompt();
  saveSession();
  if (!$("filmDrawer").classList.contains("hidden")) renderFilm();
}
$("undoBtn").addEventListener("click", () => historyAction("undo"));
$("redoBtn").addEventListener("click", () => historyAction("redo"));
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
    event.preventDefault(); historyAction(event.shiftKey ? "redo" : "undo");
  }
  if (event.key === "Escape") {
    if (!$("filmDrawer").classList.contains("hidden")) closeFilm();
    else if (inlineRevisionId) {
      const id = inlineRevisionId;
      inlineRevisionId = null;
      refresh();
      focusDocumentSentence(id);
    }
    else if (semanticOpen) exitSemanticViewfinder();
    else if (selectedDocumentId) clearDocumentFocus();
    else if (editingFrame) { editingFrame = false; refresh(); }
    else { camera.discardPreview(); refresh(); }
  }
});

$("shutter").addEventListener("click", () => {
  if (mode === "pano") {
    const snapshot = pano.capture();
    if (!snapshot) return;
    snapshot.id = `P${String(Math.max(0, ...panoCaptures.map(c => Number(c.id.slice(1)))) + 1).padStart(2, "0")}`;
    panoCaptures.push(snapshot);
    selectedCapture = snapshot.id;
    announce(`Panorama ${snapshot.id} saved to Film.`);
  } else {
    const snapshot = camera.capture();
    if (!snapshot) { refresh(); return; }
    selectedCapture = snapshot.id;
    announce(`${toneTreatments[snapshot.tone].label} applied to ${snapshot.changes.map(c => c.id.toUpperCase()).join(", ")}.`);
  }
  $("shutter").classList.remove("captured");
  void $("shutter").offsetWidth;
  $("shutter").classList.add("captured");
  refresh(); saveSession();
  if (!$("filmDrawer").classList.contains("hidden")) renderFilm();
});

function allCaptures() { return [...camera.captures, ...panoCaptures].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); }
function captureById(id) { return allCaptures().find(c => c.id === id); }
function captureName(c) { return c.kind === "pano" ? `Pano ${c.id}` : `Take ${c.id} · ${toneTreatments[c.tone]?.label || c.tone}`; }

function openFilm(id) {
  camera.preview(null);
  selectedCapture = id || selectedCapture || allCaptures().at(-1)?.id;
  compareCapture = null;
  $("filmDrawer").classList.remove("hidden");
  $("filmBtn").setAttribute("aria-expanded", "true");
  document.body.classList.add("film-open");
  renderFilm(); refresh();
  $("closeFilm").focus();
}
function closeFilm() {
  $("filmDrawer").classList.add("hidden");
  $("filmBtn").setAttribute("aria-expanded", "false");
  document.body.classList.remove("film-open");
  $("filmBtn").focus();
}
$("filmBtn").addEventListener("click", () => $("filmDrawer").classList.contains("hidden") ? openFilm() : closeFilm());
$("closeFilm").addEventListener("click", closeFilm);
$("reviewBtn").addEventListener("click", () => openFilm(camera.captures.at(-1)?.id));

function renderFilm() {
  const captures = allCaptures();
  const list = $("filmList");
  const details = $("filmDetails");
  list.replaceChildren(); details.replaceChildren();
  $("storageNote").textContent = storageAvailable ? "Saved in this browser. Captures keep their original wording." : "Session only: browser storage is unavailable.";
  if (!captures.length) {
    details.append(node("p", "empty-film", "Your film is empty. Choose a tone and press the shutter to save a take, or capture a panorama."));
    return;
  }
  captures.forEach(c => {
    const b = button("", `film-thumbnail${selectedCapture === c.id ? " active" : ""}`, () => { selectedCapture = c.id; compareCapture = null; renderFilm(); });
    b.append(node("span", "micro-label", c.kind === "pano" ? "PANORAMA" : "CAPTURE"), node("strong", "", c.id), node("small", "", c.kind === "pano" ? `${c.sentenceIds.length} sentences` : `${toneTreatments[c.tone].label} · ${c.changes.length} changes`));
    b.setAttribute("aria-pressed", String(selectedCapture === c.id));
    b.setAttribute("aria-label", captureName(c));
    list.append(b);
  });
  const capture = captureById(selectedCapture) || captures.at(-1);
  details.append(node("h3", "", captureName(capture)));
  if (capture.kind === "pano") {
    details.append(node("p", "capture-meta", `${capture.startId.toUpperCase()} → ${capture.endId.toUpperCase()} · ${capture.sentenceIds.length} sentences · Example summary`), node("p", "pano-saved-summary", capture.summary));
    capture.steps.forEach(step => {
      const row = node("div", "review-row");
      row.append(node("strong", "", step.label), node("p", "", step.summary));
      details.append(row);
    });
    return;
  }
  details.append(node("p", "capture-meta", `${capture.focusId.toUpperCase()} · ${intentLabels[capture.focusIssue]} · ${capture.frame} · ${apertureInfo(capture.aperture).depth} depth`));
  details.append(node("p", "capture-meta", `Captured ${capture.includedIds.map(id => id.toUpperCase()).join(", ")}. ${capture.changes.length} wording changes.`));
  const tools = node("div", "film-tools");
  const restore = button("Restore this take", "camera-button", () => {
    const result = camera.restoreCapture(capture.id);
    if (result) { announce(`Restored take ${capture.id}. Other sentences were kept.`); refresh(); saveSession(); renderFilm(); }
  });
  restore.disabled = capture.changes.every(change => camera.text(change.id, { committed: true }) === change.after);
  tools.append(restore);
  const others = camera.captures.filter(c => c.id !== capture.id);
  if (others.length) {
    const label = node("label", "compare-label", "Compare with ");
    const select = node("select", "compare-select");
    select.setAttribute("aria-label", "Compare with another captured take");
    const first = node("option", "", "Choose a take"); first.value = ""; select.append(first);
    others.forEach(c => { const option = node("option", "", captureName(c)); option.value = c.id; select.append(option); });
    select.value = compareCapture || "";
    select.addEventListener("change", () => { compareCapture = select.value || null; renderFilm(); });
    label.append(select); tools.append(label);
  }
  details.append(tools);
  if (compareCapture) { renderComparison(details, capture, captureById(compareCapture)); return; }
  details.append(node("p", "review-explainer", "Each status shows whether this captured wording is still in the manuscript. Revert an applied sentence, or restore the whole take."));
  capture.changes.forEach(change => {
    const row = node("article", "review-row");
    const status = camera.changeStatus(capture.id, change.id);
    const head = node("div", "review-row-head");
    head.append(node("strong", "", change.id.toUpperCase()), node("span", "change-status", status));
    row.append(head, node("span", "micro-label", "BEFORE"), node("p", "before", change.before), node("span", "micro-label", "CAPTURED"), node("p", "after", change.after));
    const revert = button("Revert this sentence", "text-button", () => {
      if (camera.revertChange(capture.id, change.id)) { announce(`${change.id.toUpperCase()} reverted. Undo is available.`); refresh(); saveSession(); renderFilm(); }
    });
    revert.disabled = status !== "applied";
    revert.setAttribute("aria-label", `Revert ${change.id.toUpperCase()} from take ${capture.id}`);
    row.append(revert);
    if (status === "superseded") row.append(node("small", "review-explainer", "A later edit changed this sentence."));
    details.append(row);
  });
}

function renderComparison(container, left, right) {
  if (!right || right.kind !== "style") return;
  container.append(node("p", "review-explainer", "Comparing the wording saved in these two captures. A dash means that sentence was not changed in that take."));
  const ids = sentences.map(s => s.id).filter(id => left.changes.some(c => c.id === id) || right.changes.some(c => c.id === id));
  ids.forEach(id => {
    const row = node("article", "review-row");
    row.append(node("strong", "", id.toUpperCase()));
    [left, right].forEach(c => {
      row.append(node("span", "micro-label compare-take-label", captureName(c)), node("p", "after", c.changes.find(change => change.id === id)?.after || "— Not changed in this take"));
    });
    container.append(row);
  });
}

renderLayer(baseLayer, true);
const pano = new PanoCamera({ editor, baseLayer, model, onChange: () => {} });
function setMode(nextMode) {
  if (mode === nextMode) return;
  camera.preview(null);
  mode = nextMode;
  editingFrame = false;
  if (mode === "pano") pano.enter(camera.focusId);
  else pano.exit();
  refresh();
}
$("focusModeBtn").addEventListener("click", () => setMode("focus"));
$("panoModeBtn").addEventListener("click", () => setMode("pano"));
refresh();
