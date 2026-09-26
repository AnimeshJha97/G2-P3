# Project Decisions

## G2 AI Hiring Hackathon — Problem 3 Preparation

**Submission context:** This document records the major decisions I made before implementation. I preserved the original plan so reviewers can compare it with the final code and measured results in [README.md](../README.md) and [evaluation/results.md](../evaluation/results.md).

**Document purpose:** Record the project-level decisions I locked before the build so I could implement without repeatedly revisiting architecture, tooling, scope, or evaluation strategy.

**Selected challenge:** Problem Statement 3 — **Rewarding novelty in submissions**

---

## 1. Problem Selection

I chose **Problem Statement 3: Rewarding novelty in submissions**.

The system must evaluate structured user-generated text submitted in response to a fixed piece of content and assign a normalized novelty score in the range **[0.0, 1.0]**.

The project must:

- Define a structured user-generated-content format with **three discrete user-provided properties**.
- Keep the fixed reference content to **100 words or less**.
- Evaluate a new submission against approximately **50 other submissions**.
- Reward genuinely novel submissions while maintaining a minimum level of relevance to the fixed content.
- Demonstrate through automated tests that:
  - novel and relevant content is rewarded,
  - non-novel content is not rewarded,
  - highly novel but low-relevance content is not rewarded.
- Include project documentation explaining engineering design, rationale, success criteria, achievement against those criteria, and coding-agent usage.
- Include the code, dataset, and tests in a GitHub/GitLab repository.

---

## 2. Chosen Use Case

### Domain

**Commentary on a software/product announcement**

This domain is intentionally simple, understandable, and close to real product-feedback scenarios.

### Fixed Content

The fixed content will be a short product announcement of at most 100 words.

Example shape:

> A software company announces an AI feature for customer-support teams. The feature can summarize conversations, extract action items, identify recurring customer issues, and integrate with workplace tools. Administrators can configure processing and data-retention behavior.

The exact final text can be written onsite.

### User Submission Shape

Each submission will contain exactly three user-provided fields:

```json
{
  "headline": "string",
  "body": "string",
  "perspective": "support | concern | question | suggestion | observation"
}
```

### Why this shape

- `headline` captures the user's main idea.
- `body` contains the substantive argument or feedback.
- `perspective` provides a discrete structured property that can contribute additional contextual information.
- The format is easy to generate synthetically, test, inspect, and explain.

---

## 3. Primary Engineering Goal

The project is **not** intended to create a generic LLM judge.

The primary engineering goal is to build an **explainable, deterministic novelty-scoring pipeline** that combines:

1. semantic similarity,
2. lexical similarity,
3. relevance to the fixed source content,
4. nearest-neighbor comparison against existing submissions.

The central design principle is:

> **Novelty and relevance are separate concepts. Novelty should only be rewarded when relevance is sufficient.**

The implementation must therefore avoid a simple weighted score where high novelty can compensate for very low relevance.

---

## 4. High-Level Scoring Strategy

The system will calculate:

```text
new submission
      |
      +--> semantic novelty
      |
      +--> lexical novelty
      |
      +--> relevance to fixed content
      |
      v
raw novelty
      |
      x relevance gate
      |
      v
final score [0.0, 1.0]
```

### Semantic novelty

The new submission will be embedded locally and compared against embeddings of the existing submissions.

Instead of averaging similarity against all ~50 submissions, the system will focus primarily on the **closest semantic neighbors** so that one near-duplicate cannot be hidden by many unrelated submissions.

Initial design:

```text
nearest_similarity =
    0.60 * top_1_similarity
  + 0.30 * top_2_similarity
  + 0.10 * top_3_similarity

semantic_novelty =
    1 - nearest_similarity
```

These coefficients are **initial hypotheses**, not fixed production values. They may be calibrated during evaluation.

### Lexical novelty

A lightweight lexical similarity measure will be added to catch:

- exact copies,
- lightly edited copies,
- trivial word substitutions,
- high-overlap submissions that embeddings alone may treat too generously.

Initial conceptual form:

```text
lexical_novelty =
    1 - maximum_lexical_similarity
```

The exact lexical technique may be Jaccard similarity, token overlap, n-gram similarity, or another simple deterministic method.

### Raw novelty

Initial design:

```text
raw_novelty =
    0.85 * semantic_novelty
  + 0.15 * lexical_novelty
```

These weights will be treated as tunable parameters and should be justified using evaluation results.

### Relevance gate

Relevance will be measured separately between:

- the new submission, and
- the fixed source content.

The final score should conceptually behave like:

```text
final_score =
    raw_novelty * relevance_gate
```

Low relevance should heavily suppress the final score.

The exact relevance threshold or smooth gating function will be decided after inspecting evaluation results.

---

## 5. Local vs External AI

### Local computation

The core scoring pipeline should work locally and deterministically.

Local components:

- embeddings,
- semantic similarity,
- lexical similarity,
- relevance calculation,
- novelty calculation,
- automated evaluation.

### Optional Hosted AI Service

A hosted AI service may be used to generate synthetic submissions for the dataset.

A hosted AI service should **not** be required for runtime novelty scoring.

This keeps the scoring system:

- reproducible,
- inexpensive,
- testable,
- independent of network/API availability,
- easier to defend technically.

---

## 6. Technical Stack

### Language

**TypeScript**

Reason:

- strongest fit with current experience,
- fast development in Node.js,
- easy testing,
- strong compatibility with VS Code coding agents,
- no need to switch to Python unless a library limitation makes it necessary.

### Runtime

**Node.js**

### Embeddings

Preferred approach:

**Local embedding model through Transformers.js**

The exact model should be small enough to download and run comfortably onsite.

Model choice remains deliberately open until implementation because runtime compatibility and download size should be verified first.

### Storage

For the hackathon dataset:

**JSON files + in-memory objects/vectors**

No database will be used initially.

Reason:

- only approximately 50 comparison submissions are required,
- exact pairwise comparison is inexpensive,
- a database adds setup and failure risk without improving the core evaluation.

### Testing

**Vitest**

### API/UI

Priority order:

1. scoring engine,
2. automated tests,
3. evaluation script/report,
4. CLI or minimal API,
5. optional UI only if time remains.

A polished frontend is not a core success criterion.

---

## 7. Scale Strategy

The hackathon version will use exact comparisons against all stored submissions because the dataset is small.

If asked how this would scale to production:

- embeddings would be stored in a vector-capable database/vector index,
- approximate nearest-neighbor search could replace exhaustive comparisons,
- score calibration would use a larger labeled evaluation dataset,
- submissions could be partitioned by content/thread/category,
- observability would track score distributions, latency, drift, and failure cases.

Production architecture is a discussion point, not an onsite implementation requirement.

---

## 8. Synthetic Dataset Strategy

Target dataset:

**approximately 50 submissions**

The dataset should intentionally contain multiple behavioral groups, including:

- exact duplicates,
- near duplicates,
- semantic paraphrases,
- common/repetitive opinions,
- genuinely novel but relevant ideas,
- unusual but relevant suggestions,
- highly novel but irrelevant content,
- borderline relevance examples,
- submissions sharing wording but expressing different ideas,
- submissions expressing the same idea with very different wording.

A hosted AI service can be used to create the initial dataset, but the dataset must be inspected before being accepted.

The dataset itself is part of the evaluation design, not just test filler.

---

## 9. Evaluation Philosophy

Evaluation is a first-class part of the project.

The implementation is successful only if behavior can be demonstrated through automated tests.

Minimum behavioral categories:

### A. Duplicate / near duplicate

Expected:

```text
high relevance
low novelty
low final reward
```

### B. Paraphrase of an existing idea

Expected:

```text
high relevance
low-to-medium novelty
limited final reward
```

### C. Novel and relevant

Expected:

```text
high relevance
high novelty
high final reward
```

### D. Novel but irrelevant

Expected:

```text
low relevance
possibly high raw novelty
low final reward
```

### E. Common cluster

If many submissions express the same idea with different wording, a new variation should not receive a high novelty score merely because its exact wording is different.

### F. Borderline case

Tests should include ambiguous cases so thresholds and limitations can be discussed honestly.

---

## 10. Scope Control

### Required before considering extras

- structured submission model,
- local embeddings,
- semantic comparison,
- lexical comparison,
- relevance calculation,
- novelty score in `[0.0, 1.0]`,
- ~50 comparison submissions,
- automated behavioral tests,
- evaluation output,
- documentation,
- AI usage disclosure,
- Git repository.

### Optional

- REST API,
- CLI visualization,
- simple web UI,
- score explanation panel,
- nearest-neighbor display,
- charts,
- persistence,
- Docker setup.

Optional features must never delay the core scoring/evaluation system.

---

## 11. Explicit Non-Goals

For the hackathon version, I did **not** prioritize:

- full authentication,
- production-grade database infrastructure,
- complex frontend design,
- distributed services,
- microservices,
- LLM-based scoring for every request,
- fine-tuning models,
- training custom embeddings,
- sophisticated ANN infrastructure,
- premature optimization.

---

## 12. Initial Project Modules

Expected conceptual structure:

```text
src/
  types/
  embeddings/
  similarity/
  scoring/
  evaluation/
  data/

tests/

data/
  fixed-content.json
  submissions.json
  labeled-cases.json

docs/
  ARCHITECTURE.md
  SCORING_DESIGN.md
  EVALUATION_PLAN.md
  AI_USAGE.md
```

The exact file layout may change during implementation if there is a clear engineering reason.

---

## 13. Definition of Done

The core project is considered complete when:

1. A fixed content item is defined.
2. Approximately 50 baseline submissions are available.
3. A new structured submission can be evaluated.
4. The system returns a score normalized to `[0.0, 1.0]`.
5. The system identifies semantically repetitive submissions as low novelty.
6. The system rewards relevant novel submissions.
7. Highly novel but irrelevant submissions are strongly suppressed.
8. Automated tests demonstrate the intended behaviors.
9. Evaluation results can be summarized quantitatively.
10. Engineering decisions and limitations are documented.
11. Coding-agent usage is disclosed.
12. The repository can be run from documented setup instructions.

---

## 14. Decisions Intentionally Deferred

These should be decided only after experimentation:

- exact embedding model,
- exact lexical-similarity algorithm,
- relevance threshold,
- whether relevance uses a hard or smooth gate,
- exact semantic/lexical weighting,
- Top-K neighbor count beyond the initial Top-3 assumption,
- final score calibration,
- whether a minimal API/UI is worth adding,
- whether category/perspective should directly affect novelty scoring.

These are empirical decisions and should not be locked before seeing actual evaluation behavior.
