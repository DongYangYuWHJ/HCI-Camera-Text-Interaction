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
          { id: "s2", issue: "scope", score: 0.42, text: "Most interfaces, however, still ask writers to select a passage and issue a textual instruction." },
          { id: "s3", issue: "absolute", score: 0.91, text: "These systems always interpret the writer's revision intent correctly when enough context is provided." }
        ],
        [
          { id: "s4", issue: "transition", score: 0.38, text: "The resulting interaction can feel disconnected from the writer's evolving understanding of the document." },
          { id: "s5", issue: "absolute", score: 0.82, text: "Prompt-based revision guarantees consistent changes across a document once a suitable instruction has been written." },
          { id: "s6", issue: "scope", score: 0.56, text: "In practice, a writer may want one discovered problem to guide a broader inspection without authorizing a full rewrite." }
        ]
      ]
    },
    {
      id: "design",
      title: "2. Design Rationale",
      paragraphs: [
        [
          { id: "s7", issue: "scope", score: 0.49, text: "Photography offers a vocabulary for deciding what deserves attention and how much surrounding context should remain visible." },
          { id: "s8", issue: "absolute", score: 0.73, text: "A semantic lens can eliminate uncertainty about which related passages the model will modify." },
          { id: "s9", issue: "transition", score: 0.35, text: "The writer can then inspect the model's interpretation before committing to a change." }
        ],
        [
          { id: "s10", issue: "absolute", score: 0.64, text: "This interaction significantly improves writer control in every revision scenario." },
          { id: "s11", issue: "scope", score: 0.47, text: "Rather than exposing relevance as a numeric threshold, the interface can represent it as semantic depth of field." },
          { id: "s12", issue: "absolute", score: 0.44, text: "The resulting workflow may increase consistency while still preserving the writer's authority over the final text." }
        ]
      ]
    }
  ]
};

const issueLabels = {
  absolute: "Overly absolute / categorical claims",
  scope: "Revision scope / propagation",
  transition: "Argument continuity / transitions"
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

const state = {
  focusId: null,
  focusIssue: null,
  frame: "document",
  threshold: 0.66,
  manualInclude: new Set(),
  manualExclude: new Set()
};

const editor = document.getElementById("editor");
const baseLayer = document.getElementById("baseLayer");
const lensLayer = document.getElementById("lensLayer");
const aperture = document.getElementById("aperture");
const thresholdText = document.getElementById("thresholdText");
const focusCount = document.getElementById("focusCount");
const issueTitle = document.getElementById("issueTitle");
const frameValue = document.getElementById("frameValue");
const depthValue = document.getElementById("depthValue");
const focusValue = document.getElementById("focusValue");
const instanceList = document.getElementById("instanceList");
const contactSheet = document.getElementById("contactSheet");
const revisionCards = document.getElementById("revisionCards");

function flattenSentences() {
  return model.sections.flatMap(sec => sec.paragraphs.flatMap(p => p));
}

function getSentence(id) {
  return flattenSentences().find(s => s.id === id);
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
    const secEl = document.createElement("section");
    secEl.className = "section";
    secEl.dataset.section = section.id;

    const h = document.createElement("h3");
    h.className = "section-title";
    h.textContent = section.title;
    secEl.appendChild(h);

    section.paragraphs.forEach((sentences, pIndex) => {
      const p = document.createElement("p");
      p.className = "paragraph";
      p.dataset.paragraph = `${section.id}-${pIndex}`;

      sentences.forEach((sentence, i) => {
        const span = document.createElement("span");
        span.className = "sentence";
        span.dataset.id = sentence.id;
        span.textContent = sentence.text;

        if (interactive) {
          span.addEventListener("click", e => onSentenceClick(e, sentence.id));
        }

        p.appendChild(span);
        if (i < sentences.length - 1) p.appendChild(document.createTextNode(" "));
      });

      secEl.appendChild(p);
    });

    layer.appendChild(secEl);
  });
}

renderLayer(baseLayer, true);
renderLayer(lensLayer, false);

function getFrameIds() {
  if (!state.focusId) return new Set(flattenSentences().map(s => s.id));

  const focusEl = baseLayer.querySelector(`[data-id="${state.focusId}"]`);
  if (!focusEl) return new Set();

  if (state.frame === "document") {
    return new Set(flattenSentences().map(s => s.id));
  }

  if (state.frame === "section") {
    return new Set(
      [...focusEl.closest(".section").querySelectorAll(".sentence")]
        .map(el => el.dataset.id)
    );
  }

  return new Set(
    [...focusEl.closest(".paragraph").querySelectorAll(".sentence")]
      .map(el => el.dataset.id)
  );
}

function semanticScore(sentence) {
  if (!state.focusId || !state.focusIssue) return 0;
  if (sentence.id === state.focusId) return 1;
  if (sentence.issue === state.focusIssue) return sentence.score;

  // deterministic low score for unrelated content
  const seed = sentence.id.charCodeAt(sentence.id.length - 1);
  return 0.18 + (seed % 16) / 100;
}

function isInFocus(sentence) {
  if (!state.focusId) return false;

  const frameIds = getFrameIds();
  if (!frameIds.has(sentence.id)) return false;

  if (state.manualExclude.has(sentence.id)) return false;
  if (state.manualInclude.has(sentence.id)) return true;

  return semanticScore(sentence) >= state.threshold;
}

function depthLabel() {
  if (state.threshold >= 0.79) return "Shallow";
  if (state.threshold >= 0.55) return "Medium";
  return "Deep";
}

function refresh() {
  [baseLayer, lensLayer].forEach(layer => {
    layer.querySelectorAll(".sentence").forEach(el => {
      const sentence = getSentence(el.dataset.id);

      el.classList.remove("semantic", "focused", "manual-include", "manual-exclude");

      if (sentence.id === state.focusId) el.classList.add("focused");
      if (isInFocus(sentence) && sentence.id !== state.focusId) el.classList.add("semantic");
      if (state.manualInclude.has(sentence.id)) el.classList.add("manual-include");
      if (state.manualExclude.has(sentence.id)) el.classList.add("manual-exclude");
    });
  });

  updateInspector();
}

function updateInspector() {
  const items = state.focusId
    ? flattenSentences().filter(isInFocus).sort((a, b) => semanticScore(b) - semanticScore(a))
    : [];

  thresholdText.textContent = `threshold ${state.threshold.toFixed(2)}`;
  focusCount.textContent = `${items.length} in focus`;
  frameValue.textContent = state.frame[0].toUpperCase() + state.frame.slice(1);
  depthValue.textContent = depthLabel();
  focusValue.textContent = state.focusId ? state.focusId.toUpperCase() : "—";

  if (!state.focusId) {
    instanceList.className = "instance-list empty";
    instanceList.textContent = "Set a focus first.";
    return;
  }

  instanceList.className = "instance-list";
  instanceList.innerHTML = "";

  items.forEach(sentence => {
    const card = document.createElement("div");
    card.className = "instance";

    let source = "model";
    if (sentence.id === state.focusId) source = "focal";
    if (state.manualInclude.has(sentence.id)) source = "manual include";

    card.innerHTML = `
      <div class="instance-head">
        <span>${sentence.id.toUpperCase()} · ${source}</span>
        <span>${semanticScore(sentence).toFixed(2)}</span>
      </div>
      <p>${sentence.text}</p>
    `;

    instanceList.appendChild(card);
  });
}

function onSentenceClick(event, id) {
  event.stopPropagation();

  if (event.shiftKey && state.focusId) {
    if (id === state.focusId) return;

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
  state.manualInclude.clear();
  state.manualExclude.clear();

  issueTitle.textContent = issueLabels[sentence.issue];
  refresh();
}

function moveLens(clientX, clientY) {
  const rect = editor.getBoundingClientRect();
  const x = clientX - rect.left + editor.scrollLeft;
  const y = clientY - rect.top + editor.scrollTop;

  editor.style.setProperty("--lens-x", `${x}px`);
  editor.style.setProperty("--lens-y", `${y}px`);
}

editor.addEventListener("mousemove", e => {
  moveLens(e.clientX, e.clientY);
  document.getElementById("lensRing").style.opacity = "1";
});

editor.addEventListener("mouseenter", e => {
  moveLens(e.clientX, e.clientY);
  document.getElementById("lensRing").style.opacity = "1";
});

editor.addEventListener("mouseleave", () => {
  document.getElementById("lensRing").style.opacity = ".2";
});

aperture.addEventListener("input", () => {
  const v = Number(aperture.value);

  // Shallow -> high threshold, Deep -> low threshold
  state.threshold = 0.95 - v * 0.006;

  // Also make the physical lens larger, so the gesture visibly feels camera-like
  const radius = 105 + v * 1.15;
  editor.style.setProperty("--lens-r", `${radius}px`);

  refresh();
});

document.querySelectorAll("[data-frame]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-frame]").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    state.frame = button.dataset.frame;
    refresh();
  });
});

function revisionCard(title, intent, key, ids) {
  const card = document.createElement("div");
  card.className = "revision-card";

  const rows = ids.map(id => {
    const original = getSentence(id).text;
    const revised = revisions[id]?.[key] || original;
    return `
      <div class="revision-pair">
        <div class="before">${original}</div>
        <div class="after">${revised}</div>
      </div>
    `;
  }).join("");

  card.innerHTML = `
    <h3>${title}</h3>
    <div class="intent">${intent}</div>
    ${rows}
  `;

  return card;
}

document.getElementById("shutter").addEventListener("click", () => {
  if (!state.focusId) {
    issueTitle.textContent = "Set a focus before pressing Shutter";
    return;
  }

  let ids = flattenSentences()
    .filter(isInFocus)
    .map(s => s.id)
    .filter(id => revisions[id])
    .slice(0, 4);

  if (!ids.length && revisions[state.focusId]) ids = [state.focusId];

  revisionCards.innerHTML = "";
  revisionCards.appendChild(revisionCard("Conservative", "Minimal intervention", "conservative", ids));
  revisionCards.appendChild(revisionCard("Balanced", "Preserve voice, clarify claims", "balanced", ids));
  revisionCards.appendChild(revisionCard("Strong", "Reframe the issue more aggressively", "strong", ids));

  contactSheet.classList.remove("hidden");
  contactSheet.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("closeSheet").addEventListener("click", () => {
  contactSheet.classList.add("hidden");
});

refresh();
