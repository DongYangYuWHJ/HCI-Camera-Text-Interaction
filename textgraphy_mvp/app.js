const model = {
  title: "Framing AI Revision in Long-Form Writing",
  byline: "Anonymous draft",
  sections: [
    {
      id: "intro",
      title: "1. Introduction",
      paragraphs: [
        [
          { id: "s1", issue: "absolute", score: 0.97, text: "Large language models have completely transformed the process of revising long-form writing." },
          { id: "s2", issue: "scope", score: 0.52, text: "Most interfaces, however, still ask writers to select a passage and issue a textual instruction." },
          { id: "s3", issue: "absolute", score: 0.91, text: "These systems always interpret the writer's revision intent correctly when enough context is provided." }
        ],
        [
          { id: "s4", issue: "transition", score: 0.82, text: "The resulting interaction can feel disconnected from the writer's evolving understanding of the document." },
          { id: "s5", issue: "absolute", score: 0.82, text: "Prompt-based revision guarantees consistent changes across a document once a suitable instruction has been written." },
          { id: "s6", issue: "scope", score: 0.86, text: "In practice, a writer may want one discovered problem to guide a broader inspection without authorizing a full rewrite." }
        ]
      ]
    },
    {
      id: "design",
      title: "2. Design Rationale",
      paragraphs: [
        [
          { id: "s7", issue: "scope", score: 0.74, text: "Photography offers a vocabulary for deciding what deserves attention and how much surrounding context should remain visible." },
          { id: "s8", issue: "absolute", score: 0.73, text: "A semantic lens can eliminate uncertainty about which related passages the model will modify." },
          { id: "s9", issue: "transition", score: 0.68, text: "The writer can then inspect the model's interpretation before committing to a change." }
        ],
        [
          { id: "s10", issue: "absolute", score: 0.64, text: "This interaction significantly improves writer control in every revision scenario." },
          { id: "s11", issue: "scope", score: 0.62, text: "Rather than exposing relevance as a numeric threshold, the interface can represent it as semantic depth of field." },
          { id: "s12", issue: "absolute", score: 0.44, text: "The resulting workflow may increase consistency while still preserving the writer's authority over the final text." }
        ]
      ]
    }
  ]
};

const issueLabels = {
  absolute: "Overly absolute claims",
  scope: "Revision scope and propagation",
  transition: "Argument continuity"
};

const intentLabels = {
  absolute: "Claim",
  scope: "Scope",
  transition: "Flow"
};

const revisions = {
  s1: {
    conservative: "Large language models have substantially changed the process of revising long-form writing.",
    balanced: "Large language models are reshaping how writers revise long-form documents.",
    strong: "Large language models introduce new possibilities for revising long-form writing while leaving important interaction challenges unresolved."
  },
  s3: {
    conservative: "These systems can often interpret the writer's revision intent when enough context is provided.",
    balanced: "With sufficient context, these systems may interpret the writer's revision intent more reliably.",
    strong: "Providing more context can improve how reliably these systems infer a writer's revision intent."
  },
  s5: {
    conservative: "Prompt-based revision can support more consistent changes across a document once a suitable instruction has been written.",
    balanced: "A well-specified prompt can help propagate consistent revisions across a document.",
    strong: "Prompting can support document-wide consistency, but the writer still has limited visibility into how an instruction propagates."
  },
  s8: {
    conservative: "A semantic lens can reduce uncertainty about which related passages the model will modify.",
    balanced: "A semantic lens can make the model's intended revision set more visible to the writer.",
    strong: "A semantic lens externalizes the model's interpretation of relatedness before revision occurs."
  },
  s10: {
    conservative: "This interaction may improve writer control across a range of revision scenarios.",
    balanced: "This interaction is designed to strengthen writer control across several revision scenarios.",
    strong: "This interaction shifts control from post-hoc review toward pre-revision framing of the model's attention."
  }
};

const toneTreatments = {
  clinical: { label: "Clinical", descriptor: "Detached · precise · impersonal" },
  restrained: { label: "Restrained", descriptor: "Formal · controlled · reserved" },
  balanced: { label: "Balanced", descriptor: "Neutral · clear · natural" },
  warm: { label: "Warm", descriptor: "Personal · inviting · human" },
  expressive: { label: "Expressive", descriptor: "Vivid · emotional · poetic" }
};

const toneVariants = {
  s1: {
    clinical: "Recent large language models have altered several stages of long-form text revision.",
    restrained: "Large language models have substantially changed how long-form writing is revised.",
    balanced: "Large language models have completely transformed the process of revising long-form writing.",
    warm: "Large language models are giving writers new ways to revisit and refine long-form work.",
    expressive: "Large language models are reshaping the intimate process through which writers return to, question, and transform their work."
  },
  s2: {
    clinical: "Conventional interfaces generally require users to select text and provide an explicit revision instruction.",
    restrained: "Most interfaces still require writers to select a passage and specify the intended revision in words.",
    balanced: "Most interfaces, however, still ask writers to select a passage and issue a textual instruction.",
    warm: "Most interfaces still make writers pause, select a passage, and explain what they hope to improve.",
    expressive: "Most interfaces interrupt the current of writing, asking authors to isolate a passage and translate an instinct into an instruction."
  },
  s3: {
    clinical: "With sufficient contextual input, these systems can infer revision intent, although errors remain possible.",
    restrained: "These systems may interpret a writer's revision intent reliably when adequate context is available.",
    balanced: "These systems always interpret the writer's revision intent correctly when enough context is provided.",
    warm: "When writers can share enough context, these systems are more likely to understand the change they have in mind.",
    expressive: "Given enough of the surrounding story, the system can begin to hear the revision the writer is reaching for."
  },
  s4: {
    clinical: "This interaction can separate system output from the user's developing representation of the document.",
    restrained: "The resulting interaction may remain disconnected from the writer's developing understanding of the document.",
    balanced: "The resulting interaction can feel disconnected from the writer's evolving understanding of the document.",
    warm: "As writers come to understand their draft more deeply, the interaction can still feel disconnected from that changing view.",
    expressive: "The draft may grow clearer in the writer's mind while the interface remains stranded behind, detached from that unfolding understanding."
  },
  s5: {
    clinical: "A sufficiently specified prompt can produce consistent document-level revisions.",
    restrained: "Prompt-based revision can support consistent changes across a document once an appropriate instruction is available.",
    balanced: "Prompt-based revision guarantees consistent changes across a document once a suitable instruction has been written.",
    warm: "A thoughtful prompt can help writers carry the same improvement gently across an entire document.",
    expressive: "Once the right instruction is found, a single revision can ripple through the document and bring its scattered phrases into harmony."
  },
  s6: {
    clinical: "A detected local issue may be used to inspect related instances without initiating document-wide modification.",
    restrained: "A writer may use one identified problem to guide broader inspection without authorizing a complete rewrite.",
    balanced: "In practice, a writer may want one discovered problem to guide a broader inspection without authorizing a full rewrite.",
    warm: "A writer may want one small discovery to illuminate the rest of the draft without surrendering the whole document to revision.",
    expressive: "One troubled sentence can become a lantern for the wider draft, revealing echoes elsewhere without setting the entire manuscript ablaze."
  },
  s7: {
    clinical: "Photography provides parameters for allocating attention and retaining contextual information.",
    restrained: "Photography offers a vocabulary for determining what receives attention and how much context remains visible.",
    balanced: "Photography offers a vocabulary for deciding what deserves attention and how much surrounding context should remain visible.",
    warm: "Photography gives writers a familiar way to choose what deserves care while keeping the surrounding context in view.",
    expressive: "Photography teaches us to hold one subject in sharp attention without letting the world around it disappear."
  },
  s8: {
    clinical: "A semantic lens can expose the set of related passages designated for model modification.",
    restrained: "A semantic lens can reduce uncertainty about which related passages the model will modify.",
    balanced: "A semantic lens can eliminate uncertainty about which related passages the model will modify.",
    warm: "A semantic lens can help writers see exactly which related passages the model intends to touch.",
    expressive: "Through a semantic lens, the model's hidden field of attention comes into view before a single word is changed."
  },
  s9: {
    clinical: "The user can inspect the inferred revision set before execution.",
    restrained: "The writer can inspect the model's interpretation before committing to a change.",
    balanced: "The writer can then inspect the model's interpretation before committing to a change.",
    warm: "Writers can pause, understand what the model has seen, and decide whether the change feels right before committing.",
    expressive: "Before the shutter falls, the writer can look through the model's eyes and decide whether this is truly the revision they imagined."
  },
  s10: {
    clinical: "The interaction increases user control across multiple revision conditions.",
    restrained: "This interaction may improve writer control across a range of revision scenarios.",
    balanced: "This interaction significantly improves writer control in every revision scenario.",
    warm: "This interaction gives writers a stronger sense of guidance and ownership across many kinds of revision.",
    expressive: "Across the shifting landscape of revision, the interaction keeps the writer's hand firmly on the camera."
  },
  s11: {
    clinical: "Semantic depth of field can encode relevance without displaying a numeric threshold.",
    restrained: "The interface can represent relevance as semantic depth of field rather than as a numeric threshold.",
    balanced: "Rather than exposing relevance as a numeric threshold, the interface can represent it as semantic depth of field.",
    warm: "Instead of asking writers to reason about a number, the interface lets them feel relevance as a changing depth of field.",
    expressive: "Relevance no longer arrives as a sterile number; it emerges like a scene coming gradually, meaningfully into focus."
  },
  s12: {
    clinical: "The workflow may improve consistency while retaining final user authority.",
    restrained: "The workflow may increase consistency while preserving the writer's authority over the final text.",
    balanced: "The resulting workflow may increase consistency while still preserving the writer's authority over the final text.",
    warm: "The workflow can make a draft more consistent while ensuring that the final voice still belongs to its writer.",
    expressive: "The draft may find a steadier voice, but the last word—and the authorship behind it—remains with the writer."
  }
};

const state = {
  focusId: null,
  focusIssue: null,
  frame: "document",
  aperture: 48,
  threshold: 0.66,
  color: true,
  previewTone: null,
  toneBySentence: new Map(),
  manualInclude: new Set(),
  manualExclude: new Set(),
  capturedIds: [],
  selectedTake: "balanced"
};

const frameOptions = ["paragraph", "section", "document"];
const intentOptions = ["absolute", "scope", "transition"];
const apertureStops = [18, 50, 86];

const editor = document.getElementById("editor");
const baseLayer = document.getElementById("baseLayer");
const lensLayer = document.getElementById("lensLayer");
const issueTitle = document.getElementById("issueTitle");
const frameValue = document.getElementById("frameValue");
const depthValue = document.getElementById("depthValue");
const focusValue = document.getElementById("focusValue");
const focusCount = document.getElementById("focusCount");
const toneValue = document.getElementById("toneValue");
const toneStrip = document.getElementById("toneStrip");
const tonePreviewValue = document.getElementById("tonePreviewValue");
const lensDepth = document.getElementById("lensDepth");
const intentDial = document.getElementById("intentDial");
const intentValue = document.getElementById("intentValue");
const frameDial = document.getElementById("frameDial");
const apertureDial = document.getElementById("apertureDial");
const colorToggle = document.getElementById("colorToggle");
const colorModeValue = document.getElementById("colorModeValue");
const colorHudValue = document.getElementById("colorHudValue");
const contactSheet = document.getElementById("contactSheet");
const capturedSummary = document.getElementById("capturedSummary");
const capturedStrip = document.getElementById("capturedStrip");
const revisionCards = document.getElementById("revisionCards");
const takeHint = document.getElementById("takeHint");

function flattenSentences() {
  return model.sections.flatMap(section => section.paragraphs.flatMap(paragraph => paragraph));
}

function getSentence(id) {
  return flattenSentences().find(sentence => sentence.id === id);
}

function selectedTone(id) {
  return state.toneBySentence.get(id) || "balanced";
}

function effectiveTone(id) {
  if (id === state.focusId && state.previewTone) return state.previewTone;
  return selectedTone(id);
}

function displayText(sentence) {
  return toneVariants[sentence.id]?.[effectiveTone(sentence.id)] || sentence.text;
}

function renderLayer(layer, interactive) {
  layer.innerHTML = "";

  const title = document.createElement("h2");
  title.className = "article-title";
  title.textContent = model.title;
  layer.appendChild(title);

  const byline = document.createElement("div");
  byline.className = "byline";
  byline.textContent = model.byline;
  layer.appendChild(byline);

  model.sections.forEach(section => {
    const sectionElement = document.createElement("section");
    sectionElement.className = "section";
    sectionElement.dataset.section = section.id;

    const heading = document.createElement("h3");
    heading.className = "section-title";
    heading.textContent = section.title;
    sectionElement.appendChild(heading);

    section.paragraphs.forEach((sentences, paragraphIndex) => {
      const paragraph = document.createElement("p");
      paragraph.className = "paragraph";
      paragraph.dataset.paragraph = `${section.id}-${paragraphIndex}`;

      sentences.forEach((sentence, sentenceIndex) => {
        const span = document.createElement("span");
        span.className = "sentence";
        span.dataset.id = sentence.id;
        span.textContent = displayText(sentence);
        if (interactive) span.addEventListener("click", event => onSentenceClick(event, sentence.id));
        paragraph.appendChild(span);
        if (sentenceIndex < sentences.length - 1) paragraph.appendChild(document.createTextNode(" "));
      });

      sectionElement.appendChild(paragraph);
    });

    layer.appendChild(sectionElement);
  });
}

function getFrameIds() {
  if (!state.focusId || state.frame === "document") {
    return new Set(flattenSentences().map(sentence => sentence.id));
  }

  const focusElement = baseLayer.querySelector(`[data-id="${state.focusId}"]`);
  if (!focusElement) return new Set();

  const selector = state.frame === "section" ? ".section" : ".paragraph";
  return new Set([...focusElement.closest(selector).querySelectorAll(".sentence")].map(element => element.dataset.id));
}

function semanticScore(sentence) {
  if (!state.focusId || !state.focusIssue) return 0;
  if (sentence.id === state.focusId) return 1;
  if (sentence.issue === state.focusIssue) return sentence.score;
  const seed = sentence.id.charCodeAt(sentence.id.length - 1);
  return 0.18 + (seed % 16) / 100;
}

function isInFocus(sentence) {
  if (!state.focusId || !getFrameIds().has(sentence.id)) return false;
  if (state.manualExclude.has(sentence.id)) return false;
  if (state.manualInclude.has(sentence.id)) return true;
  return semanticScore(sentence) >= state.threshold;
}

function apertureInfo() {
  if (state.aperture < 34) return { depth: "Shallow", stop: "f/2.8" };
  if (state.aperture < 68) return { depth: "Medium", stop: "f/5.6" };
  return { depth: "Deep", stop: "f/11" };
}

function relevanceClass(sentence) {
  const score = semanticScore(sentence);
  if (score >= 0.8) return "near-plane";
  if (score >= 0.55) return "mid-plane";
  return "far-plane";
}

function refresh() {
  [baseLayer, lensLayer].forEach(layer => {
    layer.querySelectorAll(".sentence").forEach(element => {
      const sentence = getSentence(element.dataset.id);
      element.className = "sentence";

      if (sentence.id === state.focusId) element.classList.add("focused");
      if (isInFocus(sentence)) element.classList.add("semantic", relevanceClass(sentence));
      if (state.manualInclude.has(sentence.id)) element.classList.add("manual-include");
      if (state.manualExclude.has(sentence.id)) element.classList.add("manual-exclude");
      if (state.toneBySentence.has(sentence.id) || sentence.id === state.focusId) {
        element.classList.add(`tone-${effectiveTone(sentence.id)}`);
      }

      element.textContent = displayText(sentence);
    });
  });

  const inFocus = state.focusId ? flattenSentences().filter(isInFocus) : [];
  const aperture = apertureInfo();
  const frameIndex = frameOptions.indexOf(state.frame);
  const intentIndex = Math.max(0, intentOptions.indexOf(state.focusIssue));
  const radius = 112 + state.aperture * 1.12;

  state.threshold = 0.95 - state.aperture * 0.006;
  editor.style.setProperty("--lens-r", `${radius}px`);
  intentDial.style.setProperty("--dial-rotation", `${-95 + intentIndex * 95}deg`);
  frameDial.style.setProperty("--dial-rotation", `${-95 + frameIndex * 95}deg`);
  apertureDial.style.setProperty("--dial-rotation", `${-125 + state.aperture * 2.5}deg`);

  frameValue.textContent = state.frame[0].toUpperCase() + state.frame.slice(1);
  intentValue.textContent = state.focusIssue ? intentLabels[state.focusIssue] : "Auto";
  depthValue.textContent = `${aperture.stop} · ${aperture.depth}`;
  lensDepth.textContent = aperture.stop;
  focusValue.textContent = state.focusId ? state.focusId.toUpperCase() : "—";
  focusCount.textContent = String(inFocus.length);

  if (state.focusId) {
    const tone = effectiveTone(state.focusId);
    toneStrip.classList.remove("hidden");
    toneValue.textContent = toneTreatments[tone].label.toUpperCase();
    tonePreviewValue.textContent = `${toneTreatments[tone].label} · ${toneTreatments[tone].descriptor}`;
    document.querySelectorAll(".tone-option").forEach(button => {
      button.classList.toggle("active", button.dataset.tone === tone);
    });
    document.body.dataset.tone = tone;
    document.body.classList.add("tone-active");
  } else {
    toneStrip.classList.add("hidden");
    toneValue.textContent = "—";
    document.body.dataset.tone = "none";
    document.body.classList.remove("tone-active");
  }

  document.body.dataset.issue = state.focusIssue || "none";
}

function setLensPosition(x, y) {
  const radius = 112 + state.aperture * 1.12;
  const maxX = Math.max(radius, editor.scrollWidth - radius);
  const maxY = Math.max(radius, editor.scrollHeight - radius);
  editor.style.setProperty("--lens-x", `${Math.min(Math.max(x, radius), maxX)}px`);
  editor.style.setProperty("--lens-y", `${Math.min(Math.max(y, radius), maxY)}px`);
}

function lockLensToSentence(id) {
  const element = baseLayer.querySelector(`[data-id="${id}"]`);
  if (!element) return;
  const elementRect = element.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  setLensPosition(
    elementRect.left - editorRect.left + editor.scrollLeft + elementRect.width / 2,
    elementRect.top - editorRect.top + editor.scrollTop + elementRect.height / 2
  );
}

function onSentenceClick(event, id) {
  event.stopPropagation();

  if (event.shiftKey && state.focusId && id !== state.focusId) {
    const sentence = getSentence(id);
    if (state.manualInclude.has(id)) {
      state.manualInclude.delete(id);
      state.manualExclude.add(id);
    } else if (state.manualExclude.has(id)) {
      state.manualExclude.delete(id);
    } else if (isInFocus(sentence)) {
      state.manualExclude.add(id);
    } else {
      state.manualInclude.add(id);
    }
    refresh();
    return;
  }

  const sentence = getSentence(id);
  state.focusId = id;
  state.focusIssue = sentence.issue;
  state.previewTone = null;
  state.manualInclude.clear();
  state.manualExclude.clear();
  issueTitle.textContent = issueLabels[sentence.issue];
  lockLensToSentence(id);
  refresh();
}

function setAperture(value) {
  state.aperture = Math.min(100, Math.max(0, value));
  state.threshold = 0.95 - state.aperture * 0.006;
  refresh();
}

editor.addEventListener("mousemove", event => {
  if (!event.ctrlKey) return;
  const rect = editor.getBoundingClientRect();
  setLensPosition(
    event.clientX - rect.left + editor.scrollLeft,
    event.clientY - rect.top + editor.scrollTop
  );
});

editor.addEventListener("wheel", event => {
  event.preventDefault();
  if (event.shiftKey) {
    editor.scrollTop += event.deltaY;
    return;
  }
  const direction = event.deltaY > 0 ? 1 : -1;
  setAperture(state.aperture + direction * 4);
}, { passive: false });

frameDial.addEventListener("click", () => {
  const index = frameOptions.indexOf(state.frame);
  state.frame = frameOptions[(index + 1) % frameOptions.length];
  refresh();
});

intentDial.addEventListener("click", () => {
  if (!state.focusId) {
    issueTitle.textContent = "Set a focal sentence before changing intent";
    return;
  }
  const index = intentOptions.indexOf(state.focusIssue);
  state.focusIssue = intentOptions[(index + 1) % intentOptions.length];
  state.manualInclude.clear();
  state.manualExclude.clear();
  issueTitle.textContent = issueLabels[state.focusIssue];
  refresh();
});

apertureDial.addEventListener("click", () => {
  const next = apertureStops.find(stop => stop > state.aperture + 2) ?? apertureStops[0];
  setAperture(next);
});

apertureDial.addEventListener("keydown", event => {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") setAperture(state.aperture + 4);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") setAperture(state.aperture - 4);
});

colorToggle.addEventListener("click", () => {
  state.color = !state.color;
  document.body.classList.toggle("color-on", state.color);
  colorToggle.setAttribute("aria-pressed", String(state.color));
  colorModeValue.textContent = state.color ? "Color" : "Mono";
  colorHudValue.textContent = state.color ? "COLOR" : "MONO";
});

function previewTone(tone) {
  if (!state.focusId) return;
  state.previewTone = tone;
  refresh();
}

function clearTonePreview() {
  if (!state.previewTone) return;
  state.previewTone = null;
  refresh();
}

function commitTone(tone) {
  if (!state.focusId) return;
  state.toneBySentence.set(state.focusId, tone);
  state.previewTone = null;
  refresh();
  issueTitle.textContent = `${issueLabels[state.focusIssue]} · ${toneTreatments[tone].label} treatment`;
}

document.querySelectorAll(".tone-option").forEach(button => {
  const tone = button.dataset.tone;
  button.addEventListener("mouseenter", () => previewTone(tone));
  button.addEventListener("focus", () => previewTone(tone));
  button.addEventListener("click", () => commitTone(tone));
});

document.querySelector(".tone-options").addEventListener("mouseleave", clearTonePreview);
toneStrip.addEventListener("focusout", event => {
  if (!toneStrip.contains(event.relatedTarget)) clearTonePreview();
});

function revisionCard(title, intent, key, ids, number) {
  const card = document.createElement("button");
  card.className = `revision-card${key === state.selectedTake ? " selected" : ""}`;
  card.type = "button";
  card.dataset.take = key;

  const rows = ids.map(id => {
    const original = getSentence(id).text;
    const revised = toneVariants[id]?.[key] || original;
    return `
      <div class="revision-pair">
        <div class="before">${original}</div>
        <div class="after">${revised}</div>
      </div>
    `;
  }).join("");

  card.innerHTML = `<span class="take-number">0${number}</span><h2>${title}</h2><p class="intent">${intent}</p>${rows}`;
  card.addEventListener("click", () => selectTake(key));
  return card;
}

function selectTake(key) {
  state.selectedTake = key;
  revisionCards.querySelectorAll(".revision-card").forEach(card => card.classList.toggle("selected", card.dataset.take === key));
  takeHint.textContent = `${toneTreatments[key].label} treatment selected`;
}

function showContactSheet() {
  if (!state.focusId) {
    issueTitle.textContent = "Set a focal sentence before capturing";
    return;
  }

  state.capturedIds = flattenSentences().filter(isInFocus).map(sentence => sentence.id);
  const currentTone = selectedTone(state.focusId);
  state.selectedTake = currentTone;
  const editableIds = state.capturedIds.filter(id => toneVariants[id]).slice(0, 4);
  const aperture = apertureInfo();

  const toneOrder = ["clinical", "restrained", "balanced", "warm", "expressive"];
  const currentIndex = toneOrder.indexOf(currentTone);
  const start = Math.max(0, Math.min(currentIndex - 1, toneOrder.length - 3));
  const takes = toneOrder.slice(start, start + 3);

  capturedSummary.textContent = `${toneTreatments[currentTone].label} tone · ${aperture.depth} depth · ${state.capturedIds.length} sentences`;
  capturedStrip.innerHTML = state.capturedIds.map(id => `<span>${id.toUpperCase()}</span>`).join("");
  revisionCards.innerHTML = "";
  takes.forEach((tone, index) => {
    revisionCards.appendChild(revisionCard(toneTreatments[tone].label, toneTreatments[tone].descriptor, tone, editableIds, index + 1));
  });
  takeHint.textContent = `${toneTreatments[currentTone].label} treatment selected`;

  contactSheet.classList.remove("hidden");
  document.body.classList.add("modal-open");
  document.getElementById("closeSheet").focus();
}

function closeContactSheet() {
  contactSheet.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.getElementById("shutter").focus();
}

document.getElementById("shutter").addEventListener("click", showContactSheet);
document.getElementById("closeSheet").addEventListener("click", closeContactSheet);

document.getElementById("useTake").addEventListener("click", () => {
  state.capturedIds.forEach(id => {
    if (toneVariants[id]?.[state.selectedTake]) state.toneBySentence.set(id, state.selectedTake);
  });
  renderLayer(baseLayer, true);
  renderLayer(lensLayer, false);
  refresh();
  lockLensToSentence(state.focusId);
  closeContactSheet();
  issueTitle.textContent = `${toneTreatments[state.selectedTake].label} treatment applied to captured frame`;
});

document.addEventListener("keydown", event => {
  document.body.classList.toggle("reframing", event.ctrlKey);
  if (event.key === "Escape" && !contactSheet.classList.contains("hidden")) closeContactSheet();
});

document.addEventListener("keyup", event => {
  if (!event.ctrlKey) document.body.classList.remove("reframing");
});

renderLayer(baseLayer, true);
renderLayer(lensLayer, false);
refresh();
