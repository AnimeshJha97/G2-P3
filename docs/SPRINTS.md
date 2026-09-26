# Implementation Sprints

## G2 AI Hiring Hackathon — Problem 3
### End-to-End Implementation Sprint Plan

**Submission context:** This is the sprint plan I used to control implementation scope. I preserved the original objectives, constraints, prompts, and completion criteria as a process record; completed behavior and final metrics are documented in [README.md](../README.md) and [evaluation/results.md](../evaluation/results.md).

**Purpose:** Record how I divided the implementation into small, controlled sprints with clear objectives, no more than three tasks, explicit completion conditions, and bounded Codex prompts.

This plan assumes the decisions already defined in:

- `PROJECT_DECISION.md`
- `ARCHITECTURE.md`
- `SCORING_DESIGN.md`
- `EVALUATION_PLAN.md`
- `AI_AGENT_PLAYBOOK.md`
- `HACKATHON_RUNBOOK.md`

The selected solution is:

```text
Problem 3 — Rewarding novelty in submissions
```

Core implementation principles:

```text
TypeScript + Node.js
local embeddings
deterministic scoring
semantic + lexical novelty
relevance gate
automated evaluation
JSON/in-memory data
Vitest
```

---

# Sprint Rules

Every sprint follows these rules:

1. Maximum **3 tasks**.
2. Do not begin the next sprint until the current sprint's completion criteria are met.
3. Each sprint should end with:
   - tests passing,
   - type-check passing,
   - Git diff reviewed,
   - meaningful commit created.
4. Codex may implement.
5. An optional secondary reviewer is used mainly for review/debugging after meaningful milestones.
6. Architecture changes require explicit review before implementation.

---

# Sprint 0 — Repository and Toolchain Initialization

## Objective

Create a minimal, stable TypeScript project that is ready for implementation without adding any application logic.

## Task 1 — Initialize the repository and package configuration

Create the project repository and initialize npm.

Expected setup:

```text
package.json
tsconfig.json
.gitignore
src/
tests/
data/
evaluation/
docs/
```

Install only the required initial dependencies:

```bash
npm install zod dotenv
npm install -D typescript tsx vitest @types/node
```

Do not install Transformers.js or a hosted AI service yet unless the environment setup requires it immediately.

Add scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "evaluate": "tsx src/evaluation/run.ts"
}
```

### Why this matters

This establishes a predictable toolchain before any business logic is added. It also reduces the chance of package and configuration issues later.

---

## Task 2 — Create the approved project structure

Create the folders described in the architecture:

```text
src/
  config/
  types/
  text/
  embeddings/
  similarity/
  scoring/
  data/
  evaluation/

tests/
data/
evaluation/
docs/
```

Copy the preparation documents into `docs/`.

Create:

```text
docs/AI_USAGE.md
```

with a basic disclosure header.

### Why this matters

The coding agents should be able to read the project decisions directly from the repository instead of relying on chat context.

---

## Task 3 — Verify the toolchain

Create one trivial TypeScript file and one trivial Vitest test.

Run:

```bash
npm test
npm run typecheck
```

Also confirm:

```bash
git status
```

shows only expected project files.

### Sprint completion criteria

```text
[ ] npm install succeeds
[ ] npm test succeeds
[ ] npm run typecheck succeeds
[ ] project structure exists
[ ] preparation docs are available in /docs
[ ] AI_USAGE.md exists
[ ] repository has an initial commit
```

### Suggested commit

```text
chore: initialize TypeScript hackathon project
```

## Sprint 0 Kickoff Prompt

```text
Read the preparation documents in /docs, especially:
- PROJECT_DECISION.md
- ARCHITECTURE.md
- SCORING_DESIGN.md
- EVALUATION_PLAN.md
- AI_AGENT_PLAYBOOK.md

Do not implement scoring logic yet.

Sprint objective:
Initialize a minimal TypeScript + Node.js project for the novelty-scoring system.

Tasks:
1. Configure package.json, TypeScript, Vitest, and .gitignore.
2. Create the project directory structure described in ARCHITECTURE.md.
3. Add one trivial test so npm test and npm run typecheck both work.

Constraints:
- npm
- TypeScript
- Node.js
- Vitest
- no frontend
- no API
- no database
- no embeddings yet
- no hosted AI service yet
- no scoring logic yet

Before editing, summarize the files you plan to create or modify.
```

---

# Sprint 1 — Domain Types, Validation, and Text Representation

## Objective

Define the core data contracts and canonical text representations before any scoring code is written.

## Task 1 — Implement domain types

Create TypeScript types/interfaces for:

```text
FixedContent
Submission
Perspective
NoveltyScoreResult
NeighborScore
ScoringConfig
EvaluationCategory
LabeledEvaluationCase
```

Keep them aligned with the architecture documents.

Do not introduce fields that are not required.

### Why this matters

Stable domain types prevent the implementation from drifting while other modules are built.

---

## Task 2 — Implement input validation

Use Zod or equivalent simple validation for:

```text
fixed content
submission
perspective
```

Validate:

```text
headline is non-empty
body is non-empty
perspective is allowed
fixed content body is non-empty
fixed content stays within the intended 100-word problem constraint
```

Do not over-engineer length restrictions yet.

### Why this matters

Bad inputs should fail before reaching embeddings or scoring.

---

## Task 3 — Implement canonical text helpers

Implement:

```text
toSemanticText(submission)
toLexicalText(submission)
toFixedContentText(content)
normalizeLexicalText(text)
```

Initial semantic format:

```text
Headline: ...
Body: ...
Perspective: ...
```

Initial lexical input:

```text
headline + body
```

Add focused tests.

### Sprint completion criteria

```text
[ ] domain types compile
[ ] validation rejects malformed input
[ ] semantic representation is deterministic
[ ] lexical normalization is deterministic
[ ] tests pass
[ ] typecheck passes
```

### Suggested commit

```text
feat: add domain models and text normalization
```

## Sprint 1 Kickoff Prompt

```text
Sprint objective:
Implement the domain models, validation, and canonical text representation described in ARCHITECTURE.md and SCORING_DESIGN.md.

Tasks:
1. Create the core TypeScript types/interfaces.
2. Add lightweight Zod validation for FixedContent and Submission.
3. Add semantic and lexical text-representation helpers with tests.

Constraints:
- do not implement scoring
- do not add embeddings
- do not add a hosted AI service
- do not add persistence
- do not invent new submission fields
- perspective values must remain:
  support, concern, question, suggestion, observation

Add focused Vitest tests.
Before editing, list the files you intend to create or modify.
```

---

# Sprint 2 — Pure Similarity and Scoring Primitives

## Objective

Build all deterministic mathematical components independently of any real embedding model.

## Task 1 — Implement similarity functions

Implement:

```text
cosineSimilarity
tokenJaccardSimilarity
```

Required cosine behavior:

```text
identical vectors -> 1
orthogonal vectors -> 0
negative raw cosine -> clamp to 0
dimension mismatch -> error
zero vector -> error
```

Required lexical behavior:

```text
exact normalized text -> high/1 similarity
partial overlap -> intermediate
no overlap -> 0
```

Add unit tests for edge cases.

---

## Task 2 — Implement Top-K and novelty primitives

Implement:

```text
sort/select semantic neighbors
weighted Top-K aggregation
renormalization when baseline count < K
semanticNovelty = 1 - aggregatedSimilarity
lexicalNovelty = 1 - maxLexicalSimilarity
```

Initial Top-K:

```text
K = 3
weights = 0.60 / 0.30 / 0.10
```

Keep values in configuration.

---

## Task 3 — Implement raw novelty, relevance gate, and final score helpers

Implement:

```text
rawNovelty =
semanticWeight * semanticNovelty
+
lexicalWeight * lexicalNovelty
```

Initial weights:

```text
semanticWeight = 0.85
lexicalWeight = 0.15
```

Implement piecewise relevance gate and final clamping.

The relevance thresholds must remain configurable and provisional.

### Sprint completion criteria

```text
[ ] cosine tests pass
[ ] Jaccard tests pass
[ ] Top-K weight normalization works
[ ] novelty outputs stay within [0,1]
[ ] relevance gate behaves correctly
[ ] no real embedding dependency exists yet
[ ] tests pass
[ ] typecheck passes
```

### Suggested commit

```text
feat: implement scoring primitives
```

## Sprint 2 Kickoff Prompt

```text
Read SCORING_DESIGN.md.

Sprint objective:
Implement only the pure mathematical and lexical scoring primitives.

Tasks:
1. Implement cosine similarity and token Jaccard similarity.
2. Implement Top-K weighted semantic aggregation plus semantic/lexical novelty.
3. Implement raw novelty, piecewise relevance gate, score clamping, and config validation.

Constraints:
- TypeScript
- pure functions where practical
- no embedding model
- no API
- no hosted AI service
- no database
- no UI
- keep Top-K and weights configuration-driven
- relevance thresholds must remain configurable
- do not silently change the documented formulas

Add boundary-focused Vitest tests.
Before editing, summarize the implementation plan and files in scope.
```

---

# Sprint 3 — Local Embedding Provider

## Objective

Introduce local semantic embeddings behind a clean abstraction without coupling them to scoring logic.

## Task 1 — Install and implement the embedding provider

Install:

```bash
npm install @huggingface/transformers
```

Implement:

```text
EmbeddingProvider interface
LocalEmbeddingProvider
```

Required methods:

```ts
embed(text: string): Promise<number[]>
embedMany(texts: string[]): Promise<number[][]>
```

Use a small supported sentence-embedding model.

Initial preferred model:

```text
Xenova/all-MiniLM-L6-v2
```

Use:

```text
feature-extraction
mean pooling
normalized vectors
```

---

## Task 2 — Add embedding initialization and caching

The model should initialize once where practical.

Implement simple in-memory caching for:

```text
fixed content embedding
baseline submission embeddings
```

Do not implement disk persistence unless time clearly permits.

### Why this matters

Repeated evaluation should not repeatedly embed the same 50 baseline submissions.

---

## Task 3 — Add semantic smoke/integration tests

Verify:

```text
similar sentence pair -> relatively high similarity
unrelated sentence pair -> relatively lower similarity
embedding dimensions are stable
embedMany returns expected count
```

These are integration tests, not strict semantic benchmarks.

### Sprint completion criteria

```text
[ ] local model loads
[ ] embed works
[ ] embedMany works
[ ] vectors are normalized/usable
[ ] model initializes once or efficiently
[ ] repeated baseline embeddings can be reused
[ ] integration smoke test works
[ ] tests/typecheck pass
```

### Suggested commit

```text
feat: add local embedding provider
```

## Sprint 3 Kickoff Prompt

```text
Sprint objective:
Implement the local embedding layer described in ARCHITECTURE.md.

Tasks:
1. Add @huggingface/transformers and implement EmbeddingProvider + LocalEmbeddingProvider.
2. Add simple model initialization and in-memory embedding reuse.
3. Add an integration smoke test showing semantically similar text scores higher than unrelated text.

Requirements:
- use local inference
- preferred initial model: Xenova/all-MiniLM-L6-v2
- feature-extraction
- mean pooling
- normalized vectors
- no novelty scoring changes
- no hosted AI service
- no database
- no API/UI

Keep model-specific code isolated in the embeddings module.
Before editing, list files/dependencies to change.
```

---

# Sprint 4 — End-to-End Novelty Scorer

## Objective

Combine the validated inputs, embeddings, similarity functions, and scoring primitives into the actual scoring service.

## Task 1 — Implement baseline preparation

Create a preparation step that:

```text
validates baseline submissions
canonicalizes them
embeds them
stores submission + vector together
```

Also prepare/cache:

```text
fixed content embedding
```

Suggested internal type:

```ts
EmbeddedSubmission
```

---

## Task 2 — Implement `NoveltyScorer`

The scorer must:

```text
validate candidate
canonicalize candidate
embed candidate
compare to every baseline
return Top-K neighbors
calculate semantic novelty
calculate lexical novelty
calculate raw novelty
calculate relevance
apply relevance gate
calculate final score
```

Return intermediate values.

Do not return only `finalScore`.

---

## Task 3 — Add deterministic behavior tests

Use mocked embeddings so tests do not depend on the real model.

Minimum behaviors:

```text
duplicate -> low score
novel + relevant -> high score
novel + irrelevant -> low final score despite high raw novelty
```

### Sprint completion criteria

```text
[ ] scorer works end-to-end with prepared vectors
[ ] Top-K neighbors returned
[ ] intermediate metrics returned
[ ] final score always in [0,1]
[ ] relevance is multiplicative
[ ] deterministic mocked tests pass
[ ] typecheck passes
```

### Suggested commit

```text
feat: implement end-to-end novelty scorer
```

## Sprint 4 Kickoff Prompt

```text
Sprint objective:
Implement the end-to-end NoveltyScorer using the modules already created.

Tasks:
1. Add baseline/fixed-content embedding preparation.
2. Implement NoveltyScorer exactly according to SCORING_DESIGN.md.
3. Add deterministic mocked-embedding tests for duplicate, novel-relevant, and novel-irrelevant behavior.

The scorer must return:
- finalScore
- semantic novelty
- lexical novelty
- raw novelty
- relevance similarity
- relevance gate
- nearest neighbors

Do not:
- add a hosted AI service
- add a database
- add an API
- add a UI
- change weights
- invent final relevance thresholds
- hide intermediate scores

Before editing, explain the data flow you will implement.
```

---

# Sprint 5 — Fixed Content and Baseline Dataset

## Objective

Create the actual static data the scoring engine will evaluate against.

## Task 1 — Finalize fixed content

Create:

```text
data/fixed-content.json
```

Requirements:

```text
<= 100 words
specific enough for meaningful relevance
clear enough to support several discussion themes
```

Use the approved software/product announcement use case.

---

## Task 2 — Generate approximately 50 baseline submissions

Use a hosted AI service to generate structured submissions.

Required schema:

```json
{
  "id": "...",
  "headline": "...",
  "body": "...",
  "perspective": "..."
}
```

Ensure the dataset contains repeated semantic clusters.

Suggested themes:

```text
privacy
retention
time savings
accuracy
human oversight
workflow integration
multilingual support
customer trust
admin controls
analytics
security
agent productivity
```

---

## Task 3 — Review and validate baseline data

Manually inspect the data.

Check:

```text
unique IDs
valid fields
valid perspectives
relevance to fixed content
semantic variety
intentional repeated themes
no accidental garbage
```

Add loader/validation tests if not already present.

### Sprint completion criteria

```text
[ ] fixed content valid and <=100 words
[ ] ~50 baseline submissions exist
[ ] all baseline submissions validate
[ ] multiple semantic clusters exist
[ ] data loads correctly
[ ] dataset committed
```

### Suggested commit

```text
data: add fixed content and baseline submissions
```

## Sprint 5 Kickoff Prompt

```text
Sprint objective:
Create and validate the fixed content and approximately 50 baseline submissions.

Tasks:
1. Finalize data/fixed-content.json using the approved software/product-announcement use case.
2. Generate approximately 50 structured baseline submissions, using a hosted AI service only for synthetic generation if helpful.
3. Validate and review the resulting dataset for schema correctness, relevance, cluster variety, and duplicate IDs.

Constraints:
- fixed content must remain <=100 words
- submission shape must not change
- baseline must contain repeated semantic themes
- do not assign novelty scores
- do not create evaluation labels in this sprint
- do not change scoring code

If using a hosted AI service, save only reviewed static JSON in the repository.
```

---

# Sprint 6 — Labeled Evaluation Dataset and Evaluator

## Objective

Create the evidence framework that proves whether the scorer behaves correctly.

## Task 1 — Create the labeled evaluation dataset

Create:

```text
data/labeled-cases.json
```

Categories:

```text
duplicate
near_duplicate
paraphrase
common
novel_relevant
novel_irrelevant
borderline
```

Target:

```text
~21–35 cases
```

Each case should include:

```text
candidate
category
rationale
optional expectations
```

The evaluation dataset must remain separate from the baseline.

---

## Task 2 — Implement the evaluation runner

Implement:

```text
load fixed content
load baseline
load labeled cases
prepare embeddings
score every candidate
check expectations
group by category
calculate pass/fail
calculate category means
```

Output:

```text
evaluation/results.json
```

---

## Task 3 — Add evaluation-framework tests

Use mocked score results to test:

```text
pass/fail expectation handling
category grouping
mean calculations
summary metrics
```

Do not test the real model in unit tests.

### Sprint completion criteria

```text
[ ] labeled dataset exists
[ ] no evaluation candidate leaks into baseline
[ ] evaluator runs
[ ] category metrics generated
[ ] pass/fail logic works
[ ] results.json generated
[ ] tests/typecheck pass
```

### Suggested commit

```text
feat: add labeled evaluation framework
```

## Sprint 6 Kickoff Prompt

```text
Read EVALUATION_PLAN.md.

Sprint objective:
Create the labeled evaluation dataset and the automated evaluation runner.

Tasks:
1. Create data/labeled-cases.json with the required behavioral categories and rationales.
2. Implement the evaluator that scores every candidate, checks expectations, groups results by category, and writes evaluation/results.json.
3. Add deterministic tests for evaluation pass/fail and aggregation logic using mocked score outputs.

Constraints:
- evaluation candidates must not be added to the baseline dataset
- do not change the scoring algorithm
- do not change scoring thresholds just to make cases pass
- failed cases must remain visible
- do not add UI/API

Before editing, summarize the evaluator data flow.
```

---

# Sprint 7 — Real-Model Calibration

## Objective

Use actual embedding output and labeled data to choose defensible relevance thresholds and confirm whether the initial novelty configuration works.

## Task 1 — Calibrate relevance

Run the full evaluator with the real local model.

Inspect relevance values for:

```text
clearly relevant
clearly irrelevant
borderline
```

Choose provisional:

```text
relevanceLow
relevanceHigh
```

based on observed distributions.

Document the reason.

---

## Task 2 — Evaluate novelty separation

Inspect:

```text
duplicates
near duplicates
paraphrases
common themes
novel relevant
```

Only if failures justify it, compare:

```text
Top-K: 1 vs 3 vs 5
```

and/or lexical strategy.

Change one parameter group at a time.

---

## Task 3 — Lock final simple configuration

Choose the simplest configuration that produces acceptable separation.

Document:

```text
embedding model
Top-K
neighbor weights
semantic/lexical weights
relevance thresholds
pass rate
known failures
```

Write/update:

```text
evaluation/calibration-log.md
```

### Sprint completion criteria

```text
[ ] real-model evaluation completed
[ ] relevance thresholds justified from data
[ ] parameter changes documented
[ ] main required behaviors demonstrated
[ ] final configuration locked
[ ] known failures documented
[ ] tests/typecheck still pass
```

### Suggested commit

```text
feat: calibrate novelty scoring configuration
```

## Sprint 7 Kickoff Prompt

```text
Sprint objective:
Calibrate the scoring configuration using the real embedding model and the labeled evaluation dataset.

Tasks:
1. Analyze relevance-score distributions and propose defensible relevanceLow/relevanceHigh values.
2. Analyze novelty-category separation and identify whether Top-K or lexical behavior requires one controlled experiment.
3. Lock the simplest acceptable configuration and document the calibration result.

Rules:
- change one parameter group at a time
- do not optimize for individual cases
- do not hide failures
- do not modify evaluation labels to improve results
- do not automatically change code

First, run the existing evaluator and summarize the current metrics and failure patterns.
Do not edit scoring configuration until the analysis is shown.
```

---

# Sprint 8 — Evaluation Report and Explainability

## Objective

Turn evaluation output into a clear, defensible engineering result.

## Task 1 — Generate the final evaluation report

Create:

```text
evaluation/results.md
```

Include:

```text
configuration
model
dataset sizes
overall pass rate
category means
separation metrics
failed cases
known limitations
```

Do not omit failures.

---

## Task 2 — Add explainable score output

Ensure a score result exposes:

```text
final score
raw novelty
semantic novelty
lexical novelty
relevance
relevance gate
Top-K nearest submissions
```

Optionally add deterministic human-readable explanations.

Do not call an LLM just to explain scores.

---

## Task 3 — Select three demo cases

Choose:

```text
1 semantic paraphrase
1 novel + relevant
1 novel + irrelevant
```

Verify their results are stable.

These will be used in the presentation.

### Sprint completion criteria

```text
[ ] results.md exists
[ ] evaluation claims match results
[ ] score output is explainable
[ ] nearest neighbors visible
[ ] three demo cases selected
[ ] known limitations documented
```

### Suggested commit

```text
docs: add evaluation report and demo cases
```

## Sprint 8 Kickoff Prompt

```text
Sprint objective:
Convert the calibrated evaluation into a clear report and demo-ready explainability output.

Tasks:
1. Generate evaluation/results.md from the current locked configuration and results.
2. Ensure NoveltyScoreResult exposes all intermediate scoring components and Top-K neighbors.
3. Select and document three representative demo cases: paraphrase, novel-relevant, and novel-irrelevant.

Constraints:
- do not change scoring parameters
- do not hide failed evaluation cases
- do not use an LLM to produce runtime score explanations
- do not add UI yet

Before editing, summarize the current evaluation metrics that will be reported.
```

---

# Sprint 9 — Minimal Demo Interface

## Objective

Create the smallest usable interface for demonstrating the scorer.

This sprint is optional if time is limited.

## Task 1 — Implement a CLI scoring command

Preferred implementation:

```bash
npm run score
```

Allow a candidate to be provided via:

```text
interactive prompts
or JSON input
```

Print:

```text
final score
component scores
Top-K neighbors
```

---

## Task 2 — Add input error handling

Handle:

```text
invalid perspective
empty fields
bad JSON
missing baseline/fixed data
embedding initialization failure
```

Errors should be readable.

---

## Task 3 — Verify demo flow from a fresh process

Run all three selected demo cases.

Confirm output is consistent and readable.

Do not add a web UI unless there is significant spare time after this sprint.

### Sprint completion criteria

```text
[ ] CLI starts reliably
[ ] valid input scores successfully
[ ] invalid input shows useful errors
[ ] demo cases run successfully
[ ] output shows nearest neighbors and components
```

### Suggested commit

```text
feat: add CLI novelty scoring demo
```

## Sprint 9 Kickoff Prompt

```text
Sprint objective:
Add a minimal CLI demonstration layer without changing the core scoring system.

Tasks:
1. Add an npm run score command that accepts a structured candidate and scores it.
2. Add clear validation/error handling.
3. Verify the three selected demo cases from a fresh process.

Output should show:
- finalScore
- rawNovelty
- semanticNovelty
- lexicalNovelty
- relevance
- relevanceGate
- Top-K nearest submissions

Constraints:
- no scoring changes
- no database
- no web frontend
- no hosted AI runtime dependency
- keep the CLI small and easy to remove if unstable
```

---

Yes. Since the core implementation and evaluation are already done in roughly two hours, adding a **small testing/demo UI** is now worthwhile.

The key is: **do not turn this into a frontend project.** The UI should expose the engineering work you already built.

I would insert a new sprint before final documentation:

# Sprint 9A — Local Testing & Demo UI

## Task 1 — Add a thin local API layer

Expose your existing scorer through something like:

```text
POST /api/score
GET  /api/baseline
GET  /api/evaluation-summary
```

`POST /api/score` input:

```json
{
  "headline": "Admins should track human corrections",
  "body": "When an agent corrects an AI-generated summary...",
  "perspective": "suggestion"
}
```

Response should expose the full explainability data you already have:

```json
{
  "finalScore": 0.78,
  "rawNovelty": 0.84,
  "semanticNovelty": 0.86,
  "lexicalNovelty": 0.72,
  "relevance": 0.81,
  "relevanceGate": 0.93,
  "nearestNeighbors": []
}
```

Do **not** duplicate scoring logic in the UI/API layer. It should call the existing `NoveltyScorer`.

## Task 2 — Create one simple test screen

I would make one page containing:

```text
NOVELTY EVALUATOR

Headline
[________________________________]

Body
[________________________________]
[________________________________]
[________________________________]

Perspective
[ suggestion ▼ ]

                [ Evaluate ]

--------------------------------------------

FINAL NOVELTY SCORE
          0.78

Raw Novelty        0.84
Semantic Novelty   0.86
Lexical Novelty    0.72

Relevance          0.81
Relevance Gate     0.93

--------------------------------------------

CLOSEST EXISTING SUBMISSIONS

#1  Similarity 0.47
"Privacy controls should..."

#2  Similarity 0.39
"Organizations need..."

#3  Similarity 0.32
"Support teams..."
```

That is enough.

The strongest part of the UI is **not the form**. It is showing:

```text
Raw Novelty
        ↓
Relevance Gate
        ↓
Final Score
```

because that visually explains your main architectural decision.

## Task 3 — Add preset test cases

This would make the demo much stronger.

Add buttons like:

```text
[ Exact Duplicate ]
[ Semantic Paraphrase ]
[ Novel + Relevant ]
[ Novel + Irrelevant ]
[ Clear Form ]
```

Clicking one fills the form with a known evaluation example.

Then during presentation you can demonstrate:

### Novel + relevant

```text
Raw Novelty       0.88
Relevance Gate    0.95
Final Score       0.84
```

### Novel + irrelevant

```text
Raw Novelty       0.94
Relevance Gate    0.06
Final Score       0.06
```

That second screen practically explains the whole project without you needing a long explanation.

---

## Technology choice

Because your backend already exists in TypeScript, I would **not introduce React unless you already have it running**.

Fastest low-risk option:

```text
Node
+
Express/Fastify
+
plain HTML/CSS/JavaScript
```

or whatever small HTTP framework you're already comfortable with.

You only need one page.

If you already have Express:

```text
public/
  index.html
  app.js
  styles.css
```

and:

```text
src/server.ts
```

That's sufficient.

If you strongly prefer React and can scaffold Vite in a few minutes, it's also fine, but React gives you almost no evaluation advantage here.

---

## What I would display visually

Keep the UI around four sections:

**1. Candidate Input**

Headline, body, perspective.

**2. Score**

Make the final score large:

```text
0.78
```

Possibly a simple horizontal bar.

**3. Score Breakdown**

```text
Semantic Novelty   ████████░░  0.82
Lexical Novelty    ███████░░░  0.71
Raw Novelty        ████████░░  0.80
Relevance          █████████░  0.88
Relevance Gate     █████████░  0.95
```

**4. Top-3 Nearest Existing Submissions**

Show their:

```text
headline
semantic similarity
lexical similarity
perspective
```

This gives judges something concrete to inspect.

---

## One particularly useful visualization

Show this little flow:

```text
RAW NOVELTY
    0.86
      ×
RELEVANCE GATE
    0.91
      =
FINAL SCORE
    0.78
```

For an irrelevant example:

```text
RAW NOVELTY
    0.94
      ×
RELEVANCE GATE
    0.05
      =
FINAL SCORE
    0.05
```

That makes your core design immediately understandable.

---

## What not to add

Skip:

```text
authentication
routing
animations
dark/light mode
database browsing
editing baseline submissions
charts library
user accounts
history
deployment
responsive perfection
```

Maybe make it usable on a laptop screen and stop.

---

## Codex kickoff prompt

Use this:

```text
Read:
- ARCHITECTURE.md
- SCORING_DESIGN.md
- EVALUATION_PLAN.md

The core scoring engine, baseline dataset, and evaluation system are already
implemented and working.

Sprint objective:
Add a minimal local testing/demo UI around the existing NoveltyScorer.

Tasks:

1. Add a thin HTTP endpoint for scoring a candidate using the EXISTING
   NoveltyScorer. Do not duplicate or modify scoring logic.

2. Create one local web page with:
   - headline input
   - body input
   - perspective dropdown
   - Evaluate button
   - final score
   - raw novelty
   - semantic novelty
   - lexical novelty
   - relevance similarity
   - relevance gate
   - Top-3 nearest baseline submissions

3. Add preset demo buttons for:
   - exact duplicate
   - semantic paraphrase
   - novel + relevant
   - novel + irrelevant

Constraints:
- keep the UI minimal
- reuse existing types and scorer
- no database
- no authentication
- no deployment
- no scoring changes
- no threshold changes
- no new evaluation logic
- avoid React unless the repository already uses it
- prefer the smallest implementation that runs locally

Add an npm script such as:
npm run dev

Before editing, inspect the current repository and tell me:
1. which existing modules you will reuse,
2. which files you plan to add,
3. whether a small plain HTML/JS interface or a frontend framework is the
   lower-risk option for the current repository. I think using react.js will be very benificial.
```

One additional idea is worth doing if it takes little time: display the **current evaluation summary** somewhere small at the bottom:

```text
Evaluation
28 cases
25 passed
89.3% pass rate
```

That turns the page from merely a testing UI into a very effective hackathon demo dashboard.

# Sprint 10 — Documentation and AI Disclosure

## Objective

Make the repository self-explanatory and compliant with the hackathon submission requirements.

## Task 1 — Write the README

README should include:

```text
problem summary
solution overview
architecture
setup
commands
scoring design
evaluation strategy
results
limitations
production scaling
```

Reference detailed docs rather than duplicating everything.

---

## Task 2 — Complete `AI_USAGE.md`

Document meaningful usage of:

```text
Codex
optional secondary reviewer
optional hosted AI service
ChatGPT
```

For each major interaction include:

```text
objective
constraints
prompt summary
output
accepted/rejected decisions
reasoning
```

Be accurate about the level of AI assistance.

---

## Task 3 — Verify documentation against the repository

Check that:

```text
README commands actually work
reported metrics match results
scoring formula matches code
model identifier matches code
AI disclosure is complete
limitations are honest
```

### Sprint completion criteria

```text
[ ] README complete
[ ] AI_USAGE.md complete
[ ] setup instructions tested
[ ] evaluation claims verified
[ ] no unsupported claims
[ ] docs match code
```

### Suggested commit

```text
docs: finalize solution and AI usage documentation
```

## Sprint 10 Kickoff Prompt

```text
Sprint objective:
Finalize repository documentation and AI-use disclosure.

Tasks:
1. Write/update README.md using the implemented project and final evaluation results.
2. Complete docs/AI_USAGE.md using the recorded interactions.
3. Audit documentation against the actual code, configuration, commands, and evaluation metrics.

Constraints:
- do not change scoring logic
- do not invent metrics
- do not claim production readiness
- do not understate AI usage
- failed cases and limitations must remain visible

Before editing, list the factual values you will pull from the current repository.
```

---

# Sprint 11 — Final Quality, Security, and Submission

## Objective

Freeze development, verify the repository from end to end, remove submission risks, and push the final version.

## Task 1 — Run the full verification suite

Run:

```bash
npm test
npm run typecheck
npm run evaluate
npm run score
```

Verify the selected demo cases.

Do not add features during this sprint.

---

## Task 2 — Audit repository and secrets

Check:

```bash
git status
git diff
```

Verify:

```text
.env ignored
no API keys
no temporary files
no debug credentials
no uncommitted required files
baseline included
tests included
results included
AI usage included
```

---

## Task 3 — Final commit, push, and remote verification

Commit the final accepted state.

Push.

Open the repository in the browser and verify:

```text
latest commit exists
README renders
required files exist
repository access/visibility is correct
submission URL is correct
```

### Sprint completion criteria

```text
[ ] all tests pass
[ ] typecheck passes
[ ] evaluation runs
[ ] demo runs
[ ] no secrets committed
[ ] Git working tree clean
[ ] latest commit pushed
[ ] remote repository verified manually
```

### Suggested commit

```text
chore: finalize hackathon submission
```

## Sprint 11 Kickoff Prompt

```text
Sprint objective:
Perform final submission verification only.

Tasks:
1. Run the complete test, type-check, evaluation, and demo workflow.
2. Audit the repository for secrets, temporary files, broken documentation, and missing required artifacts.
3. Prepare the final Git state for submission.

Rules:
- do not add features
- do not refactor
- do not change model
- do not change scoring configuration unless a required-path bug is proven
- review only and make minimal critical fixes

Before editing anything, report all verification failures first.
```

---

# Sprint Dependency Map

```text
Sprint 0
  |
  v
Sprint 1
  |
  v
Sprint 2
  |
  v
Sprint 3
  |
  v
Sprint 4
  |
  +----------------+
  |                |
  v                |
Sprint 5           |
  |                |
  v                |
Sprint 6 <---------+
  |
  v
Sprint 7
  |
  v
Sprint 8
  |
  v
Sprint 9 (optional)
  |
  v
Sprint 10
  |
  v
Sprint 11
```

---

# Sprint Priority if Time Becomes Limited

## Must complete

```text
Sprint 0 — setup
Sprint 1 — types/validation
Sprint 2 — scoring primitives
Sprint 3 — embeddings
Sprint 4 — scorer
Sprint 5 — baseline
Sprint 6 — evaluation
Sprint 7 — calibration
Sprint 10 — documentation
Sprint 11 — submission
```

## Strongly preferred

```text
Sprint 8 — evaluation report
```

## Optional

```text
Sprint 9 — CLI/demo interface
```

---

# Emergency Compression Plan

If the hackathon is much shorter than expected, merge sprints:

```text
Sprint 0 + 1
Sprint 2 + 3
Sprint 5 + 6
Sprint 7 + 8
Sprint 10 + 11
```

Do not merge:

```text
core scoring implementation
```

with:

```text
calibration
```

because calibration must be based on observed behavior, not invented while coding.

---

# Sprint Review Template

At the end of every sprint, record:

```markdown
## Sprint X Review

Completed:
- ...
- ...

Tests:
- npm test: PASS/FAIL
- npm run typecheck: PASS/FAIL

Important decisions:
- ...

AI used:
- tool:
- purpose:

Known issues:
- ...

Next sprint:
- ...
```

This can also help populate `AI_USAGE.md` and the final engineering summary.

---

# End-to-End Completion Definition

The implementation is finished when:

```text
[ ] project installs cleanly
[ ] submission schema works
[ ] local embeddings work
[ ] semantic novelty works
[ ] lexical novelty works
[ ] relevance gate works
[ ] score is normalized to [0,1]
[ ] ~50 baseline submissions exist
[ ] labeled evaluation exists
[ ] automated evaluator works
[ ] calibration is documented
[ ] evaluation results are included
[ ] demo path works or core CLI is available
[ ] README is complete
[ ] AI usage is disclosed
[ ] tests pass
[ ] typecheck passes
[ ] no secrets are committed
[ ] repository is pushed and verified
```
