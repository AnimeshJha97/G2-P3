# Scoring Design

## G2 AI Hiring Hackathon — Problem 3
### Rewarding Novelty in Submissions

**Submission context:** I designed this scoring approach before implementation, then calibrated only the relevance thresholds using the recorded evaluation process. Post-evaluation edge-case fixes (input word limits, the fixed content as a comparison neighbor, English-only scope) are recorded in section 58 and do not change the locked parameters. I retained the full design rationale here; the locked configuration and measured limitations are reported in [evaluation/results.md](../evaluation/results.md).

**Purpose:** Record my novelty-scoring algorithm in implementation-ready detail so I did not invent the scoring logic during the build.

This document is subordinate to:

- `PROJECT_DECISION.md`
- `ARCHITECTURE.md`

If implementation details conflict with those documents, prefer the higher-level project decisions unless evaluation results provide a clear reason to revise them.

---

# 1. Scoring Objective

The system evaluates one new structured user submission against:

1. a fixed source/content item, and
2. approximately 50 existing submissions responding to that same fixed content.

The output is a normalized score:

```text
0.0 <= finalScore <= 1.0
```

The score should represent:

> How novel is this submission relative to previous submissions, while still remaining sufficiently relevant to the fixed source content?

The key behaviors are:

```text
novel + relevant         -> high score
duplicate + relevant     -> low score
paraphrase + relevant    -> low-to-medium score
common idea + relevant   -> low-to-medium score
novel + irrelevant       -> low score
```

The scoring design intentionally separates:

```text
NOVELTY
```

from:

```text
RELEVANCE
```

Relevance is used as a gate on the novelty reward.

---

# 2. Why Not Use an LLM as the Primary Judge?

A generative LLM could be asked:

> "Score this submission from 0 to 1 for novelty."

That is not the primary design because it introduces:

- non-determinism,
- API dependency,
- harder regression testing,
- model-version sensitivity,
- difficult threshold calibration,
- weaker mathematical explainability,
- higher cost and latency.

Instead, the runtime scoring system will use deterministic computations over local embeddings and lexical overlap.

A hosted AI service may still be used to:

- generate synthetic baseline submissions,
- generate evaluation cases,
- create adversarial examples during development.

The production scoring path does not require a hosted AI service.

---

# 3. Submission Model

The current submission shape is:

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

Fixed content:

```ts
export interface FixedContent {
  id: string;
  title?: string;
  body: string;
}
```

---

# 4. Scoring Pipeline

High-level pipeline:

```text
Candidate Submission
        |
        v
Canonical Representation
        |
        +--------------------------+
        |                          |
        v                          v
Semantic Representation      Lexical Representation
(local embedding)            (normalized tokens/ngrams)
        |                          |
        v                          v
Compare against all           Compare against all
baseline submissions          baseline submissions
        |                          |
        v                          v
Top semantic neighbors        Maximum lexical similarity
        |                          |
        v                          v
Semantic novelty             Lexical novelty
        |                          |
        +-------------+------------+
                      |
                      v
                 Raw novelty
                      |
                      |
Fixed Source ---------+
      |
      v
Source embedding
      |
      v
Candidate/source similarity
      |
      v
Relevance gate
      |
      v
Final score
      |
      v
Explanation object
```

---

# 5. Canonical Semantic Representation

Each submission must be converted into a stable text form before embedding.

Initial representation:

```text
Headline: {headline}
Body: {body}
Perspective: {perspective}
```

Implementation helper:

```ts
function toSemanticText(submission: Submission): string {
  return [
    `Headline: ${submission.headline.trim()}`,
    `Body: ${submission.body.trim()}`,
    `Perspective: ${submission.perspective}`,
  ].join("\n");
}
```

---

## 5.1 Why Use a Canonical Format?

Without a canonical format, equivalent data can produce unnecessary variation.

For example:

```text
Privacy concerns | concern | We need retention controls
```

and:

```text
Concern: We need retention controls. Privacy concerns.
```

contain similar information but expose different structure to the embedding model.

A consistent representation reduces formatting noise.

---

## 5.2 Should `perspective` Be Included in the Embedding?

Initial choice:

```text
YES
```

Reason:

The third field is part of the user's structured response and may carry meaningful intent.

However, this is an empirical decision.

Potential problem:

```text
"Perspective: concern"
```

could artificially increase similarity among all concern submissions even when their actual ideas differ.

Therefore, evaluate two variants if time permits:

### Variant A

```text
headline + body + perspective
```

### Variant B

```text
headline + body
```

while keeping `perspective` available as separate structured metadata.

Select the variant that better separates the labeled cases.

Do **not** create a separate perspective weight unless evaluation demonstrates that it is necessary.

---

# 6. Canonical Fixed-Content Representation

For the fixed source:

```ts
function toFixedContentText(content: FixedContent): string {
  if (content.title?.trim()) {
    return `Title: ${content.title.trim()}\nBody: ${content.body.trim()}`;
  }

  return content.body.trim();
}
```

The same source representation must be reused throughout scoring and evaluation.

---

# 7. Embedding Strategy

The system will use a small local sentence/document embedding model.

Required properties:

- runnable locally,
- usable from Node.js/TypeScript,
- acceptable inference speed on a normal laptop,
- semantically meaningful sentence embeddings,
- no paid API dependency.

The exact model remains configurable.

---

## 7.1 Embedding Interface

```ts
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

The scorer must depend on this interface rather than on a specific model.

---

## 7.2 Vector Normalization

If the selected model does not already return normalized vectors, normalize to unit length:

```text
v_normalized = v / ||v||
```

where:

```text
||v|| = sqrt(sum(v_i^2))
```

This allows cosine similarity to be calculated reliably.

---

# 8. Cosine Similarity

For vectors `a` and `b`:

```text
cosine(a, b) =
(a · b)
-------
||a|| ||b||
```

Expanded:

```text
dot = sum(a_i * b_i)

magnitudeA = sqrt(sum(a_i^2))
magnitudeB = sqrt(sum(b_i^2))

cosine = dot / (magnitudeA * magnitudeB)
```

Implementation:

```ts
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    throw new Error("Cannot compare empty vectors");
  }

  if (a.length !== b.length) {
    throw new Error("Embedding dimensions do not match");
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) {
    throw new Error("Cannot compare zero-magnitude vectors");
  }

  const raw = dot / (Math.sqrt(magA) * Math.sqrt(magB));

  return clampSimilarity(raw);
}
```

---

## 8.1 Similarity Range

Raw cosine similarity mathematically ranges:

```text
[-1, 1]
```

For semantic sentence embeddings, most useful values may be non-negative, but do not assume this blindly.

The scoring layer wants a stable:

```text
[0, 1]
```

similarity.

Two possible handling strategies:

### Strategy A — clamp

```text
similarity = clamp(rawCosine, 0, 1)
```

Preferred initially because negative semantic similarity can reasonably be treated as "not similar."

### Strategy B — remap

```text
similarity = (rawCosine + 1) / 2
```

This maps:

```text
-1 -> 0
 0 -> 0.5
 1 -> 1
```

This can incorrectly make orthogonal text look moderately similar.

Therefore:

```text
Initial choice = CLAMP
```

---

# 9. Semantic Comparison Against Baseline

For a candidate vector `C` and baseline vectors:

```text
B1 ... Bn
```

calculate:

```text
sim_i = cosine(C, Bi)
```

Result:

```ts
interface SemanticMatch {
  submissionId: string;
  similarity: number;
}
```

Sort descending:

```text
s1 >= s2 >= ... >= sn
```

---

# 10. Top-K Nearest-Neighbor Aggregation

The novelty score should be dominated by the closest existing ideas, not by the average similarity to all submissions.

Initial:

```text
K = 3
```

Weights:

```text
w1 = 0.60
w2 = 0.30
w3 = 0.10
```

Then:

```text
nearestSemanticSimilarity =
0.60*s1 + 0.30*s2 + 0.10*s3
```

Semantic novelty:

```text
semanticNovelty =
1 - nearestSemanticSimilarity
```

---

## 10.1 Why Top-K?

Consider:

```text
baseline size = 50

candidate:
- nearly identical to 1 existing submission
- very different from 49 others
```

Mean similarity could be low:

```text
candidate appears "novel"
```

even though it is effectively a duplicate.

Top-K avoids this.

---

## 10.2 Why Top-3?

Top-1 answers:

> "Is there one submission very similar to this?"

Top-3 additionally answers:

> "Does this candidate belong to an already common local semantic cluster?"

This is useful because novelty is relative not only to exact duplicates but also to repeated ideas.

Top-3 remains an initial hypothesis.

Potential alternatives:

```text
K = 1
K = 3
K = 5
```

Compare during evaluation.

---

## 10.3 Fewer Than K Baseline Submissions

If:

```text
baseline.length < K
```

use all available neighbors and renormalize the corresponding weights.

Example with 2 baselines:

Original weights:

```text
0.60, 0.30
```

sum:

```text
0.90
```

normalized:

```text
0.6667, 0.3333
```

Do not silently treat missing neighbors as zero similarity because that would artificially increase novelty.

---

# 11. Optional Duplicate Override

A possible improvement is an explicit duplicate/near-duplicate rule.

Example:

```text
if topSemanticSimilarity >= duplicateSemanticThreshold
   OR maxLexicalSimilarity >= duplicateLexicalThreshold:
       semantic/overall novelty can be capped
```

Why this may help:

A candidate that is almost identical to one submission should not recover a high novelty score because the next two neighbors are less similar.

However:

```text
Do NOT implement this immediately.
```

First evaluate the simpler Top-K formula.

Add an override only if near-duplicates score too highly.

This is an example of keeping the algorithm minimal until a measured failure justifies added complexity.

---

# 12. Lexical Representation

Lexical comparison is intended to detect direct textual reuse and lightly edited copies.

The lexical representation will normalize text more aggressively than the semantic representation.

Initial combined lexical text:

```text
{headline} {body}
```

Do not include `perspective` initially because category words could inflate overlap.

---

## 12.1 Lexical Normalization

Suggested pipeline:

```text
1. lowercase
2. Unicode normalize if needed
3. replace punctuation with spaces
4. collapse repeated whitespace
5. split into tokens
6. remove empty tokens
```

Example:

```text
"AI Summaries: Great for Support!"
```

becomes:

```text
["ai", "summaries", "great", "for", "support"]
```

---

## 12.2 Stop Words

Initial choice:

```text
KEEP stop words
```

Reason:

The dataset is small and direct copying can include function words.

Stop-word removal may be tested later if common words create too much lexical similarity.

---

# 13. Lexical Similarity — Initial Method

Initial method:

```text
Token Jaccard Similarity
```

For token sets `A` and `B`:

```text
J(A, B) =
|A ∩ B|
-------
|A ∪ B|
```

Implementation:

```ts
function jaccardSimilarity(aTokens: string[], bTokens: string[]): number {
  const a = new Set(aTokens);
  const b = new Set(bTokens);

  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;

  if (union === 0) return 0;

  return intersection / union;
}
```

---

## 13.1 Limitation of Simple Token Jaccard

These two sentences:

```text
AI summaries improve support agent productivity.
```

and:

```text
Support productivity improves with AI summaries.
```

have high overlap, correctly detected.

But:

```text
Automatic conversation digests reduce handling time.
```

expresses a similar idea with very different words.

Jaccard will not catch this.

That is acceptable because semantic embeddings are responsible for semantic similarity.

The lexical component is intentionally complementary.

---

# 14. Optional N-Gram Lexical Comparison

If simple token Jaccard is too forgiving for lightly edited copies, compare word bigrams.

Example:

```text
"ai summaries save time"
```

bigrams:

```text
"ai summaries"
"summaries save"
"save time"
```

This detects phrase-level copying better than unordered token sets.

Possible combined lexical similarity:

```text
lexicalSimilarity =
0.50 * tokenJaccard
+
0.50 * bigramJaccard
```

Only add this if evaluation shows value.

---

# 15. Lexical Novelty

For candidate `C` and baselines:

```text
lexSim_i = lexical(C, Bi)
```

Then:

```text
maxLexicalSimilarity =
max(lexSim_1 ... lexSim_n)
```

Lexical novelty:

```text
lexicalNovelty =
1 - maxLexicalSimilarity
```

Use max rather than mean because one copied submission is enough to indicate low textual novelty.

---

# 16. Raw Novelty

Initial formula:

```text
rawNovelty =
semanticWeight * semanticNovelty
+
lexicalWeight * lexicalNovelty
```

Initial configuration:

```text
semanticWeight = 0.85
lexicalWeight  = 0.15
```

Constraint:

```text
semanticWeight + lexicalWeight = 1
```

Final:

```text
rawNovelty = clamp(rawNovelty, 0, 1)
```

---

## 16.1 Why 85% Semantic?

Novelty is primarily about whether the candidate introduces a new idea, not merely different wording.

Therefore semantic similarity should dominate.

Lexical overlap is a supporting duplicate-detection signal.

Initial hypothesis:

```text
semantic = 85%
lexical  = 15%
```

Candidate alternatives for evaluation:

```text
90 / 10
85 / 15
80 / 20
```

Avoid broad hyperparameter searching.

The goal is defensible engineering, not overfitting a tiny dataset.

---

# 17. Relevance Score

Relevance measures whether the candidate actually responds to the fixed source content.

Calculate:

```text
relevanceSimilarity =
cosine(
  candidateEmbedding,
  fixedContentEmbedding
)
```

after applying the same cosine normalization policy.

Expected:

```text
0 <= relevanceSimilarity <= 1
```

---

# 18. Why Relevance Must Be Separate

Example:

Fixed content:

```text
AI support assistant announcement
```

Candidate:

```text
Formula One aerodynamic regulations need reform.
```

Against 50 support-related submissions:

```text
semantic novelty = extremely high
lexical novelty  = extremely high
```

Without relevance handling:

```text
final novelty = extremely high
```

which is wrong.

Therefore:

```text
novelty asks:
"Is this different from prior responses?"

relevance asks:
"Is this actually a valid response to the source?"
```

The final reward must satisfy both.

---

# 19. Relevance Gate — Preferred Design

Preferred initial design:

```text
piecewise linear gate
```

Parameters:

```text
relevanceLow
relevanceHigh
```

Function:

```text
if relevance <= relevanceLow:
    gate = 0

else if relevance >= relevanceHigh:
    gate = 1

else:
    gate =
      (relevance - relevanceLow)
      /
      (relevanceHigh - relevanceLow)
```

Implementation:

```ts
function relevanceGate(
  relevance: number,
  low: number,
  high: number
): number {
  if (high <= low) {
    throw new Error("relevanceHigh must be greater than relevanceLow");
  }

  if (relevance <= low) return 0;
  if (relevance >= high) return 1;

  return (relevance - low) / (high - low);
}
```

---

# 20. Why Piecewise Linear Instead of Hard Threshold?

Hard threshold:

```text
0.499 -> rejected
0.501 -> fully accepted
```

This is brittle.

Piecewise linear gating allows:

```text
clearly irrelevant -> 0
borderline         -> partial suppression
clearly relevant   -> 1
```

It remains easy to explain.

---

# 21. Why Not Use Sigmoid Initially?

A sigmoid could be:

```text
gate = 1 / (1 + exp(-k * (relevance - midpoint)))
```

but introduces:

- `k`,
- midpoint,
- less intuitive calibration.

For a hackathon:

```text
piecewise linear > sigmoid
```

unless evaluation shows a strong reason otherwise.

---

# 22. Relevance Threshold Selection

Do **not** choose `relevanceLow` and `relevanceHigh` before observing real embedding scores.

Procedure:

1. Generate baseline and labeled evaluation data.
2. Score clearly relevant examples against source content.
3. Score clearly irrelevant examples.
4. Inspect distributions.
5. Choose thresholds that create separation.

Example only:

```text
irrelevant examples:
0.20, 0.24, 0.29, 0.31

relevant examples:
0.48, 0.55, 0.61, 0.67
```

Potential thresholds might then be:

```text
low  = 0.32
high = 0.50
```

These numbers are illustrative only.

Never copy them into production configuration without measuring the selected embedding model.

---

# 23. Final Score

Final:

```text
finalScore =
rawNovelty * relevanceGate
```

Then:

```text
finalScore = clamp(finalScore, 0, 1)
```

This guarantees:

```text
gate = 0 -> final = 0
gate = 1 -> final = raw novelty
```

and borderline relevance partially suppresses novelty.

---

# 24. Optional Relevance Floor Rule

If evaluation shows irrelevant content still gets non-trivial reward in the transition zone, add:

```text
if relevance < absoluteMinimumRelevance:
    finalScore = 0
```

Do not add this unless necessary.

The piecewise gate already contains a natural zero region.

---

# 25. Complete Formula — Initial Version

Let:

```text
S1 >= S2 >= S3
```

be top semantic similarities.

Semantic similarity aggregate:

```text
semanticSimilarity =
0.60*S1 + 0.30*S2 + 0.10*S3
```

Semantic novelty:

```text
semanticNovelty =
1 - semanticSimilarity
```

Lexical similarity:

```text
lexicalSimilarity =
max Jaccard(candidate, eachBaseline)
```

Lexical novelty:

```text
lexicalNovelty =
1 - lexicalSimilarity
```

Raw novelty:

```text
rawNovelty =
0.85*semanticNovelty
+
0.15*lexicalNovelty
```

Relevance:

```text
relevance =
cosine(candidateEmbedding, sourceEmbedding)
```

Gate:

```text
0                              relevance <= low

(relevance-low)/(high-low)     low < relevance < high

1                              relevance >= high
```

Final:

```text
finalScore =
clamp(rawNovelty * gate, 0, 1)
```

---

# 26. Score Interpretation

The official requirement is only a normalized `[0,1]` score.

Human-friendly labels may be useful for demo purposes but should not replace the numeric score.

Potential presentation-only bands:

```text
0.00 - 0.24  very low novelty reward
0.25 - 0.49  low novelty reward
0.50 - 0.69  moderate novelty reward
0.70 - 0.84  high novelty reward
0.85 - 1.00  very high novelty reward
```

These bands are **not part of core scoring logic** and should not be presented as empirically validated unless tested.

Prefer to display:

```text
Score: 0.74
```

plus the component scores rather than making qualitative claims.

---

# 27. Nearest-Neighbor Explanation

The scorer should return the closest baseline submissions.

Suggested:

```ts
export interface NeighborScore {
  submissionId: string;
  semanticSimilarity: number;
  lexicalSimilarity: number;
}
```

Return at least Top-3.

This allows explanations like:

```text
Candidate scored 0.71.

Closest existing idea:
submission-018
semantic similarity: 0.52

Second closest:
submission-041
semantic similarity: 0.46
```

This makes the scoring process auditable.

---

# 28. Scoring Output

Suggested return type:

```ts
export interface NoveltyScoreResult {
  finalScore: number;

  semantic: {
    topK: number;
    aggregatedSimilarity: number;
    novelty: number;
  };

  lexical: {
    maxSimilarity: number;
    novelty: number;
  };

  rawNovelty: number;

  relevance: {
    similarity: number;
    gate: number;
  };

  nearestNeighbors: NeighborScore[];

  configVersion?: string;
}
```

---

# 29. Why Return Intermediate Scores?

If the output is only:

```json
{
  "finalScore": 0.28
}
```

it is difficult to explain why.

Intermediate outputs allow us to distinguish:

### Case A

```text
low score because submission is duplicate
```

from:

### Case B

```text
low score because submission is irrelevant
```

Those are fundamentally different reasons.

Example:

```text
Case A:
semanticNovelty = 0.12
relevanceGate   = 1.00
finalScore      = 0.15

Case B:
semanticNovelty = 0.91
relevanceGate   = 0.05
finalScore      = 0.05
```

This is a strong demonstration feature.

---

# 30. Configuration Object

All tunable values belong in one configuration object.

```ts
export interface ScoringConfig {
  topK: number;

  semanticNeighborWeights: number[];

  semanticWeight: number;
  lexicalWeight: number;

  relevanceLow: number;
  relevanceHigh: number;

  duplicateSemanticThreshold?: number;
  duplicateLexicalThreshold?: number;
}
```

Example initial config:

```ts
export const scoringConfig: ScoringConfig = {
  topK: 3,

  semanticNeighborWeights: [0.6, 0.3, 0.1],

  semanticWeight: 0.85,
  lexicalWeight: 0.15,

  relevanceLow: 0,   // calibrate from data
  relevanceHigh: 0,  // calibrate from data
};
```

Do not leave zero thresholds active when running final evaluation.

---

# 31. Config Validation

Validate at startup:

```text
topK > 0
neighborWeights.length >= topK
all weights >= 0
sum(active neighbor weights) > 0
semanticWeight >= 0
lexicalWeight >= 0
semanticWeight + lexicalWeight approximately 1
relevanceHigh > relevanceLow
```

Fail early if configuration is invalid.

---

# 32. Full Scoring Pseudocode

```text
function score(candidate, fixedContent, baselines):

    validate(candidate)
    validate(fixedContent)
    require baselines.length > 0

    candidateSemanticText =
        canonicalize(candidate)

    candidateLexicalText =
        headline + " " + body

    candidateEmbedding =
        embed(candidateSemanticText)

    sourceEmbedding =
        getOrCreateEmbedding(fixedContent)

    baselineEmbeddings =
        getOrCreateBaselineEmbeddings(baselines)

    semanticMatches = []

    for each baseline:
        sim =
            cosine(
                candidateEmbedding,
                baselineEmbedding
            )

        semanticMatches.push({
            id: baseline.id,
            similarity: sim
        })

    sort semanticMatches descending

    topMatches =
        take first min(K, baseline count)

    normalizedNeighborWeights =
        normalize active K weights

    aggregatedSemanticSimilarity =
        weighted average of topMatches

    semanticNovelty =
        1 - aggregatedSemanticSimilarity

    lexicalMatches = []

    for each baseline:
        lexicalSim =
            lexicalSimilarity(
                candidate,
                baseline
            )

        lexicalMatches.push({
            id: baseline.id,
            similarity: lexicalSim
        })

    maxLexicalSimilarity =
        max lexical similarity

    lexicalNovelty =
        1 - maxLexicalSimilarity

    rawNovelty =
        semanticWeight * semanticNovelty
        +
        lexicalWeight * lexicalNovelty

    relevance =
        cosine(
            candidateEmbedding,
            sourceEmbedding
        )

    gate =
        piecewiseLinearGate(
            relevance,
            relevanceLow,
            relevanceHigh
        )

    finalScore =
        clamp(
            rawNovelty * gate,
            0,
            1
        )

    return {
        finalScore,
        semantic metrics,
        lexical metrics,
        rawNovelty,
        relevance metrics,
        top neighbors
    }
```

---

# 33. TypeScript-Oriented Function Breakdown

Prefer small pure functions.

```ts
canonicalizeSubmission()
normalizeLexicalText()

cosineSimilarity()
jaccardSimilarity()

findSemanticNeighbors()
aggregateNeighborSimilarity()

calculateSemanticNovelty()
calculateLexicalNovelty()

calculateRawNovelty()

calculateRelevance()
calculateRelevanceGate()

calculateFinalScore()
```

Then orchestration:

```ts
NoveltyScorer.score()
```

Pure functions make tests easy and reduce agent-generated debugging complexity.

---

# 34. Baseline Embedding Preparation

Avoid embedding all 50 baseline submissions for every candidate.

At startup:

```text
load baseline
-> canonicalize
-> embedMany
-> cache
```

Data shape:

```ts
interface EmbeddedSubmission {
  submission: Submission;
  vector: number[];
}
```

Then each new score requires only:

```text
1 candidate embedding
+
similarity calculations
```

---

# 35. Fixed-Content Embedding Cache

The source embedding is constant for the project.

Compute once:

```text
fixed content
-> embedding
-> cache
```

Never re-embed for every test unless testing the embedding provider itself.

---

# 36. Calibration Dataset

Use labeled examples that intentionally cover behaviors.

Minimum categories:

```text
duplicate
near_duplicate
paraphrase
common
novel_relevant
novel_irrelevant
borderline_relevance
```

Recommended:

```text
3-5 labeled candidates per category
```

This produces enough evidence to inspect score distributions without turning the hackathon into a large research experiment.

---

# 37. Calibration Workflow

Initial run:

```text
default config
      |
      v
score all labeled cases
      |
      v
group by category
      |
      v
inspect:
- final score
- semantic novelty
- lexical novelty
- relevance
- gate
      |
      v
identify failure
      |
      v
change ONE parameter/group
      |
      v
rerun
```

---

# 38. Calibration Priority

Tune in this order:

## Step 1 — relevance thresholds

First ensure:

```text
novel irrelevant -> suppressed
relevant examples -> not unnecessarily suppressed
```

If relevance gating is wrong, novelty weights do not matter.

---

## Step 2 — semantic Top-K behavior

Ensure:

```text
duplicates/paraphrases -> low semantic novelty
novel relevant ideas   -> higher semantic novelty
```

Try:

```text
K = 1
K = 3
K = 5
```

only if needed.

---

## Step 3 — lexical contribution

Check whether:

```text
exact copies
light rewrites
```

are sufficiently penalized.

Adjust lexical method/weight only when semantic similarity alone is insufficient.

---

## Step 4 — final weights

Only after components behave correctly.

---

# 39. What Not to Do During Calibration

Avoid:

- changing five parameters at once,
- tuning specifically for one test case,
- choosing thresholds because they "look good,"
- repeatedly regenerating the dataset until results improve,
- hiding failed cases,
- creating overly specific exception rules.

A limitation that is measured and documented is better than an opaque overfit scoring system.

---

# 40. Behavioral Test Expectations

Exact numeric thresholds will be calibrated, but directional expectations should be locked now.

---

## 40.1 Exact duplicate

Candidate:

```text
identical headline/body to existing item
```

Expected:

```text
semantic similarity -> very high
lexical similarity  -> very high
semantic novelty    -> very low
lexical novelty     -> very low
relevance           -> high
final score         -> very low
```

---

## 40.2 Light rewrite

Example baseline:

```text
AI summaries will save support agents significant time.
```

Candidate:

```text
Support agents could save a lot of time using AI-generated summaries.
```

Expected:

```text
semantic similarity -> high
lexical similarity  -> medium/high
final score         -> low
```

---

## 40.3 Semantic paraphrase

Baseline:

```text
Companies need control over how long customer conversation summaries are retained.
```

Candidate:

```text
Organizations should be able to define deletion periods for generated support records.
```

Expected:

```text
semantic similarity -> high
lexical similarity  -> potentially low
final score         -> low-to-medium
```

This demonstrates the value of embeddings.

---

## 40.4 Common theme with a distinct angle

If many submissions discuss privacy, a new privacy comment with a somewhat different angle should not automatically receive maximum novelty.

Expected:

```text
nearest neighbors -> same cluster
semantic novelty  -> medium
final score       -> medium at most
```

---

## 40.5 Novel and relevant

Example:

```text
The system should identify when an AI-generated summary was later corrected by an agent so downstream analytics do not treat the original summary as authoritative.
```

If baseline submissions do not discuss this:

Expected:

```text
relevance -> high
novelty   -> high
final     -> high
```

---

## 40.6 Novel but irrelevant

Example:

```text
Formula One teams should have fewer aerodynamic testing restrictions.
```

Expected:

```text
raw novelty -> high
relevance   -> low
gate        -> near zero
final       -> low
```

This is a critical required behavior.

---

## 40.7 Borderline relevance

Example:

```text
AI tools should generally disclose how they use personal data.
```

This relates broadly to AI/privacy but may not directly respond to the product announcement.

Expected:

```text
relevance gate -> partial
final score    -> suppressed
```

Borderline cases are useful for explaining limitations.

---

# 41. Edge Case — Very Short Submission

Example:

```json
{
  "headline": "Great idea",
  "body": "Useful.",
  "perspective": "support"
}
```

Possible issue:

Very short generic text can produce unstable semantic behavior.

Initial handling:

- require minimum reasonable field lengths,
- or allow scoring but document low-information behavior.

Preferred:

Add simple validation:

```text
headline non-empty
body minimum length/word count
```

Avoid arbitrary severe restrictions unless needed.

---

# 42. Edge Case — Very Long Submission

A very long body can dominate the embedding.

Initial mitigation:

- set a reasonable maximum body length,
- validate before embedding.

The exact limit is not part of the core challenge, so keep it simple.

---

# 43. Edge Case — Candidate Matches Multiple Clusters

Top-3 aggregation naturally captures this.

If candidate is similar to several existing ideas:

```text
s1 high
s2 high
s3 high
```

aggregated similarity rises and novelty falls.

This is desirable.

---

# 44. Edge Case — Candidate Has One Near Duplicate but Others Differ

Example:

```text
s1 = 0.96
s2 = 0.35
s3 = 0.30
```

Initial aggregate:

```text
0.60*0.96 + 0.30*0.35 + 0.10*0.30
= 0.711
```

Semantic novelty:

```text
0.289
```

This may or may not be low enough.

If evaluation shows duplicate cases still score too high, possible fixes:

1. increase `w1`,
2. use Top-1,
3. add duplicate cap/override.

Prefer the least complex change that fixes measured behavior.

---

# 45. Edge Case — Empty Baseline Dataset

Novelty relative to prior submissions is undefined.

Behavior:

```text
throw error
```

Do not return:

```text
1.0
```

because that would imply perfect novelty without evidence.

---

# 46. Edge Case — Duplicate Candidate ID

IDs are identifiers, not scoring features.

If candidate ID matches an existing submission ID:

- either reject as invalid,
- or exclude that baseline item if evaluating an updated version.

For the hackathon, rejecting duplicate IDs is simplest.

---

# 47. Edge Case — Perspective Mismatch

Example:

```text
headline/body express support
perspective = concern
```

Do not build a special consistency classifier initially.

The embedding may capture some inconsistency if perspective is included.

If asked:

> "How would production handle malformed structured submissions?"

Answer:

- validate allowed values,
- optionally add semantic consistency checks,
- monitor structured-field abuse.

Not required for core scoring.

---

# 48. Explainability Output

The user/demo should be able to see:

```text
Final novelty reward       0.xx

Raw novelty               0.xx
Semantic novelty          0.xx
Lexical novelty           0.xx
Relevance                 0.xx
Relevance gate            0.xx

Closest existing submissions:
1. ID / semantic similarity / lexical similarity
2. ID / semantic similarity / lexical similarity
3. ID / semantic similarity / lexical similarity
```

This explains both:

```text
"what score?"
```

and:

```text
"why?"
```

---

# 49. Optional Human-Readable Explanation

A deterministic explanation can be generated without an LLM.

Example logic:

```text
if relevanceGate < 0.2:
  "The submission is substantially different from prior submissions,
   but it has low relevance to the source content."

else if semanticNovelty < 0.25:
  "The submission is relevant, but closely matches existing ideas."

else if finalScore > 0.7:
  "The submission is relevant and introduces an idea that is not
   strongly represented in the existing submissions."
```

This is optional.

Do not spend time on prose generation before evaluation works.

---

# 50. Score Stability

The deterministic scoring layer should ensure:

```text
same:
- source
- candidate
- baseline
- model
- config

=> same score
```

Record:

```text
model identifier
config version
```

in evaluation output if easy.

This improves reproducibility.

---

# 51. Evaluation Output Format

Useful machine-readable report:

```json
{
  "config": {
    "topK": 3,
    "semanticWeight": 0.85,
    "lexicalWeight": 0.15,
    "relevanceLow": 0.0,
    "relevanceHigh": 0.0
  },
  "summary": {
    "total": 24,
    "passed": 21,
    "failed": 3,
    "passRate": 0.875
  },
  "categoryMeans": {
    "duplicate": 0.10,
    "paraphrase": 0.28,
    "novel_relevant": 0.77,
    "novel_irrelevant": 0.05
  },
  "cases": []
}
```

Values are illustrative only.

---

# 52. Core Success Criteria

The final calibrated system should demonstrate measurable separation.

Directional criteria:

```text
mean(novel_relevant)
>
mean(duplicate)

mean(novel_relevant)
>
mean(paraphrase)

mean(novel_relevant)
>
mean(common)

mean(novel_relevant)
>
mean(novel_irrelevant)
```

Additionally:

```text
novel_irrelevant
```

should remain low despite high raw novelty.

Exact numeric success thresholds belong in `EVALUATION_PLAN.md`.

---

# 53. Potential Failure Modes

## 53.1 Embedding model does not distinguish relevance well

Symptoms:

```text
relevant and irrelevant source similarity distributions overlap heavily
```

Possible responses:

1. try a better local embedding model,
2. change source/candidate representation,
3. add simple keyword/topic relevance,
4. document limitation.

Do not immediately replace the system with an LLM judge.

---

## 53.2 Generic submissions appear too novel

Example:

```text
"This is an interesting feature."
```

may not match any specific cluster strongly.

Potential mitigation:

- minimum-content validation,
- generic-content baseline examples,
- low-information penalty if clearly needed.

Only implement if measured.

---

## 53.3 Paraphrases score too high

Potential responses:

1. verify embedding model,
2. increase Top-1 influence,
3. compare candidate vs semantic cluster,
4. reduce dependence on lexical novelty.

---

## 53.4 Same topic but genuinely new angle scores too low

Potential responses:

- reduce `K`,
- decrease weight of broad cluster neighbors,
- improve embedding representation,
- inspect whether dataset contains overly broad generic examples.

---

## 53.5 Lexical overlap over-penalizes shared necessary terminology

Example:

All responses may naturally contain:

```text
AI
support
summary
customer
```

Token Jaccard may exaggerate similarity.

Potential fixes:

- bigram comparison,
- TF-IDF weighting,
- domain stop words,
- reduce lexical weight.

Again: only if observed.

---

# 54. Future Production Improvements

Not required onsite, but useful for discussion.

Potential improvements:

### Cluster-aware novelty

Compare candidate to semantic clusters rather than only individual neighbors.

### Density-aware novelty

Reward candidates in sparse regions of embedding space and reduce reward in dense regions.

### Time-aware novelty

A submission may be novel when first posted but less novel later.

### Topic-conditioned relevance

Measure relevance at topic/aspect level.

### Human calibration

Collect human novelty judgments and fit/calibrate scoring parameters.

### Learned ranking/scoring

Train a model using human labels instead of hand-tuned weights.

### LLM-as-judge ensemble

Use an LLM as a secondary evaluator, not necessarily as the sole scoring authority.

### Vector database

Use pgvector/HNSW or another ANN index at scale.

---

# 55. Implementation Guardrails

When implementing this design, I kept these guardrails:

- do not replace the deterministic scorer with an LLM call,
- do not add a database unless requested,
- do not add a UI before tests/evaluation work,
- do not invent thresholds without marking them as provisional,
- do not add additional scoring factors without evidence,
- do not introduce unnecessary design patterns,
- do not silently change weights,
- do not hide intermediate metrics.

---

# 56. Decisions Locked by This Document

Unless evaluation demonstrates a problem, the following are locked:

```text
runtime scoring = deterministic
semantic similarity = local embeddings + cosine
novelty = relative to nearest baseline submissions
lexical similarity = secondary signal
relevance = separate from novelty
relevance = multiplicative gate
final score = [0,1]
baseline comparisons = exact at hackathon scale
Top-K initial value = 3
Top-K initial weights = 0.60 / 0.30 / 0.10
raw novelty initial weights = 0.85 semantic / 0.15 lexical
gate shape = piecewise linear
```

---

# 57. Decisions Intentionally Deferred

These must be decided empirically during implementation/evaluation:

```text
exact local embedding model
whether perspective is embedded
exact relevanceLow
exact relevanceHigh
whether token Jaccard is sufficient
whether n-grams improve lexical behavior
whether Top-3 beats Top-1/Top-5
whether duplicate override is needed
whether 85/15 remains the best simple weighting
minimum/maximum text length
optional human-readable labels
```

---

# 58. Post-Evaluation Amendments

After the locked evaluation, I stress-tested the implementation with two additional synthetic datasets (city transit and grocery refills, 50 baselines each; not included in this repository) and adversarial inputs. The testing did not show a need to change the thresholds, but it exposed three gaps that I resolved as follows. None changes the locked parameters in section 56.

## 58.1 Minimum and maximum text length

This resolves the deferred "minimum/maximum text length" decision in section 57.

```text
headline: at least 1 word containing a letter or digit
body:     at least 5 words containing a letter or digit
headline + body: at most 100 words
```

Without a minimum, content-free input was rewarded as novel because it resembles no baseline: `ok` scored `0.315` and emoji alone `0.234`. Without a maximum, text beyond the model's input window was truncated, so a duplicate appended after 700 words of filler went undetected. The 100-word maximum mirrors the problem statement's limit for the fixed content. Every baseline and labeled case already satisfies these rules (7 to 28 words).

## 58.2 Fixed content as a comparison neighbor

```text
semantic neighbors = baseline submissions + fixed content
lexical comparisons = baseline submissions + fixed content (title + body)
```

Without this, restating the announcement scored as well as a new idea (`0.494`), because it is maximally relevant and unlike any baseline. The fixed content's semantic similarity is the same cosine already computed for relevance, so no extra embedding is needed. Its lexical text omits the `Title:`/`Body:` labels so they do not inflate overlap.

Measured effect: a verbatim copy fell to `0.149`, the body alone to `0.174`, and a close paraphrase to `0.336`. None of the 28 labeled cases changed, and 3 of 57 probes across the three stress-test datasets moved by at most `0.002`, because the fixed content is embedded without submission field labels and therefore sits below typical submission-to-submission similarity.

## 58.3 English-only model

`Xenova/all-MiniLM-L6-v2` is trained on English. A Spanish translation of an existing submission scored `0.467` (treated as novel) and a Hindi translation was gated to `0.049` (treated as irrelevant). The system is therefore documented as English-only; multilingual support needs a multilingual embedding model and recalibrated relevance thresholds.
