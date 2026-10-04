(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SemanticCamera = api.SemanticCamera;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FRAMES = new Set(["sentence", "paragraph", "section", "document"]);
  const plain = value => value !== null && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const freeze = value => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const copy = value => JSON.parse(JSON.stringify(value));

  /** Deterministic prototype data, not a semantic model or a writing service. */
  class SemanticCamera {
    constructor({ sentences, toneVariants = {} }) {
      if (!Array.isArray(sentences) || sentences.some(item => !plain(item) ||
          typeof item.id !== "string" || typeof item.text !== "string")) {
        throw new TypeError("Sentences must have string ids and text.");
      }
      this.sentences = freeze(sentences.map(sentence => ({ ...sentence })));
      this._sentences = new Map(this.sentences.map(sentence => [sentence.id, sentence]));
      if (this._sentences.size !== sentences.length) throw new TypeError("Sentence ids must be unique.");
      this.toneVariants = freeze(copy(toneVariants));
      this._tones = new Set(["balanced", ...Object.values(toneVariants).flatMap(Object.keys)]);
      this._issues = new Set(sentences.map(sentence => sentence.issue));
      this.focusId = null;
      this.focusIssue = null;
      this.frame = "document";
      this.aperture = 48;
      this.color = true;
      this.draftTone = null;
      this.hoverTone = null;
      this.manualInclude = new Set();
      this.manualExclude = new Set();
      this.committed = new Map();
      this.committedText = new Map();
      this.manualDrafts = new Map();
      this.captures = [];
      this.undoStack = [];
      this.redoStack = [];
    }

    get toneBySentence() { return this.committed; }
    // The tightest aperture isolates the focal passage; the widest still
    // includes the weakest prepared semantic match in this prototype.
    get threshold() { return 1.001 - this.aperture * 0.006; }

    focus(id, { preserveIntent = false } = {}) {
      const sentence = this._sentences.get(id);
      if (!sentence) return false;
      this.focusId = id;
      if (!preserveIntent || !this.focusIssue) this.focusIssue = sentence.issue;
      this.hoverTone = null;
      this.resetMembership();
      return true;
    }

    setIntent(issue) {
      if (!this._issues.has(issue)) return false;
      this.focusIssue = issue;
      this.resetMembership();
      return true;
    }

    setFrame(frame) {
      if (!FRAMES.has(frame)) return false;
      this.frame = frame;
      return true;
    }

    setAperture(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      this.aperture = Math.min(100, Math.max(0, value));
      return true;
    }

    setTone(tone) {
      if (tone !== null && !this._tones.has(tone)) return false;
      this.draftTone = tone;
      this.hoverTone = null;
      return true;
    }

    preview(tone) {
      if (tone !== null && !this._tones.has(tone)) return false;
      this.hoverTone = tone;
      return true;
    }

    discardPreview() {
      this.draftTone = null;
      this.hoverTone = null;
      this.manualDrafts.clear();
    }

    setManualDraft(id, text) {
      if (!this._sentences.has(id) || typeof text !== "string") return false;
      this.manualDrafts.set(id, text);
      return true;
    }

    clearManualDraft(id) { return this.manualDrafts.delete(id); }
    hasManualDraft(id) { return this.manualDrafts.has(id); }

    inFrame(id) {
      const sentence = this._sentences.get(id);
      const focal = this._sentences.get(this.focusId);
      if (!sentence || !focal) return false;
      if (this.frame === "sentence") return id === this.focusId;
      if (this.frame === "paragraph") {
        return sentence.sectionId === focal.sectionId && sentence.paragraphId === focal.paragraphId;
      }
      if (this.frame === "section") return sentence.sectionId === focal.sectionId;
      return true;
    }

    score(id) {
      const sentence = this._sentences.get(id);
      if (!sentence || !this.focusId || !this.focusIssue) return 0;
      if (id === this.focusId) return 1;
      if (sentence.issue === this.focusIssue) {
        return Math.min(1, Math.max(0, Number(sentence.score) || 0));
      }
      return 0.18 + (id.charCodeAt(id.length - 1) % 16) / 100;
    }

    inFocus(id) {
      if (!this.inFrame(id)) return false;
      if (this.manualExclude.has(id)) return false;
      if (this.manualInclude.has(id)) return true;
      if (id === this.focusId) return true;
      return this.score(id) >= this.threshold;
    }

    includedIds() { return this.sentences.filter(sentence => this.inFocus(sentence.id)).map(sentence => sentence.id); }

    reason(id) {
      if (!this._sentences.has(id)) return "Unknown sentence";
      if (!this.focusId) return "Choose a focal sentence first";
      if (!this.inFrame(id)) return "Outside the current frame";
      if (id === this.focusId && this.manualExclude.has(id)) return "Focal reference · left unchanged";
      if (id === this.focusId) return "Focal reference · selected for change";
      if (this.manualExclude.has(id)) return "Manually excluded";
      if (this.manualInclude.has(id)) return "Manually included";
      if (this._sentences.get(id).issue !== this.focusIssue) return "Different issue category · outside semantic depth";
      return this.inFocus(id) ? "Same issue category · within semantic depth" : "Same issue category · beyond semantic depth";
    }

    toggleMembership(id) {
      if (!this.inFrame(id)) return false;
      const wasIncluded = this.inFocus(id);
      this.manualInclude.delete(id);
      this.manualExclude.delete(id);
      if (wasIncluded) this.manualExclude.add(id);
      else this.manualInclude.add(id);
      return true;
    }

    resetMembership() {
      this.manualInclude.clear();
      this.manualExclude.clear();
    }

    displayedTone(id) {
      if (!this._sentences.has(id)) return null;
      if (this.inFocus(id) && (this.hoverTone || this.draftTone)) return this.hoverTone || this.draftTone;
      return this.committed.get(id) || "balanced";
    }

    _textForTone(id, tone) {
      const sentence = this._sentences.get(id);
      if (!sentence) return "";
      return tone === null ? sentence.text : (this.toneVariants[id]?.[tone] ?? sentence.text);
    }

    text(id, { committed = false } = {}) {
      if (!committed && this.inFocus(id) && this.manualDrafts.has(id)) return this.manualDrafts.get(id);
      if (!committed && this.inFocus(id) && (this.hoverTone || this.draftTone)) {
        return this._textForTone(id, this.hoverTone || this.draftTone);
      }
      if (this.committedText.has(id)) return this.committedText.get(id);
      return this._textForTone(id, this.committed.get(id) ?? null);
    }

    pendingIds() {
      return this.includedIds().filter(id => this.text(id) !== this.text(id, { committed: true }));
    }

    _snapshot() {
      const ids = new Set([...this.committed.keys(), ...this.committedText.keys()]);
      return [...ids].map(id => this.committedText.has(id)
        ? [id, this.committed.get(id) ?? null, this.committedText.get(id)]
        : [id, this.committed.get(id)]);
    }

    _loadSnapshot(snapshot) {
      this.committed.clear();
      this.committedText.clear();
      snapshot.forEach(([id, tone, text]) => {
        if (tone !== null && tone !== undefined) this.committed.set(id, tone);
        if (typeof text === "string") this.committedText.set(id, text);
      });
    }

    _record(kind, before, detail) {
      const operation = freeze({ kind, ...detail, before, after: this._snapshot() });
      this.undoStack.push(operation);
      this.redoStack = [];
      return operation;
    }

    capture() {
      const tone = this.hoverTone || this.draftTone;
      const includedIds = this.includedIds();
      const pendingIds = this.pendingIds();
      if (pendingIds.length === 0) {
        this.discardPreview();
        return null;
      }
      const before = this._snapshot();
      const capture = freeze({
        id: String(this.captures.length + 1).padStart(2, "0"),
        kind: "style",
        focusId: this.focusId,
        focusIssue: this.focusIssue,
        frame: this.frame,
        aperture: this.aperture,
        tone,
        includedIds,
        excludedIds: this.sentences.filter(sentence => this.inFrame(sentence.id) && !this.inFocus(sentence.id)).map(sentence => sentence.id),
        changes: pendingIds.map(id => {
          const manualText = this.manualDrafts.get(id) ?? null;
          return {
            id,
            before: this.text(id, { committed: true }),
            after: this.text(id),
            beforeTone: this.committed.get(id) ?? null,
            afterTone: manualText === null ? tone : tone || this.committed.get(id) || null,
            beforeCustomText: this.committedText.get(id) ?? null,
            afterCustomText: manualText
          };
        }),
        createdAt: new Date().toISOString()
      });
      capture.changes.forEach(change => this._applyChangeState(change.id, change.afterTone, change.afterCustomText));
      this.captures.push(capture);
      this._record("capture", before, { captureId: capture.id });
      this.discardPreview();
      return capture;
    }

    undo() {
      this.discardPreview();
      const operation = this.undoStack.pop();
      if (!operation) return null;
      this._loadSnapshot(operation.before);
      this.redoStack.push(operation);
      return operation;
    }

    redo() {
      this.discardPreview();
      const operation = this.redoStack.pop();
      if (!operation) return null;
      this._loadSnapshot(operation.after);
      this.undoStack.push(operation);
      return operation;
    }

    restoreCapture(captureId) {
      const capture = this.captures.find(item => item.id === captureId);
      if (!capture) return null;
      this.discardPreview();
      const changes = capture.changes.filter(change => this.text(change.id, { committed: true }) !== change.after);
      if (!changes.length) return null;
      const before = this._snapshot();
      changes.forEach(change => this._applyChangeState(change.id, change.afterTone, change.afterCustomText ?? null));
      return this._record("restore", before, { captureId });
    }

    _applyChangeState(id, tone, customText) {
      if (tone === null || tone === undefined) this.committed.delete(id);
      else this.committed.set(id, tone);
      if (typeof customText === "string") this.committedText.set(id, customText);
      else this.committedText.delete(id);
    }

    revertChange(captureId, sentenceId) {
      const capture = this.captures.find(item => item.id === captureId);
      const change = capture?.changes.find(item => item.id === sentenceId);
      if (!change || this.text(sentenceId, { committed: true }) !== change.after) return false;
      const before = this._snapshot();
      this._applyChangeState(sentenceId, change.beforeTone, change.beforeCustomText ?? null);
      this.discardPreview();
      this._record("revert", before, { captureId, sentenceId });
      return true;
    }

    changeStatus(captureId, sentenceId) {
      const change = this.captures.find(item => item.id === captureId)?.changes.find(item => item.id === sentenceId);
      if (!change) return null;
      const current = this.text(sentenceId, { committed: true });
      if (current === change.after) return "applied";
      if (current === change.before) return "reverted";
      return "superseded";
    }

    exportSession() {
      return copy({
        version: 1,
        document: this.sentences.map(sentence => ({ id: sentence.id, text: sentence.text })),
        focusId: this.focusId,
        focusIssue: this.focusIssue,
        frame: this.frame,
        aperture: this.aperture,
        color: this.color,
        manualInclude: [...this.manualInclude],
        manualExclude: [...this.manualExclude],
        committed: this._snapshot(),
        captures: this.captures,
        undoStack: this.undoStack,
        redoStack: this.redoStack
      });
    }

    /** Validate completely before applying anything; transient previews are never persisted. */
    restoreSession(data) {
      try {
        const ids = list => Array.isArray(list) && new Set(list).size === list.length && list.every(id => this._sentences.has(id));
        const validTone = tone => tone === null || this._tones.has(tone);
        const snapshot = list => Array.isArray(list) && list.every(entry => Array.isArray(entry) &&
          (entry.length === 2 || entry.length === 3) && this._sentences.has(entry[0]) &&
          (entry.length === 2 ? entry[1] !== null && validTone(entry[1]) :
            validTone(entry[1]) && typeof entry[2] === "string")) &&
          new Set(list.map(entry => entry[0])).size === list.length;
        const validFrame = item => FRAMES.has(item.frame) && typeof item.aperture === "number" &&
          Number.isFinite(item.aperture) && item.aperture >= 0 && item.aperture <= 100;
        if (!plain(data) || data.version !== 1 || !Array.isArray(data.document) ||
            JSON.stringify(data.document) !== JSON.stringify(this.sentences.map(sentence => ({ id: sentence.id, text: sentence.text }))) ||
            !(data.focusId === null || this._sentences.has(data.focusId)) ||
            !(data.focusIssue === null || this._issues.has(data.focusIssue)) ||
            !validFrame(data) || typeof data.color !== "boolean" ||
            !ids(data.manualInclude) || !ids(data.manualExclude) ||
            data.manualInclude.some(id => data.manualExclude.includes(id)) ||
            !snapshot(data.committed) ||
            !Array.isArray(data.captures) || !Array.isArray(data.undoStack) || !Array.isArray(data.redoStack)) return false;

        const captureIds = new Set();
        for (const capture of data.captures) {
          if (!plain(capture) || capture.id !== String(captureIds.size + 1).padStart(2, "0") ||
              capture.kind !== "style" || !this._sentences.has(capture.focusId) || !this._issues.has(capture.focusIssue) ||
              !validFrame(capture) || !validTone(capture.tone) ||
              !ids(capture.includedIds) ||
              !ids(capture.excludedIds) || capture.excludedIds.some(id => capture.includedIds.includes(id)) ||
              !Array.isArray(capture.changes) || capture.changes.length === 0 ||
              !ids(capture.changes.map(change => change?.id)) ||
              typeof capture.createdAt !== "string" || !Number.isFinite(Date.parse(capture.createdAt))) return false;
          for (const change of capture.changes) {
            const beforeCustom = change.beforeCustomText ?? null;
            const afterCustom = change.afterCustomText ?? null;
            if (!plain(change) || !capture.includedIds.includes(change.id) || !validTone(change.beforeTone) ||
                !validTone(change.afterTone) ||
                !(beforeCustom === null || typeof beforeCustom === "string") ||
                !(afterCustom === null || typeof afterCustom === "string") ||
                change.before === change.after ||
                change.before !== (beforeCustom ?? this._textForTone(change.id, change.beforeTone)) ||
                change.after !== (afterCustom ?? this._textForTone(change.id, change.afterTone)) ||
                (afterCustom === null && change.afterTone !== capture.tone)) return false;
          }
          captureIds.add(capture.id);
        }
        for (const operation of [...data.undoStack, ...data.redoStack]) {
          if (!plain(operation) || !["capture", "restore", "revert"].includes(operation.kind) ||
              !captureIds.has(operation.captureId) || !snapshot(operation.before) || !snapshot(operation.after) ||
              (operation.kind === "revert" && !data.captures.find(item => item.id === operation.captureId).changes.some(item => item.id === operation.sentenceId))) return false;
        }
        // A damaged history must never replace unrelated text during a later undo.
        const equalSnapshots = (left, right) => JSON.stringify([...left].sort((a, b) => a[0].localeCompare(b[0]))) ===
          JSON.stringify([...right].sort((a, b) => a[0].localeCompare(b[0])));
        let cursor = data.committed;
        for (let index = data.undoStack.length - 1; index >= 0; index--) {
          const operation = data.undoStack[index];
          if (!equalSnapshots(cursor, operation.after)) return false;
          cursor = operation.before;
        }
        cursor = data.committed;
        for (let index = data.redoStack.length - 1; index >= 0; index--) {
          const operation = data.redoStack[index];
          if (!equalSnapshots(cursor, operation.before)) return false;
          cursor = operation.after;
        }

        const restored = copy(data);
        this.focusId = restored.focusId;
        this.focusIssue = restored.focusIssue;
        this.frame = restored.frame;
        this.aperture = restored.aperture;
        this.color = restored.color;
        this.manualInclude = new Set(restored.manualInclude);
        this.manualExclude = new Set(restored.manualExclude);
        this._loadSnapshot(restored.committed);
        this.captures = restored.captures.map(freeze);
        this.undoStack = restored.undoStack.map(freeze);
        this.redoStack = restored.redoStack.map(freeze);
        this.discardPreview();
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  return { SemanticCamera };
});
