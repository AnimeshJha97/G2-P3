# Architecture

## G2 AI Hiring Hackathon — Problem 3
### Rewarding Novelty in Submissions

**Submission context:** I prepared this architecture before implementation and used it to guide the build. I have retained the original design language as a record of my decisions; [README.md](../README.md) and [evaluation/results.md](../evaluation/results.md) describe the final implemented and evaluated state.

**Purpose:** Record the implementation architecture I chose so I could build the project quickly in small, testable modules.

This document describes the proposed hackathon architecture. It is intentionally optimized for:

- correctness,
- explainability,
- deterministic behavior,
- automated evaluation,
- low setup risk,
- fast implementation,
- easy discussion during the final interview.

---

# 1. Problem Summary

The selected challenge is to evaluate the novelty of a new structured user-generated submission relative to approximately 50 existing submissions while ensuring the new submission remains relevant to a fixed piece of source content.

The system must return a normalized novelty score:

```text
0.0 <= finalScore <= 1.0
```

The key behavioral requirement is:

```text
high novelty + high relevance  -> reward
low novelty + high relevance   -> do not reward
high novelty + low relevance   -> do not reward
```

The solution therefore separates:

1. **novelty**
2. **relevance**

and applies relevance as a gate to the novelty reward.

---

# 2. Architectural Principles

The system will follow these principles.

## 2.1 Keep the scoring pipeline deterministic

The runtime novelty score should not depend on a generative LLM response.

The same input and same comparison dataset should produce the same result.

Benefits:

- repeatable tests,
- easier debugging,
- lower latency,
- no API dependency during scoring,
- easier threshold calibration,
- easier explanation.

---

## 2.2 Use AI where it adds value, not where deterministic logic is better

A hosted AI service may be used to generate synthetic submissions for the dataset.

Coding agents may assist implementation.

The core scoring path remains local:

```text
submission
-> local embedding
-> similarity calculations
-> novelty calculation
-> relevance gate
-> final score
```

---

## 2.3 Evaluation is part of the architecture

The evaluator is not an afterthought.

The project architecture must support:

- labeled test cases,
- behavioral categories,
- repeatable evaluation,
- threshold calibration,
- regression tests.

---

## 2.4 Optimize for ~50 submissions first

The hackathon requirement is approximately 50 comparison submissions.

At this scale:

- exact similarity comparison is simple,
- no approximate nearest-neighbor index is required,
- no vector database is required,
- JSON + memory is sufficient.

The architecture should still allow a production-scale vector index to replace in-memory comparison later.

---

# 3. System Context

```text
                     +----------------------+
                     |    Fixed Content     |
                     |   <= 100 words       |
                     +----------+-----------+
                                |
                                v
                     +----------------------+
                     | Local Embedding Model|
                     +----------+-----------+
                                |
                                v
                         Source Embedding


+----------------------+               +-----------------------+
| Existing Submissions |               |    New Submission     |
|      ~50 items       |               | headline/body/type    |
+----------+-----------+               +-----------+-----------+
           |                                           |
           v                                           v
+----------------------+                   +----------------------+
| Normalize / Prepare  |                   | Normalize / Prepare  |
+----------+-----------+                   +-----------+----------+
           |                                           |
           v                                           v
+----------------------+                   +----------------------+
| Local Embeddings     |                   | Local Embedding      |
+----------+-----------+                   +-----------+----------+
           |                                           |
           +-------------------+-----------------------+
                               |
                               v
                    +----------------------+
                    | Similarity Engine    |
                    +----------+-----------+
                               |
             +-----------------+-----------------+
             |                                   |
             v                                   v
+--------------------------+         +--------------------------+
| Semantic Novelty         |         | Lexical Novelty          |
| nearest neighbors        |         | token/ngram overlap      |
+------------+-------------+         +------------+-------------+
             |                                   |
             +-----------------+-----------------+
                               |
                               v
                    +----------------------+
                    | Raw Novelty Score    |
                    +----------+-----------+
                               |
                               |
Source Embedding -------------+
                               |
                               v
                    +----------------------+
                    | Relevance Gate       |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    | Final Score [0,1]    |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    | Explanation Object   |
                    +----------------------+
```

---

# 4. Input Model

## 4.1 Fixed Content

The fixed source content represents the content that users are responding to.

Example domain:

```text
software/product announcement
```

Constraints:

- maximum 100 words,
- one fixed content item for the main hackathon demonstration,
- stored separately from submissions.

Suggested type:

```ts
export interface FixedContent {
  id: string;
  title?: string;
  body: string;
}
```

---

## 4.2 User Submission

Each user-generated submission has three discrete properties.

```ts
export type Perspective =
  | "support"
  | "concern"
  | "question"
  | "suggestion"
  | "observation";

export interface Submission {
  id: string;
  headline: string;
  body: string;
  perspective: Perspective;
}
```

The exact allowed `perspective` values may be adjusted onsite, but the property should remain a controlled discrete value.

---

# 5. Text Representation

The embedding model should receive one canonical text representation for every submission.

Initial format:

```text
Headline: <headline>

Body: <body>

Perspective: <perspective>
```

Example:

```text
Headline: Privacy controls should be explicit

Body: Automatic summaries may save support teams time, but companies
need clear retention and training controls for sensitive conversations.

Perspective: concern
```

The formatting must be consistent for:

- baseline submissions,
- new submissions,
- tests.

---

## 5.1 Why combine all three fields?

The embedding should capture the submission as one semantic unit.

The third structured field provides contextual information without requiring a separate model.

However, the importance of `perspective` should be validated.

If adding the perspective text produces noisy embeddings, the architecture allows it to be excluded from the semantic representation while still remaining part of the structured input.

This decision is intentionally testable rather than assumed.

---

# 6. Input Normalization

Before lexical comparison:

```text
lowercase
-> trim whitespace
-> normalize repeated whitespace
-> optionally remove punctuation
-> tokenize
```

Do not aggressively remove stop words before confirming it improves lexical behavior.

For semantic embeddings, use the natural submission text with minimal normalization.

Reason:

Embedding models are typically designed to interpret natural text and should not receive heavily transformed text unless necessary.

---

# 7. Embedding Layer

The embedding system should be behind an interface.

```ts
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

Initial implementation:

```text
LocalEmbeddingProvider
```

using a small local model compatible with Node.js.

The exact model is intentionally deferred until runtime compatibility is verified.

---

## 7.1 Embedding Provider Responsibilities

The provider should:

- load the model,
- generate an embedding,
- return a flat numeric vector,
- handle batching if supported,
- normalize the vector if required,
- throw useful errors.

It should **not** know about:

- novelty scoring,
- submissions,
- relevance,
- lexical similarity.

This keeps model-specific code isolated.

---

## 7.2 Embedding Cache

Embedding the same ~50 submissions repeatedly is unnecessary.

Architecture:

```text
dataset load
     |
     v
embedding cache lookup
     |
  missing?
 /       \
yes       no
 |         |
 v         v
embed     reuse
 |
 v
persist optional cache
```

Minimum implementation:

- cache in memory for the running process.

Optional:

- save computed vectors to JSON so repeated evaluations do not regenerate them.

Do not let cache persistence delay the core solution.

---

# 8. Similarity Engine

The similarity engine contains mathematical similarity functions and has no knowledge of business rules.

Suggested interface:

```ts
export interface SimilarityEngine {
  cosine(a: number[], b: number[]): number;
  lexical(a: string, b: string): number;
}
```

Expected output:

```text
0.0 <= similarity <= 1.0
```

If raw cosine values can fall outside this range for the chosen model, they should be transformed or clamped consistently.

---

# 9. Semantic Novelty

For candidate embedding `C` and existing embeddings:

```text
E1, E2, ..., En
```

calculate:

```text
similarity(C, Ei)
```

for every existing submission.

Sort descending:

```text
s1 >= s2 >= s3 >= ... >= sn
```

where `s1` is the most similar existing submission.

---

## 9.1 Top-K Neighbor Aggregation

Initial architecture:

```text
topK = 3
```

Weighted neighbor similarity:

```text
neighborSimilarity =
    0.60 * s1
  + 0.30 * s2
  + 0.10 * s3
```

Then:

```text
semanticNovelty =
    1 - neighborSimilarity
```

Expected range:

```text
0.0 <= semanticNovelty <= 1.0
```

---

## 9.2 Why not average all submissions?

Suppose:

```text
1 submission = almost identical
49 submissions = unrelated
```

A mean similarity across all 50 could appear low even though the candidate is effectively a duplicate.

Nearest-neighbor comparison avoids this failure mode.

---

## 9.3 Why Top-3 instead of Top-1?

Top-1 is simple but can be overly sensitive to a single unusual match.

Top-3 provides information about whether the candidate belongs to an already common semantic cluster.

The exact Top-K value remains calibratable.

---

# 10. Lexical Novelty

Semantic embeddings may fail to sufficiently penalize:

- copied sentences,
- minor word edits,
- template-like submissions.

The lexical subsystem provides a second signal.

Initial candidate:

```text
token Jaccard similarity
```

For token sets A and B:

```text
J(A, B) =
|A intersection B|
------------------
|A union B|
```

For the candidate:

```text
maxLexicalSimilarity =
max(
  lexical(candidate, submission1),
  lexical(candidate, submission2),
  ...
)
```

Then:

```text
lexicalNovelty =
1 - maxLexicalSimilarity
```

Alternative techniques may be tested:

- word n-gram Jaccard,
- Dice coefficient,
- normalized edit distance,
- TF-IDF cosine similarity.

The simplest method that improves evaluation should be used.

---

# 11. Raw Novelty Score

Initial formula:

```text
rawNovelty =
    0.85 * semanticNovelty
  + 0.15 * lexicalNovelty
```

Constraints:

```text
0.0 <= rawNovelty <= 1.0
```

This formula is deliberately simple.

It should not gain additional components unless the evaluation demonstrates a specific failure requiring them.

---

# 12. Relevance

Relevance measures whether the new submission is meaningfully connected to the fixed source content.

Initial method:

```text
candidate embedding
        vs
fixed content embedding
```

using cosine similarity.

```text
relevanceSimilarity =
cosine(candidateEmbedding, sourceEmbedding)
```

This yields a continuous relevance signal.

---

# 13. Relevance Gate

Relevance must not simply be another additive scoring feature.

Bad architecture:

```text
final =
0.7 * novelty +
0.3 * relevance
```

This allows:

```text
extremely novel
+
almost irrelevant
=
still moderately rewarded
```

That violates the intended behavior.

Instead:

```text
finalScore =
rawNovelty * relevanceGate
```

---

## 13.1 Gate Shape

Three possible designs will be evaluated.

### Option A — hard threshold

```text
if relevance < threshold:
    gate = 0
else:
    gate = 1
```

Advantages:

- simple,
- easy to explain.

Disadvantages:

- harsh discontinuity,
- score can change dramatically near threshold.

---

### Option B — piecewise linear gate

Example concept:

```text
relevance <= lowThreshold:
    gate = 0

relevance >= highThreshold:
    gate = 1

otherwise:
    linearly scale between 0 and 1
```

Advantages:

- explainable,
- smooth enough,
- easy to calibrate.

This is the current preferred option.

---

### Option C — sigmoid gate

```text
gate =
1 / (1 + exp(-k * (relevance - midpoint)))
```

Advantages:

- smooth,
- mathematically elegant.

Disadvantages:

- introduces parameters that may be harder to explain under time pressure.

Use only if evaluation clearly benefits.

---

# 14. Final Score

Conceptually:

```text
finalScore =
clamp(rawNovelty * relevanceGate, 0, 1)
```

Return enough intermediate values to explain the result.

Suggested type:

```ts
export interface NoveltyScore {
  finalScore: number;

  semanticNovelty: number;
  lexicalNovelty: number;
  rawNovelty: number;

  relevanceSimilarity: number;
  relevanceGate: number;

  nearestNeighbors: Array<{
    submissionId: string;
    semanticSimilarity: number;
    lexicalSimilarity: number;
  }>;
}
```

This is intentionally more informative than:

```ts
{ score: 0.74 }
```

---

# 15. Scoring Service

The main business-logic component:

```ts
export interface NoveltyScorer {
  score(
    fixedContent: FixedContent,
    candidate: Submission,
    existing: Submission[]
  ): Promise<NoveltyScore>;
}
```

Responsibilities:

1. validate input,
2. create canonical text,
3. generate/retrieve embeddings,
4. calculate semantic similarities,
5. calculate lexical similarities,
6. determine nearest neighbors,
7. calculate semantic novelty,
8. calculate lexical novelty,
9. calculate raw novelty,
10. calculate relevance,
11. apply relevance gate,
12. normalize final score,
13. return explanation data.

---

# 16. Proposed Runtime Flow

```text
START
  |
  v
Load fixed content
  |
  v
Load ~50 submissions
  |
  v
Initialize embedding provider
  |
  v
Embed/cache baseline submissions
  |
  v
Embed fixed content
  |
  v
Receive candidate submission
  |
  v
Validate candidate
  |
  v
Create canonical representation
  |
  v
Embed candidate
  |
  +------------------------------+
  |                              |
  v                              v
Semantic comparison         Lexical comparison
against baseline            against baseline
  |                              |
  v                              v
Top-K neighbors             max lexical overlap
  |                              |
  +---------------+--------------+
                  |
                  v
            Raw novelty
                  |
                  v
        Compare to fixed content
                  |
                  v
          Relevance gate
                  |
                  v
            Final score
                  |
                  v
       Explanation + neighbors
                  |
                  v
END
```

---

# 17. Data Layer

For the hackathon:

```text
data/
  fixed-content.json
  submissions.json
  labeled-cases.json
```

No repository abstraction is required initially unless it improves code clarity.

A simple loader is enough:

```ts
loadFixedContent()
loadSubmissions()
loadLabeledCases()
```

---

# 18. Dataset Shape

Example:

```json
{
  "id": "submission-001",
  "headline": "Privacy controls matter",
  "body": "Support summaries are useful, but organizations need clear retention controls.",
  "perspective": "concern"
}
```

Approximately 50 records should intentionally cover different semantic clusters.

Example clusters:

```text
time savings
privacy
accuracy
Slack integration
human oversight
multilingual support
retention
analytics
customer trust
workflow automation
```

The dataset should not be 50 completely unrelated ideas.

Clusters are useful because they allow the system to demonstrate that repeated themes become less novel.

---

# 19. Synthetic Data Generator

A hosted AI service may be used to create the initial dataset.

This should be isolated from runtime scoring.

Conceptual interface:

```ts
export interface DatasetGenerator {
  generate(
    source: FixedContent,
    count: number
  ): Promise<Submission[]>;
}
```

Potential output should be reviewed before being stored.

The generated dataset becomes static input for scoring/evaluation.

---

# 20. Evaluation Architecture

The evaluation system is separate from the scoring system.

```text
labeled cases
      |
      v
NoveltyScorer
      |
      v
actual scores
      |
      v
evaluation rules
      |
      v
pass/fail + metrics
```

Suggested labeled case:

```ts
export interface LabeledEvaluationCase {
  id: string;
  category:
    | "duplicate"
    | "paraphrase"
    | "common"
    | "novel_relevant"
    | "novel_irrelevant"
    | "borderline";

  candidate: Submission;

  expectation: {
    minFinalScore?: number;
    maxFinalScore?: number;
    minRelevance?: number;
    maxRelevance?: number;
  };
}
```

---

# 21. Evaluation Metrics

At minimum, report:

```text
total cases
passed cases
failed cases
pass rate
```

Also report mean score by category:

```text
duplicate           -> average final score
paraphrase          -> average final score
common              -> average final score
novel_relevant      -> average final score
novel_irrelevant    -> average final score
```

This gives evidence that scoring behavior separates categories.

---

## 21.1 Useful Comparison Metric

A simple behavioral separation metric can be reported:

```text
mean(novel_relevant)
-
mean(duplicate/paraphrase/common)
```

and:

```text
mean(novel_relevant)
-
mean(novel_irrelevant)
```

Larger positive separation suggests the intended behavior is working.

This is not a formal production metric, but it is useful evidence in a hackathon demonstration.

---

# 22. Threshold Calibration

Do not choose thresholds purely by intuition and then stop.

Process:

```text
initial thresholds
      |
      v
run labeled evaluation
      |
      v
inspect failures
      |
      v
adjust one parameter
      |
      v
rerun evaluation
      |
      v
document result
```

Parameters that may be calibrated:

- Top-K neighbor count,
- Top-K weights,
- semantic/lexical weights,
- relevance low threshold,
- relevance high threshold.

Avoid repeatedly changing many parameters simultaneously.

Otherwise it becomes difficult to explain why performance changed.

---

# 23. Validation

Candidate validation should reject:

- empty headline,
- empty body,
- invalid perspective,
- excessively malformed data.

Do not spend excessive time implementing complex validation.

A small schema validator such as Zod may be used if convenient.

---

# 24. Error Handling

The core application should handle:

### Model initialization failure

Return/throw a useful message such as:

```text
Unable to initialize local embedding model.
```

### Invalid vectors

Check:

- vector lengths match,
- vectors are non-empty,
- denominator in cosine similarity is non-zero.

### Empty comparison dataset

Do not silently produce misleading novelty.

Possible behavior:

```text
throw NoBaselineSubmissionsError
```

because novelty relative to previous submissions is undefined without previous submissions.

### Missing source content

Fail early.

---

# 25. Explainability

Every score should be explainable with:

```text
final score
raw novelty
semantic novelty
lexical novelty
relevance
relevance gate
closest matching submissions
```

Example output:

```json
{
  "finalScore": 0.74,
  "rawNovelty": 0.82,
  "semanticNovelty": 0.84,
  "lexicalNovelty": 0.71,
  "relevanceSimilarity": 0.78,
  "relevanceGate": 0.90,
  "nearestNeighbors": [
    {
      "submissionId": "submission-014",
      "semanticSimilarity": 0.42,
      "lexicalSimilarity": 0.21
    }
  ]
}
```

Numbers above are illustrative only.

---

# 26. Proposed Project Structure

```text
novelty-engine/
|
├── src/
│   ├── config/
│   │   └── scoring-config.ts
│   │
│   ├── types/
│   │   ├── fixed-content.ts
│   │   ├── submission.ts
│   │   ├── score.ts
│   │   └── evaluation.ts
│   │
│   ├── text/
│   │   ├── canonicalize.ts
│   │   └── normalize.ts
│   │
│   ├── embeddings/
│   │   ├── embedding-provider.ts
│   │   └── local-embedding-provider.ts
│   │
│   ├── similarity/
│   │   ├── cosine.ts
│   │   └── lexical.ts
│   │
│   ├── scoring/
│   │   ├── semantic-novelty.ts
│   │   ├── lexical-novelty.ts
│   │   ├── relevance.ts
│   │   ├── relevance-gate.ts
│   │   └── novelty-scorer.ts
│   │
│   ├── data/
│   │   └── loaders.ts
│   │
│   ├── evaluation/
│   │   ├── evaluator.ts
│   │   └── report.ts
│   │
│   └── index.ts
│
├── data/
│   ├── fixed-content.json
│   ├── submissions.json
│   └── labeled-cases.json
│
├── tests/
│   ├── cosine.test.ts
│   ├── lexical.test.ts
│   ├── relevance-gate.test.ts
│   ├── novelty-scorer.test.ts
│   └── evaluation.test.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SCORING_DESIGN.md
│   ├── EVALUATION_PLAN.md
│   └── AI_USAGE.md
│
├── package.json
├── tsconfig.json
└── README.md
```

This is a target structure, not a rule.

The coding agent may suggest minor improvements, but unnecessary abstraction should be rejected.

---

# 27. Configuration

Keep scoring parameters in one file.

Example:

```ts
export const scoringConfig = {
  topK: 3,

  neighborWeights: [0.6, 0.3, 0.1],

  semanticWeight: 0.85,
  lexicalWeight: 0.15,

  relevance: {
    lowThreshold: 0.0,   // calibrate
    highThreshold: 0.0,  // calibrate
  },
};
```

Threshold placeholders should not be treated as final values.

This centralized configuration allows controlled experiments.

---

# 28. Testing Layers

## Layer 1 — unit tests

Test mathematical functions:

```text
cosine similarity
lexical similarity
clamping
relevance gate
Top-K weighting
```

---

## Layer 2 — scoring behavior tests

Test examples such as:

```text
exact duplicate
near duplicate
semantic paraphrase
new relevant idea
irrelevant idea
```

---

## Layer 3 — evaluation suite

Run labeled cases and generate aggregate metrics.

---

## Layer 4 — manual demonstration

Allow one new submission to be scored interactively through:

- CLI,
- minimal API,
- or optional UI.

Only implement the interface after the scoring and evaluation layers work.

---

# 29. Optional API

If time allows:

```text
POST /score
```

Request:

```json
{
  "headline": "...",
  "body": "...",
  "perspective": "suggestion"
}
```

Response:

```json
{
  "finalScore": 0.74,
  "rawNovelty": 0.82,
  "relevance": 0.78,
  "nearestNeighbors": []
}
```

A framework is not required unless an API is actually useful for the demonstration.

Possible choices:

- Express,
- Fastify,
- native Node HTTP,
- Next.js route if a UI is added.

---

# 30. Optional UI

Only after the full evaluation suite works.

Minimal interface:

```text
-----------------------------------------
Novelty Evaluator
-----------------------------------------

Headline:
[                                  ]

Body:
[                                  ]
[                                  ]

Perspective:
[ suggestion v ]

[ Evaluate ]

-----------------------------------------
Final Score       0.74
Raw Novelty       0.82
Relevance         0.78

Closest existing ideas:
1. ...
2. ...
3. ...
-----------------------------------------
```

The UI should visualize engineering results rather than become a design project.

---

# 31. Production Evolution

Hackathon architecture:

```text
JSON
+
exact comparison
+
local embedding model
```

Production architecture could become:

```text
API
 |
 v
validation
 |
 v
embedding service
 |
 +------------------------------+
 |                              |
 v                              v
vector database             source store
ANN retrieval                  |
 |                              |
 +---------------+--------------+
                 |
                 v
            scorer service
                 |
                 v
         evaluation/monitoring
```

Potential production components:

- PostgreSQL + pgvector,
- dedicated vector database,
- HNSW/IVF ANN index,
- async embedding jobs,
- model versioning,
- threshold versioning,
- drift monitoring,
- audit logs,
- caching,
- observability.

These should be discussed, not implemented unless extra time remains.

---

# 32. Production Metrics

If asked what should be monitored in production:

### Quality

- distribution of novelty scores,
- distribution of relevance scores,
- human agreement with scores,
- false reward rate,
- false suppression rate,
- category-specific performance.

### System

- embedding latency,
- scoring latency,
- error rate,
- cache hit rate,
- throughput,
- model initialization failures.

### Drift

- average semantic similarity over time,
- score-distribution changes,
- emergence of new content clusters,
- changes in human evaluator agreement.

---

# 33. Security / Abuse Considerations

Possible abuse cases:

- users padding submissions with irrelevant text,
- users changing wording while repeating the same idea,
- users attempting to maximize novelty through random unrelated text,
- very long submissions influencing embeddings,
- prompt-like text if an LLM is later added.

Mitigations in this architecture:

```text
relevance gate
lexical similarity
length validation
nearest-neighbor semantic comparison
```

Further abuse prevention is outside the minimum hackathon scope.

---

# 34. Key Trade-offs

## Exact comparison vs vector database

Chosen:

```text
exact comparison
```

Reason:

~50 baseline submissions make exhaustive comparison trivial and more transparent.

---

## Local embeddings vs hosted embeddings

Chosen:

```text
local embeddings
```

Reason:

- deterministic dependency,
- no API cost,
- fewer runtime failures,
- stronger engineering story.

---

## Deterministic scoring vs LLM judge

Chosen:

```text
deterministic scoring
```

Reason:

- repeatability,
- automated testing,
- explainability,
- lower latency,
- easier calibration.

An LLM could later be added as an experimental evaluator, but not as the primary scoring mechanism.

---

## Backend first vs frontend first

Chosen:

```text
backend/scoring/evaluation first
```

Reason:

The problem is fundamentally an evaluation-engine problem.

---

# 35. Main Architecture Risks

## Risk 1 — embedding relevance scores are poorly calibrated

Mitigation:

- use labeled cases,
- inspect score distributions,
- calibrate thresholds,
- document limitations.

---

## Risk 2 — embeddings reward paraphrases too much

Mitigation:

Nearest-neighbor semantic similarity should catch paraphrases.

Lexical similarity acts as an additional duplicate signal.

---

## Risk 3 — novel irrelevant content receives a high score

Mitigation:

Relevance is a multiplicative gate rather than an additive feature.

---

## Risk 4 — dataset is too artificial

Mitigation:

Generate multiple controlled semantic clusters and manually inspect representative examples.

---

## Risk 5 — local model setup consumes hackathon time

Mitigation:

Verify Node + local embedding-library setup before the hackathon without implementing the competition solution.

Keep a backup model/library option documented.

---

## Risk 6 — coding agent over-engineers the project

Mitigation:

Give the agent narrow implementation tasks and refer it back to this architecture.

Reject unnecessary:

- repositories,
- factories,
- dependency injection frameworks,
- microservices,
- infrastructure layers.

---

# 36. Implementation Order

Tomorrow, implementation should proceed in this order:

```text
1. initialize repository
2. create TypeScript types
3. create data files/loaders
4. implement cosine similarity
5. implement lexical similarity
6. implement embedding provider
7. verify local embedding generation
8. embed baseline submissions
9. implement semantic novelty
10. implement relevance calculation
11. implement relevance gate
12. implement NoveltyScorer
13. create labeled test cases
14. run evaluation
15. calibrate parameters
16. generate evaluation report
17. document results/limitations
18. add CLI/API if time remains
19. add optional UI if substantial time remains
```

Do not jump to UI before Step 16 is working.

---

# 37. Architecture Completion Criteria

The architecture is successfully implemented when:

- submission input is validated,
- all three fields are represented,
- the fixed content is represented,
- local embeddings work,
- baseline embeddings are reusable,
- semantic similarity works,
- lexical similarity works,
- nearest neighbors are returned,
- raw novelty is calculated,
- relevance is calculated separately,
- relevance gates novelty,
- final score is within `[0,1]`,
- labeled tests demonstrate expected behavior,
- aggregate evaluation metrics are generated,
- output is explainable,
- scoring parameters are centralized,
- major AI-agent interactions are documented.

---

# 38. Decisions Deferred to SCORING_DESIGN.md

The architecture intentionally does not finalize:

- exact local embedding model,
- exact canonical embedding text,
- lexical method,
- Top-K value,
- Top-K weighting,
- semantic/lexical weighting,
- relevance gate thresholds,
- score interpretation bands,
- calibration method.

Those decisions belong in:

```text
SCORING_DESIGN.md
```

and should be supported by evaluation rather than intuition alone.
