(function (root) {
  "use strict";

  const sentenceNotes = {
    s1: "Introduces the impact of LLMs on long-form revision.",
    s2: "Describes the passage-and-prompt interaction used by existing tools.",
    s3: "Claims that context helps a system interpret revision intent.",
    s4: "Identifies a gap between the interface and the writer's evolving understanding.",
    s5: "Connects a revision prompt with consistency across the document.",
    s6: "Calls for broader inspection of a local problem before rewriting.",
    s7: "Uses photography to explain attention and visible context.",
    s8: "Proposes making related passages visible through a semantic lens.",
    s9: "Places inspection before the writer commits to a change.",
    s10: "Connects the interaction with greater writer control.",
    s11: "Represents relevance through semantic depth of field.",
    s12: "Concludes with consistency and the writer's final authority."
  };

  const paragraphNotes = {
    "s1,s2,s3": {
      label: "The current workflow",
      summary: "LLM revision is framed around selecting a passage, supplying a prompt, and interpreting intent."
    },
    "s4,s5,s6": {
      label: "The missing connection",
      summary: "One local concern should guide a broader inspection while the writer retains control over rewriting."
    },
    "s7,s8,s9": {
      label: "A photographic approach",
      summary: "Photography makes attention and related passages visible, so the writer can inspect before committing."
    },
    "s10,s11,s12": {
      label: "The intended outcome",
      summary: "Semantic depth of field aims to support consistency while preserving the writer's final authority."
    }
  };

  function indexedSentences(model) {
    return (model.sections || []).flatMap(section =>
      section.paragraphs.flatMap((paragraph, paragraphIndex) =>
        paragraph.map(sentence => ({
          ...sentence,
          sectionTitle: section.title,
          paragraphId: `${section.id}-${paragraphIndex}`,
          paragraphIds: paragraph.map(item => item.id)
        }))
      )
    );
  }

  // This demo uses authored summaries of the sample draft, not an AI service.
  // Endpoints are inclusive; sweeping backwards normalizes the reading order.
  function summarizeRange(model, startId, endId) {
    const sentences = indexedSentences(model);
    const start = sentences.findIndex(sentence => sentence.id === startId);
    const end = sentences.findIndex(sentence => sentence.id === endId);
    if (start < 0 || end < 0) return { summary: "", steps: [], sentenceIds: [] };
    const selected = sentences.slice(Math.min(start, end), Math.max(start, end) + 1);
    const groups = [];
    selected.forEach(sentence => {
      let group = groups[groups.length - 1];
      if (!group || group.id !== sentence.paragraphId) {
        group = { id: sentence.paragraphId, sentences: [] };
        groups.push(group);
      }
      group.sentences.push(sentence);
    });
    const steps = groups.map(group => {
      const first = group.sentences[0];
      const full = paragraphNotes[first.paragraphIds.join(",")];
      const complete = group.sentences.length === first.paragraphIds.length;
      const notes = group.sentences.map(sentence => sentenceNotes[sentence.id] || sentence.text);
      return {
        id: group.id,
        label: full?.label || first.sectionTitle || "Ideas in view",
        summary: complete && full ? full.summary : notes.join(" ")
      };
    });
    return {
      summary: steps.map(step => step.summary).join(" "),
      steps,
      sentenceIds: selected.map(sentence => sentence.id)
    };
  }

  class PanoCamera {
    constructor({ editor, baseLayer, model, onChange }) {
      this.editor = editor;
      this.baseLayer = baseLayer;
      this.model = model;
      this.onChange = onChange || (() => {});
      this.panel = document.getElementById("panoPanel");
      this.active = false;
      this.startId = null;
      this.endId = null;
      this.captured = false;
      this.scrollFrame = null;
      this.panel.innerHTML = `
        <div class="pano-heading">
          <div class="pano-heading-copy"><span class="pano-kicker">PANO / IDEA SWEEP</span><span class="pano-live-state">Framing</span></div>
          <div class="pano-range-controls">
            <span class="pano-range-label"></span>
            <button type="button" class="pano-start-button" title="Use the current endpoint as a new starting point">Start here</button>
            <button type="button" class="pano-reset-button" title="Start from the first sentence">From beginning</button>
          </div>
        </div>
        <ol class="pano-steps" aria-label="Argument progression"></ol>
        <div class="pano-summary-row"><span class="pano-summary-label">Example summary</span><p class="pano-summary" aria-live="polite" aria-atomic="true"></p></div>
        <p class="pano-guidance">Scroll or click a sentence to extend the sweep. Press the shutter to save this view.</p>`;
      this.rangeLabel = this.panel.querySelector(".pano-range-label");
      this.liveState = this.panel.querySelector(".pano-live-state");
      this.stepsElement = this.panel.querySelector(".pano-steps");
      this.summaryElement = this.panel.querySelector(".pano-summary");
      this.panel.querySelector(".pano-start-button").addEventListener("click", () => this.setStart(this.endId));
      this.panel.querySelector(".pano-reset-button").addEventListener("click", () => this.setStart(this.ids()[0]));
      this.editor.addEventListener("scroll", () => {
        if (!this.active || this.scrollFrame !== null) return;
        this.scrollFrame = requestAnimationFrame(() => {
          this.scrollFrame = null;
          this.updateFromScroll();
        });
      }, { passive: true });
    }

    ids() { return indexedSentences(this.model).map(sentence => sentence.id); }

    enter(focusId) {
      const ids = this.ids();
      this.active = true;
      this.panel.classList.remove("hidden");
      this.setStart(ids.includes(focusId) ? focusId : ids[0]);
    }

    exit() {
      this.active = false;
      this.panel.classList.add("hidden");
      this.baseLayer.querySelectorAll(".pano-range").forEach(element => element.classList.remove("pano-range"));
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }

    setStart(id) {
      if (!this.ids().includes(id)) return;
      this.startId = id;
      this.endId = id;
      this.captured = false;
      this.refresh();
      this.notify();
    }

    selectEnd(id) {
      if (!this.active || !this.ids().includes(id)) return;
      const changed = id !== this.endId;
      this.endId = id;
      this.captured = false;
      this.refresh();
      if (changed) this.notify();
    }

    updateFromScroll() {
      if (!this.active) return;
      const viewport = this.editor.getBoundingClientRect();
      const ids = this.ids();
      const startIndex = ids.indexOf(this.startId);
      let lastVisible = null;
      this.baseLayer.querySelectorAll(".sentence[data-id]").forEach(element => {
        if (ids.indexOf(element.dataset.id) < startIndex) return;
        const rects = [...element.getClientRects()];
        if (rects.some(rect => rect.bottom > viewport.top + 10 && rect.top < viewport.bottom - 18)) {
          lastVisible = element.dataset.id;
        }
      });
      if (lastVisible && lastVisible !== this.endId) this.selectEnd(lastVisible);
    }

    snapshot() {
      return { kind: "pano", startId: this.startId, endId: this.endId, ...summarizeRange(this.model, this.startId, this.endId) };
    }

    notify() { this.onChange(this.snapshot()); }

    refresh() {
      if (!this.active) return;
      const result = this.snapshot();
      const selected = new Set(result.sentenceIds);
      this.baseLayer.querySelectorAll(".sentence[data-id]").forEach(element => {
        element.classList.toggle("pano-range", selected.has(element.dataset.id));
      });
      const count = result.sentenceIds.length;
      const first = result.sentenceIds[0];
      const last = result.sentenceIds[count - 1];
      this.rangeLabel.textContent = count ? `${first.toUpperCase()}–${last.toUpperCase()} · ${count} ${count === 1 ? "sentence" : "sentences"}` : "Choose a starting sentence";
      this.liveState.textContent = this.captured ? "Captured" : "Framing";
      this.panel.classList.toggle("is-captured", this.captured);
      this.summaryElement.textContent = result.summary || "Choose a sentence to begin tracing the argument.";
      this.stepsElement.replaceChildren(...result.steps.map((step, index) => {
        const item = document.createElement("li");
        item.className = "pano-step";
        item.title = step.summary;
        const number = document.createElement("span");
        number.className = "pano-step-number";
        number.textContent = String(index + 1).padStart(2, "0");
        const label = document.createElement("span");
        label.textContent = step.label;
        item.append(number, label);
        return item;
      }));
    }

    capture() {
      if (!this.active || !this.startId || !this.endId) return null;
      // A scroll event may still be waiting for the next animation frame when
      // the shutter is pressed. Flush it so the saved range matches the view.
      if (this.scrollFrame !== null) {
        cancelAnimationFrame(this.scrollFrame);
        this.scrollFrame = null;
        this.updateFromScroll();
      }
      this.captured = true;
      this.refresh();
      return { ...this.snapshot(), createdAt: new Date().toISOString() };
    }
  }

  root.PanoCamera = PanoCamera;
  root.summarizePanoRange = summarizeRange;
  if (typeof module !== "undefined" && module.exports) module.exports = { PanoCamera, summarizeRange };
})(typeof window !== "undefined" ? window : globalThis);
