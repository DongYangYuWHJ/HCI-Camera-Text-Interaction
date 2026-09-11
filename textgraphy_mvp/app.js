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

// Prepared wording variants keep this interaction prototype deterministic.
Object.freeze(toneVariants);
