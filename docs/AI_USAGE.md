# Coding Agent Usage

I used the ChatGPT application for my initial analysis of the problem statement and the first planning phase. I then used Codex heavily for implementation, test scaffolding, repository inspection, verification, and documentation. I divided the work into bounded sprint prompts backed by the preparation documents in `docs/`. Codex produced substantial portions of the code and tests; describing the assistance as minor would be inaccurate.

I retained responsibility for accepting changes, keeping the architecture and scoring design within the prepared constraints, approving the locked parameters, deciding which generated work to keep or reject, and performing final verification. I summarize the major interactions below.

## Tool coverage

- **ChatGPT application:** I used it for initial problem-statement analysis and initial project planning.
- **Codex:** I used it substantially for implementation, tests, evaluation tooling, the CLI, repository auditing, and documentation.

## Interaction 01 - Problem analysis and initial planning

**Tool:** ChatGPT application

**Objective:** Analyze the supplied problem statement and develop the initial plan for a scoped, explainable novelty-scoring prototype.

**Context and constraints supplied:** The project problem statement, hackathon scope, explainability requirement, and need to distinguish novelty from source relevance.

**Prompt summary:** Interpret the problem, identify the main technical risks, and organize the work into an initial implementation and evaluation plan.

**Output/result:** Initial problem analysis and planning guidance that I used to frame the architecture, scoring design, evaluation approach, and phased implementation work.

**Accepted:** The separation of novelty from relevance, the emphasis on deterministic score components, and the phased planning approach.

**Rejected or changed:** I treated the planning output as guidance rather than final implementation authority and reviewed later design and parameter choices against repository evidence.

**Reasoning:** The initial analysis helped me turn the problem statement into bounded tasks before implementation began.

## Interaction 02 - Project scaffolding

**Tool:** Codex

**Objective:** Initialize the minimal Node.js, TypeScript, npm, and Vitest project described by Sprint 0.

**Context and constraints supplied:** The preparation documents in `docs/`; create the approved directory structure; no frontend, API, database, embeddings, hosted AI integration, or scoring logic.

**Prompt summary:** Build only the repository and toolchain foundation, then verify it.

**Output/result:** Package and TypeScript configuration, source/data/evaluation/test directories, ignore rules, and an initial test.

**Accepted:** The minimal ESM TypeScript/Vitest structure and dependency setup.

**Rejected or changed:** No out-of-scope application layer was accepted.

**Reasoning:** A small verified foundation kept later scoring work isolated and reviewable.

## Interaction 03 - Domain models and canonical text

**Tool:** Codex

**Objective:** Implement the Sprint 1 domain contracts, validation, and deterministic semantic and lexical text representations.

**Context and constraints supplied:** The architecture, scoring design, evaluation plan, and implementation sprint plan; preserve the documented submission schema and five perspective values; do not add scoring, embeddings, hosted AI services, persistence, or UI.

**Prompt summary:** Add strict TypeScript/Zod contracts and tested text transformations without moving into later sprints.

**Output/result:** Submission, fixed-content, score, and evaluation types; strict Zod schemas; semantic canonicalization; lexical normalization and tokenization; focused tests.

**Accepted:** The strict schemas, five perspectives, 100-word fixed-content limit, labeled-case uniqueness checks, and deterministic text helpers.

**Rejected or changed:** No scoring or infrastructure expansion was accepted in this phase.

**Reasoning:** Stable contracts and representations were prerequisites for testing the algorithm independently.

## Interaction 04 - Pure scoring primitives

**Tool:** Codex

**Objective:** Implement Sprint 2 similarity, novelty, relevance-gating, final-score, and configuration-validation primitives.

**Context and constraints supplied:** Preserve the formulas in `SCORING_DESIGN.md`; use configuration-driven Top-K and weights; keep functions deterministic; do not add embeddings, external AI APIs, databases, UI, or optional scoring rules.

**Prompt summary:** Implement and test the mathematical building blocks without orchestration.

**Output/result:** Cosine similarity, token Jaccard similarity, Top-K weighted aggregation, semantic and lexical novelty, a piecewise-linear relevance gate, weighted raw novelty, final-score multiplication, clamping, and configuration validation.

**Accepted:** The documented formulas and boundary-focused tests.

**Rejected or changed:** Optional duplicate overrides and other undocumented scoring rules were not added.

**Reasoning:** Pure functions made the scoring behavior auditable before a real model was introduced.

## Interaction 05 - Local embedding provider

**Tool:** Codex

**Objective:** Implement the local embedding abstraction and real model adapter for Sprint 3.

**Context and constraints supplied:** Use `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers`; mean pooling; normalized output; no hosted API or generative model.

**Prompt summary:** Add a replaceable provider interface, local inference, validation, caching, and integration coverage.

**Output/result:** `EmbeddingProvider`, `LocalEmbeddingProvider`, pipeline reuse, batch embedding, completed/in-flight caches, vector-shape validation, and a real-model integration test.

**Accepted:** Local model inference and in-memory caching with defensive output validation.

**Rejected or changed:** No remote embedding dependency was added.

**Reasoning:** Local deterministic inference avoided runtime API keys and kept model identity explicit.

## Interaction 06 - End-to-end novelty scorer

**Tool:** Codex

**Objective:** Compose the validated inputs, embeddings, similarity primitives, novelty calculation, and relevance gate for Sprint 4.

**Context and constraints supplied:** Keep the existing scoring formula and configuration; require at least one baseline; prevent a candidate ID from appearing in the baseline; expose score components and nearest neighbors.

**Prompt summary:** Implement context preparation and `NoveltyScorer` orchestration without changing the algorithm.

**Output/result:** Prepared fixed-content/baseline embeddings, candidate scoring, Top-3 neighbor selection, semantic and lexical contributions, relevance gating, final score, and explainability fields.

**Accepted:** The complete deterministic calculation path and validation guards.

**Rejected or changed:** No LLM-generated judge or explanation was introduced.

**Reasoning:** The result needed to be reproducible and inspectable from stored numeric components.

## Interaction 07 - Fixed content and baseline dataset

**Tool:** Codex

**Objective:** Add the Sprint 5 evaluation fixture: one source announcement and a diverse baseline set.

**Context and constraints supplied:** Use the approved schema, exactly 50 baseline submissions, all five perspectives, unique IDs, and no evaluation-candidate leakage.

**Prompt summary:** Create and validate the fixed content and representative baseline data.

**Output/result:** `data/fixed-content.json`, 50 records in `data/submissions.json`, and dataset validation tests.

**Accepted:** The schema-valid 50-item baseline and coverage of support, concern, question, suggestion, and observation perspectives.

**Rejected or changed:** Invalid, duplicate-ID, and mixed evaluation/baseline data were not accepted.

**Reasoning:** A fixed, reviewed comparison set was necessary for repeatable evaluation.

## Interaction 08 - Labeled evaluation framework

**Tool:** Codex

**Objective:** Implement Sprint 6 labeled cases, expectation checking, category aggregation, and a real-model evaluation runner.

**Context and constraints supplied:** Keep evaluation IDs separate from baseline IDs; use explicit min/max expectations; include duplicate, near-duplicate, paraphrase, common, novel-relevant, novel-irrelevant, and borderline cases; retain failures.

**Prompt summary:** Build the labeled dataset and evaluator without tuning away difficult cases.

**Output/result:** 28 labeled cases, expectation checking, per-category means and pass rates, real-model execution, JSON report output, and tests.

**Accepted:** The seven-category dataset, transparent bounds, sequential case scoring, and machine-readable report.

**Rejected or changed:** Failed cases were not removed or relabeled.

**Reasoning:** Explicit expectations and preserved failures make the evaluation auditable instead of anecdotal.

## Interaction 09 - Real-model calibration

**Tool:** Codex

**Objective:** Analyze the observed model distributions and lock the Sprint 7 scoring configuration.

**Context and constraints supplied:** Do not change labels; consider parameter groups independently; document rejected alternatives; prioritize the relevance guardrail; do not conceal failures.

**Prompt summary:** Run and interpret controlled calibration using the 50 baselines, 28 cases, and real local model.

**Output/result:** `evaluation/calibration-log.md`, an initial 0.00/1.00 relevance-gate run, relevance-distribution analysis, a controlled Top-1 comparison, and the locked 0.10/0.35 gate.

**Accepted:** Top-3, 0.60/0.30/0.10 neighbor weights, 0.85/0.15 semantic/lexical weights, and relevance thresholds 0.10/0.35.

**Rejected or changed:** Top-1 was rejected because it narrowed novel-relevant versus paraphrase raw-novelty separation and did not address the relevance failures. Labels and failed cases were not changed.

**Reasoning:** The locked configuration reached the 85% target and suppressed every clearly irrelevant case without adding unsupported complexity.

## Interaction 10 - Evaluation report and explainability

**Tool:** Codex

**Objective:** Complete Sprint 8 reporting with reproducible metrics, visible failures, representative demos, and calculation-level explanations.

**Context and constraints supplied:** Generate Markdown and JSON from the same run; show the locked configuration, all category metrics, all failed cases, nearest neighbors, separation checks, formulas, and limitations; do not claim failed cases passed.

**Prompt summary:** Turn evaluator output into an auditable final report without changing scoring parameters.

**Output/result:** `evaluation/results.json`, generated `evaluation/results.md`, score-component tables, neighbor tables, three fixed demo cases, guardrail checks, and report-rendering tests.

**Accepted:** The 24/28 (`85.7%`) report, all four failures, and the failed novel-relevant/paraphrase separation check.

**Rejected or changed:** No metric, label, or scoring parameter was altered to improve the presentation.

**Reasoning:** Reporting both successes and failures is necessary to understand the model's actual behavior.

## Interaction 11 - Minimal scoring CLI

**Tool:** Codex

**Objective:** Add the optional Sprint 9 demo interface without adding a web application.

**Context and constraints supplied:** Reuse the locked scorer and project datasets; accept exactly one of inline JSON, a file, or a labeled case; validate inputs; display the score and nearest neighbors; keep build output temporary.

**Prompt summary:** Implement a small command-line demonstration path and test argument, validation, formatting, and execution behavior.

**Output/result:** `src/cli/score.ts`, `prescore` and `score` scripts, a separate emitting TypeScript configuration, help/error messages, and CLI tests.

**Accepted:** The three explicit input modes and deterministic textual output.

**Rejected or changed:** A frontend, HTTP server, and database were not added.

**Reasoning:** The CLI demonstrates the implemented scorer with minimal surface area and no new application architecture.

## Interaction 12 - Documentation and repository audit

**Tool:** Codex

**Objective:** Finalize `README.md` and this disclosure using the implemented project and final evaluation results.

**Context and constraints supplied:** Audit code, configuration, commands, evaluation artifacts, and recorded interactions first; do not change scoring logic; do not invent metrics; do not claim production readiness; do not understate AI use; keep failures and limitations visible.

**Prompt summary:** List repository facts before editing, write the README, complete the AI-use record, and verify every material claim.

**Output/result:** A repository-level README, an expanded interaction log, command verification, and a cross-check against the locked report and source configuration.

**Accepted:** Only claims supported by the repository, including the 24/28 result, four failed cases, failed separation check, 79 passing tests, and prototype limitations.

**Rejected or changed:** No scoring code, labels, thresholds, or evaluation metrics were changed during documentation work. Unsupported production-readiness and unrecorded-tool claims were excluded.

**Reasoning:** Final documentation must describe the code that exists and the evaluation that actually ran.

## Verification and disclosure boundaries

For the documentation audit, I used Codex to run the repository test suite and type-checker: 13 test files and 79 tests passed, and TypeScript reported no errors. I cross-checked the evaluation report against `evaluation/results.json`, `src/evaluation/config.ts`, the scorer implementation, package scripts, datasets, and calibration log.

I reviewed AI-generated changes before accepting them. My passing tests establish consistency with the current test suite; they do not establish production safety, fairness, robustness, or general validity. I kept the known evaluation failures and limitations documented in `README.md`, `evaluation/results.md`, and `evaluation/calibration-log.md`.
