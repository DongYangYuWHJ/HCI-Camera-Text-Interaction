const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeRange: summarizePanoRange } = require("../pano.js");

const sentence = id => ({ id, text: `Text ${id}` });
const model = {
  sections: [
    { id: "intro", title: "Introduction", paragraphs: [
      [sentence("s1"), sentence("s2"), sentence("s3")],
      [sentence("s4"), sentence("s5"), sentence("s6")]
    ]},
    { id: "design", title: "Design", paragraphs: [
      [sentence("s7"), sentence("s8"), sentence("s9")],
      [sentence("s10"), sentence("s11"), sentence("s12")]
    ]}
  ]
};

test("full panorama follows manuscript order and exposes four argument steps", () => {
  const result = summarizePanoRange(model, "s1", "s12");
  assert.deepEqual(result.sentenceIds, Array.from({ length: 12 }, (_, i) => `s${i + 1}`));
  assert.equal(result.steps.length, 4);
  assert.match(result.summary, /LLM revision/);
  assert.match(result.summary, /writer's final authority/);
});

test("partial ranges summarize only sentences that were swept", () => {
  const result = summarizePanoRange(model, "s2", "s5");
  assert.deepEqual(result.sentenceIds, ["s2", "s3", "s4", "s5"]);
  assert.equal(result.steps.length, 2);
  assert.match(result.summary, /passage-and-prompt interaction/);
  assert.doesNotMatch(result.summary, /Photography/);
});

test("backward endpoints normalize to reading order", () => {
  assert.deepEqual(
    summarizePanoRange(model, "s7", "s4").sentenceIds,
    ["s4", "s5", "s6", "s7"]
  );
});

test("invalid endpoints fail closed without inventing a summary", () => {
  assert.deepEqual(summarizePanoRange(model, "s1", "missing"), {
    summary: "", steps: [], sentenceIds: []
  });
});
