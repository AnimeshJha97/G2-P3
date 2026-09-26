# Evaluation Plan

## G2 AI Hiring Hackathon — Problem 3
### Rewarding Novelty in Submissions

**Submission context:** I wrote this plan before running the final evaluation and used it to structure the labeled cases, calibration, regression tests, and reporting. I preserved the planned criteria here; [evaluation/results.md](../evaluation/results.md) contains the measured outcome, including the failed cases.

**Purpose:** Record how I planned to evaluate, calibrate, regression-test, and present the novelty-scoring system using measurable evidence.

This document should be used together with:

- `PROJECT_DECISION.md`
- `ARCHITECTURE.md`
- `SCORING_DESIGN.md`

---

# 1. Evaluation Objective

The scoring system must demonstrate three core behaviors:

```text
1. novel + relevant        -> rewarded
2. non-novel + relevant    -> not rewarded highly
3. novel + irrelevant      -> not rewarded
```

The evaluation plan therefore measures whether the system can distinguish between:

- exact repetition,
- near repetition,
- semantic paraphrase,
- common/repeated themes,
- genuinely novel and relevant ideas,
- novel but irrelevant ideas,
- borderline relevance.

The goal is not to prove that the scoring model is universally optimal.

The goal is to show that:

1. the scoring logic is measurable,
2. its expected behavior can be tested automatically,
3. thresholds are chosen based on observed data rather than intuition alone,
4. limitations are visible and documented.

---

# 2. Evaluation Philosophy

The evaluator is part of the product, not merely a test utility.

The project should answer:

```text
What does success mean?
How do I measure it?
What examples should score differently?
Did the implementation achieve that behavior?
Where does it still fail?
```

Evaluation should remain:

- deterministic,
- repeatable,
- explainable,
- small enough to finish during the hackathon,
- independent from the synthetic-data generation process.

---

# 3. Evaluation Layers

The project will use four evaluation layers.

```text
Layer 1 -> unit tests
Layer 2 -> behavioral scoring tests
Layer 3 -> labeled evaluation dataset
Layer 4 -> manual demo / qualitative inspection
```

Each serves a different purpose.

---

# 4. Layer 1 — Unit Tests

Unit tests verify the mathematical and deterministic building blocks.

These tests should not depend on a real embedding model unless explicitly testing the embedding provider.

Core unit tests:

```text
cosine similarity
lexical normalization
Jaccard similarity
Top-K weighted aggregation
weight normalization
semantic novelty conversion
lexical novelty conversion
raw novelty weighting
piecewise relevance gate
final score clamping
configuration validation
```

---

# 5. Cosine Similarity Unit Tests

Minimum tests:

### Identical vectors

```text
a = [1, 0]
b = [1, 0]

expected cosine = 1
```

### Orthogonal vectors

```text
a = [1, 0]
b = [0, 1]

expected cosine = 0
```

### Opposite vectors

```text
a = [1, 0]
b = [-1, 0]

raw cosine = -1
normalized/clamped similarity = 0
```

### Dimension mismatch

Expected:

```text
throws error
```

### Empty vector

Expected:

```text
throws error
```

### Zero-magnitude vector

Expected:

```text
throws error
```

---

# 6. Lexical Similarity Unit Tests

Examples:

### Exact same tokens

```text
"privacy controls matter"
"privacy controls matter"

expected similarity = 1
```

### Same tokens, different case/punctuation

```text
"Privacy Controls Matter!"
"privacy controls matter"

expected similarity = 1 after normalization
```

### Partial overlap

```text
"privacy controls matter"
"privacy and retention controls"

expected:
0 < similarity < 1
```

### No overlap

```text
"privacy retention controls"
"formula racing aerodynamics"

expected similarity = 0
```

---

# 7. Relevance Gate Unit Tests

For illustrative configuration:

```text
low  = 0.30
high = 0.60
```

Expected:

```text
relevance = 0.20 -> gate = 0
relevance = 0.30 -> gate = 0
relevance = 0.45 -> gate = 0.5
relevance = 0.60 -> gate = 1
relevance = 0.80 -> gate = 1
```

Also test:

```text
high <= low -> throws configuration error
```

The actual production thresholds must be calibrated.

---

# 8. Top-K Aggregation Unit Tests

Initial weights:

```text
0.60, 0.30, 0.10
```

Given similarities:

```text
0.9, 0.6, 0.3
```

Expected:

```text
0.60*0.9 + 0.30*0.6 + 0.10*0.3
= 0.75
```

Also test fewer than K neighbors.

Example:

```text
similarities = [0.9, 0.6]
```

Weights should be renormalized rather than treating missing third neighbor as zero.

---

# 9. Layer 2 — Behavioral Scoring Tests

Behavioral tests verify that the full scorer behaves correctly for known patterns.

To make these tests deterministic, use mocked embeddings.

This prevents:

- embedding-model updates,
- model download issues,
- hardware differences,

from affecting core scoring tests.

Real-model evaluation will be handled separately.

---

# 10. Behavioral Test Categories

The minimum categories are:

```text
A. exact duplicate
B. near duplicate
C. semantic paraphrase
D. common theme
E. novel + relevant
F. novel + irrelevant
G. borderline relevance
```

These categories should be represented both in automated tests and in the labeled evaluation dataset.

---

# 11. Category A — Exact Duplicate

Example baseline:

```json
{
  "headline": "Retention controls are essential",
  "body": "Organizations should define how long generated support summaries are stored.",
  "perspective": "concern"
}
```

Candidate:

```json
{
  "headline": "Retention controls are essential",
  "body": "Organizations should define how long generated support summaries are stored.",
  "perspective": "concern"
}
```

Expected behavior:

```text
semantic similarity       -> extremely high
lexical similarity        -> 1.0 or near 1.0
semantic novelty          -> very low
lexical novelty           -> very low
relevance                 -> high
final score               -> very low
```

Target interpretation:

```text
duplicate should be among the lowest-scoring categories
```

---

# 12. Category B — Near Duplicate

Baseline:

```text
AI-generated summaries can save support teams significant time.
```

Candidate:

```text
Support teams could save a lot of time by using AI-generated summaries.
```

Expected:

```text
semantic similarity -> high
lexical similarity  -> medium/high
final score         -> low
```

This verifies the system is not fooled by small wording changes.

---

# 13. Category C — Semantic Paraphrase

Baseline:

```text
Companies need control over how long AI-generated conversation summaries are retained.
```

Candidate:

```text
Organizations should be able to configure deletion periods for generated support records.
```

Expected:

```text
semantic similarity -> high
lexical similarity  -> possibly low
final score         -> low-to-medium
```

This demonstrates why semantic embeddings are necessary.

---

# 14. Category D — Common Theme

Assume the baseline already contains many submissions about:

```text
privacy
retention
data handling
```

Candidate:

```text
Admins should have better visibility into which conversations are stored.
```

Expected:

```text
relevance           -> high
semantic novelty    -> moderate
final score         -> moderate or lower
```

The candidate may use different wording, but the idea belongs to an already crowded theme.

---

# 15. Category E — Novel + Relevant

Example:

```text
The system should record whether an AI-generated summary was later corrected by a human agent so analytics do not treat outdated summaries as authoritative.
```

Assume this concept is absent from the baseline.

Expected:

```text
relevance           -> high
semantic novelty    -> high
lexical novelty     -> high
relevance gate      -> high
final score         -> high
```

This is the positive target behavior.

---

# 16. Category F — Novel + Irrelevant

Example:

```text
Formula One teams should receive more aerodynamic testing time next season.
```

Expected:

```text
raw novelty         -> very high
relevance           -> very low
relevance gate      -> near zero
final score         -> low
```

This is a critical test.

The system must not reward unrelated text simply because it differs from the comparison dataset.

---

# 17. Category G — Borderline Relevance

Example:

```text
AI systems should always be transparent about how personal information is processed.
```

This is broadly related to:

```text
AI
privacy
data
```

but may not directly engage with the specific product announcement.

Expected:

```text
semantic relevance  -> middle range
gate                -> partial
final score         -> suppressed relative to clearly relevant novelty
```

These cases help calibrate relevance thresholds.

---

# 18. Layer 3 — Labeled Evaluation Dataset

The main evaluation dataset should contain manually categorized candidates.

Suggested size:

```text
21–35 evaluation cases
```

Recommended distribution:

```text
exact duplicate        3
near duplicate         4
semantic paraphrase    4
common theme           4
novel + relevant       5
novel + irrelevant     5
borderline relevance   3
```

This is enough to produce useful category statistics while remaining inspectable.

---

# 19. Evaluation Dataset Must Be Separate from Baseline Dataset

Important:

```text
baseline submissions != labeled evaluation candidates
```

The ~50 baseline submissions represent existing user submissions.

The labeled evaluation cases represent new candidates being tested against them.

Do not accidentally include evaluation candidates inside the baseline.

That would contaminate evaluation.

---

# 20. Synthetic Data Generation Strategy

A hosted AI service may generate candidate examples, but labels should not be accepted blindly.

Recommended process:

```text
1. ask a hosted AI service to generate controlled examples by category
2. manually inspect every labeled case
3. edit ambiguous cases
4. store final cases as static JSON
5. do not regenerate during evaluation
```

The final evaluator should operate on fixed test data.

---

# 21. Labeled Case Shape

Suggested interface:

```ts
export type EvaluationCategory =
  | "duplicate"
  | "near_duplicate"
  | "paraphrase"
  | "common"
  | "novel_relevant"
  | "novel_irrelevant"
  | "borderline";

export interface LabeledEvaluationCase {
  id: string;
  category: EvaluationCategory;

  candidate: Submission;

  expectation: {
    minFinalScore?: number;
    maxFinalScore?: number;

    minRawNovelty?: number;
    maxRawNovelty?: number;

    minRelevance?: number;
    maxRelevance?: number;
  };

  rationale: string;
}
```

The `rationale` is valuable because it documents why the example belongs in the selected category.

---

# 22. Avoid Overly Precise Expectations Too Early

Do not begin with:

```text
duplicate must be <= 0.14
paraphrase must be between 0.22 and 0.31
novel must be >= 0.79
```

before seeing model output.

Start with broad behavioral expectations.

Example:

```text
duplicate          -> low
paraphrase         -> low-to-medium
novel_relevant     -> high
novel_irrelevant   -> low final despite high raw novelty
```

After the first real-model evaluation, convert these into reasonable numeric ranges.

---

# 23. Initial Quantitative Success Criteria

After calibration, define a small set of measurable goals.

Suggested goals:

```text
1. >= 85% labeled evaluation cases pass their expected ranges

2. mean final score of novel_relevant
   > mean final score of duplicate

3. mean final score of novel_relevant
   > mean final score of paraphrase

4. mean final score of novel_relevant
   > mean final score of common

5. mean final score of novel_relevant
   > mean final score of novel_irrelevant

6. novel_irrelevant cases show:
   high raw novelty but low final score

7. no final score is outside [0,1]
```

The `85%` pass-rate target is a practical hackathon goal, not a universal production benchmark.

If the actual result is lower, report it honestly and explain failure modes.

---

# 24. Category Mean Metrics

For each category calculate:

```text
mean final score
mean raw novelty
mean semantic novelty
mean lexical novelty
mean relevance
mean relevance gate
```

Example output:

```text
Category             Final   RawNov   SemNov   LexNov   Rel
----------------------------------------------------------------
duplicate            0.08    0.09     0.07     0.15     0.82
near_duplicate       0.18    0.20     0.17     0.36     0.79
paraphrase           0.29    0.31     0.27     0.55     0.80
common               0.42    0.45     0.41     0.65     0.78
novel_relevant       0.76    0.79     0.80     0.73     0.81
novel_irrelevant     0.05    0.88     0.91     0.72     0.22
```

Values above are illustrative only.

This table is highly useful in the final demonstration.

---

# 25. Separation Metrics

Simple separation metrics:

```text
novelVsDuplicate =
mean(novel_relevant.finalScore)
-
mean(duplicate.finalScore)
```

```text
novelVsParaphrase =
mean(novel_relevant.finalScore)
-
mean(paraphrase.finalScore)
```

```text
relevanceProtection =
mean(novel_relevant.finalScore)
-
mean(novel_irrelevant.finalScore)
```

Interpretation:

Larger positive values indicate better behavioral separation.

Do not present these as formal industry-standard metrics.

They are project-specific evaluation indicators.

---

# 26. Relevance-Gate Evaluation

The relevance gate deserves a separate analysis.

Create two groups:

```text
clearly relevant
clearly irrelevant
```

Measure source similarity distributions.

Example:

```text
Relevant:
0.49, 0.55, 0.60, 0.64, 0.70

Irrelevant:
0.12, 0.19, 0.24, 0.27, 0.31
```

Then choose:

```text
relevanceLow
relevanceHigh
```

based on observed separation.

Do not use example values as final thresholds.

---

# 27. Threshold Calibration Procedure

Calibration order must be controlled.

---

## Step 1 — Run with raw relevance only

Before gating, print relevance values for all labeled cases.

Group by:

```text
relevant
irrelevant
borderline
```

Inspect overlap.

---

## Step 2 — Choose provisional relevance thresholds

Choose:

```text
relevanceLow
relevanceHigh
```

such that:

- clearly irrelevant examples mostly fall below/near low,
- clearly relevant examples mostly fall above/near high,
- borderline cases occupy the transition region where possible.

---

## Step 3 — Lock relevance temporarily

Once the gate is reasonable, avoid changing it while tuning novelty.

---

## Step 4 — Evaluate semantic novelty

Inspect:

```text
duplicate
near_duplicate
paraphrase
common
novel_relevant
```

Compare Top-K behavior.

---

## Step 5 — Test K values only if needed

Possible candidates:

```text
K = 1
K = 3
K = 5
```

Do not search dozens of values.

---

## Step 6 — Evaluate lexical contribution

Test whether lexical similarity improves:

```text
exact copies
light rewrites
```

without over-penalizing legitimate shared domain vocabulary.

---

## Step 7 — Adjust semantic/lexical weights

Only after both signals work independently.

Candidates:

```text
90 / 10
85 / 15
80 / 20
```

Use the simplest configuration with acceptable category separation.

---

# 28. One-Change-at-a-Time Rule

When calibrating:

```text
change one meaningful parameter group at a time
```

Example:

Good:

```text
run 1 -> K=3
run 2 -> K=1
compare
```

Bad:

```text
change K
change embedding representation
change lexical algorithm
change relevance thresholds
change weights
then rerun
```

If everything changes, the reason for improvement is unknown.

---

# 29. Calibration Log

Maintain a small log:

```markdown
## Run 01
Model: ...
TopK: 3
Semantic/Lexical: 85/15
Relevance low/high: ...

Result:
- pass rate:
- novel relevant mean:
- duplicate mean:
- novel irrelevant mean:

Observation:
...

Decision:
...
```

This can be included in:

```text
docs/EVALUATION_RESULTS.md
```

or summarized in the final README.

---

# 30. Avoid Overfitting

The evaluation dataset is small.

Avoid:

- manually creating rules for individual examples,
- tuning until every case passes,
- adding many thresholds,
- selecting a dataset that makes the model look good,
- removing difficult cases without explanation.

A result such as:

```text
22 / 25 pass
```

with three understood failures is more defensible than an opaque 100% result produced by many special cases.

---

# 31. Real Embedding Model Evaluation

Core logic tests use mocked embeddings.

The full evaluation suite should also run with the real local embedding model.

This validates:

```text
real semantic behavior
relevance distributions
actual nearest-neighbor behavior
runtime performance
```

Evaluation modes:

```text
npm test
```

for deterministic unit/behavior tests,

and something like:

```text
npm run evaluate
```

for full real-model evaluation.

---

# 32. Real-Model Evaluation Output

`npm run evaluate` should produce:

```text
evaluation/results.json
```

and optionally:

```text
evaluation/results.md
```

The report should include:

```text
configuration
embedding model
baseline count
evaluation count
pass/fail
category statistics
failed cases
timing
```

---

# 33. Evaluation Report Example Structure

```markdown
# Evaluation Results

## Configuration

Embedding model: ...
Top K: 3
Neighbor weights: 0.6 / 0.3 / 0.1
Semantic/Lexical: 0.85 / 0.15
Relevance gate: ...

## Dataset

Baseline submissions: 50
Evaluation cases: 28

## Overall

Passed: 24
Failed: 4
Pass rate: 85.7%

## Category Results

| Category | Cases | Mean Final | Passed |
|---|---:|---:|---:|
| Duplicate | ... | ... | ... |
...

## Notable Failures

...

## Limitations

...
```

---

# 34. Pass/Fail Evaluation Logic

Each labeled case can define one or more expected ranges.

Example:

```json
{
  "category": "novel_irrelevant",
  "expectation": {
    "minRawNovelty": 0.65,
    "maxFinalScore": 0.25,
    "maxRelevance": 0.40
  }
}
```

A case passes only if all defined expectations pass.

Undefined expectations are ignored.

This allows different categories to test different behaviors.

---

# 35. Example Expectations by Category

These are **starting templates**, not final numeric values.

### Duplicate

```text
maxSemanticNovelty
maxFinalScore
```

### Near duplicate

```text
maxFinalScore
```

### Paraphrase

```text
maxFinalScore
```

### Common

```text
maxFinalScore or middle band
```

### Novel + relevant

```text
minRawNovelty
minRelevance
minFinalScore
```

### Novel + irrelevant

```text
minRawNovelty
maxRelevance
maxFinalScore
```

### Borderline

```text
relevance within middle interval
final score below clearly relevant novel cases
```

---

# 36. Relative Assertions

Some behavior is better tested relatively than with absolute thresholds.

Examples:

```text
score(novel_relevant)
>
score(duplicate)
```

```text
score(novel_relevant)
>
score(paraphrase)
```

```text
rawNovelty(novel_irrelevant)
>
finalScore(novel_irrelevant)
```

```text
finalScore(novel_irrelevant)
<
finalScore(novel_relevant)
```

Relative assertions are useful when embedding-score scales differ across models.

---

# 37. Recommended Combination of Assertions

Use both:

```text
absolute ranges
+
relative comparisons
```

Reason:

Absolute ranges make the score meaningful.

Relative comparisons ensure category ordering remains sensible even if model calibration shifts.

---

# 38. Regression Tests

Once calibration is accepted, freeze representative cases as regression tests.

At minimum:

```text
1 exact duplicate
1 near duplicate
1 paraphrase
1 common idea
2 novel relevant
2 novel irrelevant
1 borderline
```

If future code changes break these, investigate before accepting the change.

---

# 39. Regression Stability

Changes that can legitimately affect score distributions:

```text
embedding model change
canonical text format change
Top-K change
weight change
lexical algorithm change
relevance threshold change
```

When any of these change:

1. rerun full evaluation,
2. compare old vs new results,
3. record why the change is accepted.

---

# 40. Runtime Metrics

The project is mainly evaluated on quality, but simple runtime metrics improve the engineering story.

Record:

```text
embedding model load time
baseline embedding time
candidate scoring time
evaluation-suite total time
```

Optional:

```text
memory usage
```

Do not over-invest in performance benchmarking.

With ~50 submissions, quality is more important.

---

# 41. Performance Expectations

No strict target is required.

Reasonable hackathon expectation:

```text
baseline preparation can take some startup time
individual candidate scoring should feel interactive once embeddings are cached
```

If scoring one candidate repeatedly takes several seconds after model initialization, investigate.

---

# 42. Manual Qualitative Review

After automated evaluation:

Inspect at least:

```text
3 highest-scoring cases
3 lowest-scoring cases
3 surprising/misclassified cases
```

Ask:

- Does the score make intuitive sense?
- Are nearest neighbors relevant?
- Is low score caused by duplication or low relevance?
- Are shared domain terms distorting lexical similarity?
- Is the explanation understandable?

Record notable observations.

---

# 43. Nearest-Neighbor Inspection

For every failed evaluation case, inspect Top-3 neighbors.

Questions:

```text
Did the model retrieve the correct conceptual neighbors?
Did it miss an obvious paraphrase?
Was the candidate incorrectly matched to generic content?
Is the dataset itself ambiguous?
```

This is often more informative than changing weights immediately.

---

# 44. Dataset Quality Checks

Before trusting evaluation results:

Check baseline dataset for:

```text
duplicate IDs
empty fields
invalid perspectives
accidental exact duplicates
overly generic content
unbalanced semantic clusters
irrelevant baseline items
```

Check evaluation dataset for:

```text
ambiguous labels
candidate accidentally present in baseline
unrealistically obvious examples only
duplicate evaluation cases
```

---

# 45. Baseline Cluster Coverage

The ~50 baseline submissions should contain meaningful repeated themes.

Suggested theme coverage:

```text
time savings
privacy
retention
accuracy
human oversight
Slack/workflow integration
multilingual support
customer trust
analytics
security
admin controls
agent productivity
```

The exact themes depend on the final fixed content.

The objective is to create enough repetition that the system must distinguish:

```text
new wording
```

from:

```text
new idea
```

---

# 46. Avoid Dataset Leakage

Do not generate the 50 baseline submissions and evaluation candidates in one uncontrolled prompt where the model may duplicate exact concepts.

Better:

```text
generate baseline
inspect baseline
list semantic themes
then generate evaluation cases with explicit category constraints
```

This gives more control.

---

# 47. Adversarial Cases

If time permits, include a few adversarial tests.

---

## 47.1 Random-word padding

Candidate contains a relevant sentence followed by unrelated vocabulary.

Goal:

Test whether irrelevant padding artificially increases novelty.

---

## 47.2 Synonym-heavy paraphrase

Candidate intentionally rewrites an existing idea with different vocabulary.

Goal:

Test semantic detection.

---

## 47.3 Keyword stuffing

Candidate repeatedly includes product/source keywords but discusses nothing meaningful.

Goal:

Test whether source relevance can be gamed by surface overlap.

---

## 47.4 Mixed relevance

Candidate contains:

```text
one relevant idea
+
one unrelated paragraph
```

Goal:

Expose limitations of single-vector relevance.

---

## 47.5 Generic positive feedback

```text
"This is a great and useful feature."
```

Goal:

Check whether low-information generic feedback is accidentally treated as novel.

---

# 48. How to Handle Adversarial Failures

Do not automatically add new scoring rules.

First classify failure:

```text
model limitation
representation limitation
dataset issue
threshold issue
algorithm issue
```

Only change the system when:

```text
the fix is simple
+
the failure matters to the stated objective
+
evaluation improves without obvious regressions
```

Otherwise document it under limitations.

---

# 49. Evaluation With and Without Perspective Field

If time permits, compare:

```text
Variant A:
headline + body + perspective

Variant B:
headline + body
```

Run the same labeled evaluation.

Compare:

```text
overall pass rate
category separation
nearest-neighbor quality
relevance separation
```

Choose the simpler/better-performing representation.

Do not create a third complicated strategy unless needed.

---

# 50. Evaluation of Lexical Strategy

Initial:

```text
token Jaccard
```

If it causes poor behavior, compare with:

```text
token Jaccard
vs
token + bigram Jaccard
```

Evaluate specifically on:

```text
exact duplicates
light rewrites
shared domain vocabulary
```

Do not replace lexical scoring based only on overall pass rate.

---

# 51. Evaluation of Top-K

Only compare K values if needed.

Suggested:

```text
K = 1
K = 3
K = 5
```

Evaluate:

```text
duplicate suppression
cluster repetition
novel relevant preservation
```

Expected trade-off:

```text
smaller K -> stronger sensitivity to closest match
larger K  -> stronger awareness of repeated clusters
```

---

# 52. Success-Criteria Table

The final report should contain something like:

| Criterion | Target | Actual | Status |
|---|---:|---:|---|
| Labeled case pass rate | ≥ 85% | TBD | TBD |
| Novel relevant > duplicate mean | Yes | TBD | TBD |
| Novel relevant > paraphrase mean | Yes | TBD | TBD |
| Novel relevant > common mean | Yes | TBD | TBD |
| Novel irrelevant strongly suppressed | Yes | TBD | TBD |
| Final scores within [0,1] | 100% | TBD | TBD |
| Deterministic regression tests | Pass | TBD | TBD |

Targets can be revised if justified before final submission.

---

# 53. What Counts as a Failed Case?

A failed case is not necessarily a project failure.

Each failed case should be classified:

```text
expected model limitation
threshold issue
ambiguous label
lexical failure
semantic failure
relevance failure
dataset issue
```

Example:

```text
Case: borderline-003
Expected: partially relevant
Actual: relevance gate 1.0

Likely cause:
fixed-content embedding is broad enough that generic AI privacy
statements appear strongly relevant.

Decision:
Document limitation rather than add a special-case rule.
```

This demonstrates mature evaluation.

---

# 54. Limitations Section

The final evaluation should explicitly discuss limitations such as:

- novelty depends on baseline quality,
- embedding models may miss subtle distinctions,
- a single-vector representation may lose multi-topic detail,
- relevance thresholds are dataset/model specific,
- lexical overlap is language/domain dependent,
- synthetic data is not equivalent to real user behavior,
- ~50 submissions are too small to validate production-scale behavior,
- the score is relative to the available comparison set,
- perspective-field handling may influence embeddings.

---

# 55. Production Evaluation Improvements

If asked how evaluation would evolve in production:

### Human-labeled benchmark

Create a larger set scored by multiple human reviewers.

### Inter-rater agreement

Measure whether humans agree on novelty/relevance.

### Calibration against human judgment

Fit thresholds/weights using labeled examples.

### Online monitoring

Track:

```text
score distribution
human overrides
appeals/disagreements
false reward rate
false suppression rate
```

### A/B testing

Compare algorithm versions against user/business outcomes.

### Drift testing

Monitor whether semantic themes or score distributions shift over time.

---

# 56. Potential Production Metrics

Possible quality metrics:

```text
precision for high-novelty reward
recall for truly novel submissions
false positive rate for irrelevant reward
false negative rate for novel relevant submissions
ranking correlation with human judges
calibration error
```

These are production extensions, not required for the hackathon implementation.

---

# 57. Recommended Evaluation Files

Project structure:

```text
data/
  fixed-content.json
  submissions.json
  labeled-cases.json

evaluation/
  results.json
  results.md
  calibration-log.md

tests/
  cosine.test.ts
  lexical.test.ts
  relevance-gate.test.ts
  scoring-behavior.test.ts
  regression.test.ts
```

---

# 58. Evaluation Script Responsibilities

`evaluator.ts` should:

```text
1. load fixed content
2. load baseline submissions
3. load labeled evaluation cases
4. initialize embedding model
5. prepare/cache baseline embeddings
6. score each evaluation candidate
7. test defined expectations
8. group results by category
9. calculate summary metrics
10. output failed cases
11. write machine-readable report
12. optionally write Markdown report
```

---

# 59. Suggested Evaluation Result Type

```ts
export interface EvaluationCaseResult {
  caseId: string;
  category: EvaluationCategory;

  passed: boolean;

  failures: string[];

  score: NoveltyScoreResult;

  expectation: LabeledEvaluationCase["expectation"];
}

export interface EvaluationSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;

  categoryMetrics: Record<
    EvaluationCategory,
    {
      count: number;
      meanFinalScore: number;
      meanRawNovelty: number;
      meanRelevance: number;
      passed: number;
      failed: number;
    }
  >;

  cases: EvaluationCaseResult[];
}
```

---

# 60. Final Hackathon Presentation

Evaluation should be summarized in approximately 60–90 seconds.

Suggested structure:

```text
1. "I defined success before implementation."

2. "The evaluator contains controlled categories:
   duplicates, paraphrases, common ideas, novel relevant ideas,
   and novel irrelevant ideas."

3. Show category-result table.

4. Show one duplicate example.

5. Show one novel relevant example.

6. Show one novel irrelevant example:
   high raw novelty,
   low relevance,
   low final reward.

7. State measured pass rate.

8. Mention one known limitation.
```

This demonstrates the project rather than merely claiming it works.

---

# 61. Most Important Demo Example

The strongest demo case should be:

```text
candidate is unrelated to the source
```

and show:

```text
rawNovelty     = high
relevance      = low
relevanceGate  = low
finalScore     = low
```

This directly demonstrates the architecture's central design decision.

---

# 62. Second Most Important Demo Example

Show a semantic paraphrase.

Example:

Baseline:

```text
"Companies should control retention periods for AI summaries."
```

Candidate:

```text
"Admins need configurable deletion windows for generated support records."
```

Demonstrate:

```text
lexical overlap may be low
semantic similarity is high
novelty reward remains limited
```

This proves semantic embeddings add value beyond keyword matching.

---

# 63. Third Most Important Demo Example

Show a genuinely novel relevant idea.

Demonstrate:

```text
low similarity to nearest baseline ideas
high relevance to source
high final score
```

Together, these three examples explain almost the entire system.

---

# 64. Definition of Evaluation Done

Evaluation is complete when:

```text
[ ] unit tests pass
[ ] behavioral tests pass
[ ] ~50 baseline submissions exist
[ ] labeled evaluation dataset exists
[ ] evaluation dataset is separate from baseline
[ ] real local embedding model is used in full evaluation
[ ] relevance thresholds are empirically calibrated
[ ] all final scores remain in [0,1]
[ ] category means are calculated
[ ] overall pass rate is calculated
[ ] failed cases are visible
[ ] at least one limitation is documented
[ ] results.json is generated
[ ] results.md is generated or README contains equivalent summary
[ ] representative demo cases are selected
```

---

# 65. Decisions Locked by This Document

The following are now part of the evaluation strategy:

```text
evaluation is defined before final calibration
baseline and evaluation datasets stay separate
unit tests use deterministic inputs/mocked embeddings where appropriate
real-model evaluation is run separately
evaluation uses controlled behavioral categories
results are aggregated by category
novel irrelevant cases must demonstrate high raw novelty but low final score
calibration uses one-change-at-a-time experiments
failed cases are reported, not hidden
final evaluation includes limitations
```

---

# 66. Decisions Deferred Until Real Results Exist

Do not finalize yet:

```text
exact numeric pass bands
final relevanceLow
final relevanceHigh
final minimum score for novel_relevant
final maximum score for duplicate
final maximum score for novel_irrelevant
whether Top-3 remains optimal
whether perspective belongs in embedding text
whether token Jaccard is sufficient
whether 85/15 semantic/lexical weights remain
whether duplicate override is required
```

These should be decided from actual evaluation output.
