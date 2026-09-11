"use strict";

const sentences = model.sections.flatMap(section => section.paragraphs.flatMap((paragraph, index) =>
  paragraph.map(sentence => ({ ...sentence, sectionId: section.id, paragraphId: `${section.id}-${index}` }))));
const camera = new SemanticCamera({ sentences, toneVariants });
const $ = id => document.getElementById(id);
const editor = $("editor");
const baseLayer = $("baseLayer");
const lensLayer = $("lensLayer");
const toneOrder = Object.keys(toneTreatments);
const frameOptions = ["sentence", "paragraph", "section", "document"];
const intentOptions = Object.keys(intentLabels);
const sessionKey = "textgraphy-camera-v4";
let panoCaptures = [];
let mode = "focus";
let editingFrame = false;
let wheelAperture = true;
let inspecting = false;
let focusTrail = [];
let selectedCapture = null;
let compareCapture = null;
let lastMessage = "";
let refreshQueued = false;
let storageAvailable = true;

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
  const focused = isFocus && !!camera.focusId;
  const tone = isFocus ? camera.hoverTone || camera.draftTone : null;
  const included = focused ? camera.includedIds() : [];
  const pending = focused ? camera.pendingIds() : [];
  const aperture = apertureInfo();
  document.body.classList.toggle("color-on", camera.color);
  document.body.classList.toggle("has-focus", focused);
  document.body.classList.toggle("tone-active", focused);
  document.body.classList.toggle("editing-frame", editingFrame);
  document.body.classList.toggle("pano-active", !isFocus);
  document.body.dataset.issue = camera.focusIssue || "none";
  document.body.dataset.tone = tone || "none";

  [baseLayer, lensLayer].forEach(layer => layer.querySelectorAll(".sentence").forEach(el => {
    const id = el.dataset.id;
    el.className = "sentence";
    const inFocus = included.includes(id);
    if (focused && camera.focusId === id) el.classList.add("focused");
    if (inFocus) el.classList.add("semantic", camera.score(id) >= .8 ? "near-plane" : "mid-plane");
    if (focused && !camera.inFrame(id)) el.classList.add("outside-frame");
    if (focused && camera.manualInclude.has(id)) el.classList.add("manual-include");
    if (focused && camera.manualExclude.has(id)) el.classList.add("manual-exclude");
    if ((focused && tone && inFocus) || camera.committed.has(id)) el.classList.add(`tone-${isFocus ? camera.displayedTone(id) : camera.committed.get(id)}`);
    if (pending.includes(id)) el.classList.add("previewing");
    const text = isFocus ? camera.text(id) : camera.text(id, { committed: true });
    if (el.textContent !== text) el.textContent = text;
    if (layer === baseLayer) {
      const action = editingFrame ? "Toggle inclusion" : !isFocus ? "Set panorama endpoint" : "Set focus";
      el.setAttribute("aria-label", `${id.toUpperCase()}: ${text}. ${action}.`);
      el.setAttribute("aria-pressed", String(focused && (editingFrame ? inFocus : camera.focusId === id)));
      el.title = focused ? `${id.toUpperCase()} · ${camera.reason(id)}` : `${id.toUpperCase()} · ${action}`;
    }
  }));

  $("intentValue").textContent = camera.focusIssue ? intentLabels[camera.focusIssue] : "Choose";
  $("intentDial").disabled = !focused;
  $("intentDial").style.setProperty("--dial-rotation", `${-95 + Math.max(0, intentOptions.indexOf(camera.focusIssue)) * 95}deg`);
  $("frameValue").textContent = camera.frame[0].toUpperCase() + camera.frame.slice(1);
  $("frameDial").style.setProperty("--dial-rotation", `${-120 + frameOptions.indexOf(camera.frame) * 80}deg`);
  $("frameDial").disabled = !isFocus;
  $("depthValue").textContent = `${aperture.stop} · ${aperture.depth}`;
  $("apertureDial").style.setProperty("--dial-rotation", `${-125 + camera.aperture * 2.5}deg`);
  $("apertureDial").disabled = !isFocus || camera.frame === "sentence";
  $("apertureDial").setAttribute("aria-label", `Semantic aperture: ${aperture.depth}. Use arrow keys to adjust.`);
  editor.style.setProperty("--lens-r", `${Math.min(112 + camera.aperture * 1.12, editor.clientWidth / 2 - 12)}px`);
  $("lensDepth").textContent = `${aperture.stop} · ${included.length} IN PLANE`;
  $("lensRing").classList.toggle("hidden", !focused);
  $("lensLayer").classList.toggle("hidden", !focused);
  $("focusValue").textContent = focused ? camera.focusId.toUpperCase() : "—";
  $("focusCount").textContent = String(included.length);
  $("toneValue").textContent = tone ? toneTreatments[tone].label.toUpperCase() : "—";
  $("colorToggle").setAttribute("aria-pressed", String(camera.color));
  $("colorModeValue").textContent = camera.color ? "Color" : "Mono";
  $("colorHudValue").textContent = camera.color ? "COLOR" : "MONO";
  $("hudLabel").textContent = isFocus ? (inspecting ? "INSPECTING · FOCAL SENTENCE STAYS LOCKED" : "FOCAL INTENT") : "PANORAMA · FOLLOW THE ARGUMENT";
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
  $("wheelMode").textContent = !isFocus ? "WHEEL: PANO SCAN" : wheelAperture ? "WHEEL: APERTURE" : "WHEEL: SCROLL";
  $("wheelMode").setAttribute("aria-pressed", String(isFocus && wheelAperture));
  $("wheelMode").disabled = !isFocus;
  $("focusModeBtn").setAttribute("aria-pressed", String(isFocus));
  $("panoModeBtn").setAttribute("aria-pressed", String(!isFocus));
  $("focusModeBtn").classList.toggle("active", isFocus);
  $("panoModeBtn").classList.toggle("active", !isFocus);
  renderMap();
  if (editingFrame) refreshMembers();
  if (focused && !inspecting) lockLens();
  if (!isFocus) pano.refresh();
}

function setLensPosition(x, y) {
  const radius = Math.min(112 + camera.aperture * 1.12, editor.clientWidth / 2 - 12);
  editor.style.setProperty("--lens-x", `${Math.max(radius, Math.min(x, editor.clientWidth - radius))}px`);
  editor.style.setProperty("--lens-y", `${Math.max(radius, Math.min(y, baseLayer.scrollHeight - radius))}px`);
}

function lockLens() {
  const el = baseLayer.querySelector(`[data-id="${camera.focusId}"]`);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const area = editor.getBoundingClientRect();
  setLensPosition(rect.left - area.left + rect.width / 2, rect.top - area.top + editor.scrollTop + rect.height / 2);
}

function selectSentence(id, manual = false) {
  if (mode === "pano") { pano.selectEnd(id); return; }
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

function renderMap() {
  // Keep controls stable while previewing; keyboard focus must survive a refresh.
  if (!$("focusMap").children.length) sentences.forEach(s => {
    const marker = button(s.id.slice(1).padStart(2, "0"), "map-marker", () => {
      selectSentence(s.id);
      baseLayer.querySelector(`[data-id="${s.id}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
    });
    marker.dataset.id = s.id;
    $("focusMap").append(marker);
  });
  $("focusMap").querySelectorAll("button").forEach(el => {
    const id = el.dataset.id;
    el.classList.toggle("in-plane", mode === "focus" && camera.inFocus(id));
    el.classList.toggle("is-focal", mode === "focus" && id === camera.focusId);
    el.title = `${id.toUpperCase()} · ${camera.reason(id)}`;
    el.setAttribute("aria-label", `Go to ${id.toUpperCase()}: ${camera.reason(id)}`);
  });
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
$("apertureDial").addEventListener("click", () => adjustAperture([18, 50, 86].find(stop => stop > camera.aperture + 2) ?? 18));
$("apertureDial").addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  adjustAperture(event.key === "Home" ? 0 : event.key === "End" ? 100 : camera.aperture + (["ArrowUp", "ArrowRight"].includes(event.key) ? 4 : -4));
});
$("colorToggle").addEventListener("click", () => { camera.color = !camera.color; refresh(); saveSession(); });
$("wheelMode").addEventListener("click", () => { wheelAperture = !wheelAperture; refresh(); });
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

editor.addEventListener("wheel", event => {
  if (mode !== "focus" || !camera.focusId || !wheelAperture || event.ctrlKey || camera.frame === "sentence") return;
  event.preventDefault();
  if (event.shiftKey) { editor.scrollTop += event.deltaY || event.deltaX; return; }
  const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * editor.clientHeight : event.deltaY;
  adjustAperture(camera.aperture + Math.max(-8, Math.min(8, delta * .04)));
}, { passive: false });
editor.addEventListener("pointermove", event => {
  if (!event.ctrlKey || mode !== "focus" || !camera.focusId) return;
  inspecting = true;
  document.body.classList.add("reframing");
  $("hudLabel").textContent = `INSPECTING · FOCUS STAYS ${camera.focusId.toUpperCase()}`;
  const rect = editor.getBoundingClientRect();
  setLensPosition(event.clientX - rect.left, event.clientY - rect.top + editor.scrollTop);
});
function endInspection() { if (!inspecting) return; inspecting = false; document.body.classList.remove("reframing"); refresh(); }
document.addEventListener("keyup", event => { if (!event.ctrlKey) endInspection(); });
window.addEventListener("blur", endInspection);
window.addEventListener("resize", queueRefresh);

function historyAction(action) {
  const result = camera[action]();
  if (!result) { refresh(); return; }
  announce(action === "undo" ? "Last edit undone." : "Last edit redone.");
  refresh(); saveSession();
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
renderLayer(lensLayer, false);
const pano = new PanoCamera({ editor, baseLayer, model, onChange: () => {} });
function setMode(nextMode) {
  if (mode === nextMode) return;
  camera.preview(null);
  mode = nextMode;
  editingFrame = false;
  inspecting = false;
  if (mode === "pano") pano.enter(camera.focusId);
  else pano.exit();
  refresh();
}
$("focusModeBtn").addEventListener("click", () => setMode("focus"));
$("panoModeBtn").addEventListener("click", () => setMode("pano"));
refresh();
