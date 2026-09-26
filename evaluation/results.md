# Evaluation Results

Generated from the locked evaluation run at 2026-09-26T06:50:13.287Z. Numeric values are shown to three decimal places; machine-precision values remain in `evaluation/results.json`.

## Executive summary

The locked configuration passes **24/28 cases (85.7%)**. 4 labeled novel-relevant cases remain failed because their raw source-relevance similarity is below the required 0.350. They are reported in full below.

The central guardrail works on this dataset: novel-but-irrelevant submissions have high mean raw novelty but a zero mean final score after relevance gating.

## Locked configuration

- Embedding model: `Xenova/all-MiniLM-L6-v2`
- Top-K semantic neighbors: 3
- Semantic neighbor weights: 0.60 / 0.30 / 0.10
- Semantic / lexical novelty weights: 0.85 / 0.15
- Relevance low / high: 0.10 / 0.35

No scoring parameter was changed for this report.

## Dataset

- Baseline submissions: 50
- Labeled evaluation cases: 28
- Passed: 24
- Failed: 4

## Category results

| Category | Passed | Pass rate | Mean final | Mean raw novelty | Mean semantic novelty | Mean lexical novelty | Mean relevance | Mean gate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Duplicate | 3/3 | 100.0% | 0.077 | 0.129 | 0.152 | 0.000 | 0.273 | 0.643 |
| Near duplicate | 4/4 | 100.0% | 0.169 | 0.237 | 0.197 | 0.465 | 0.319 | 0.739 |
| Paraphrase | 4/4 | 100.0% | 0.440 | 0.492 | 0.428 | 0.859 | 0.347 | 0.887 |
| Common | 4/4 | 100.0% | 0.329 | 0.429 | 0.364 | 0.793 | 0.317 | 0.790 |
| Novel + relevant | 1/5 | 20.0% | 0.415 | 0.519 | 0.459 | 0.859 | 0.309 | 0.806 |
| Novel + irrelevant | 5/5 | 100.0% | 0.000 | 0.816 | 0.797 | 0.920 | 0.047 | 0.000 |
| Borderline | 3/3 | 100.0% | 0.471 | 0.529 | 0.467 | 0.882 | 0.374 | 0.906 |

## Separation and guardrails

| Check | Actual | Status |
|---|---:|---|
| Labeled-case pass rate >= 85% | 85.7% | PASS |
| Novel-relevant mean final > duplicate | 0.337 margin | PASS |
| Novel-relevant mean final > common | 0.085 margin | PASS |
| Novel-relevant mean final > paraphrase | -0.026 margin | FAIL |
| Novel-irrelevant mean final = 0 | 0.000 | PASS |
| Novel-irrelevant raw novelty remains high | 0.816 | PASS |
| All final scores within [0, 1] | 100% | PASS |

The novel-relevant mean is 0.026 below the paraphrase mean. This failed separation check is retained as a model/representation limitation, not relabeled or tuned away.

## Failed cases

All 4 failed cases are included. Each passes its final-score and raw-novelty bounds but fails the labeled minimum relevance similarity of 0.350.

### `eval-novel-relevant-001` — Mark summaries stale after new replies

Summary freshness is directly relevant to the announced feature and is not represented in the baseline.

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.575 |
| Semantic aggregated similarity | 0.575 |
| Semantic novelty | 0.425 |
| Lexical max source | `submission-006` |
| Lexical max similarity | 0.167 |
| Lexical novelty | 0.833 |
| Semantic weighted contribution (0.850 weight) | 0.361 |
| Lexical weighted contribution (0.150 weight) | 0.125 |
| Raw novelty | 0.486 |
| Relevance similarity | 0.261 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.646 |
| Final score | 0.314 |

Expectation checks:

| Metric | Bound | Actual | Status |
|---|---:|---:|---|
| finalScore | min 0.150 | 0.314 | PASS |
| rawNovelty | min 0.450 | 0.486 | PASS |
| relevance | min 0.350 | 0.261 | FAIL |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-004` | Keep summaries concise | 0.592 | 0.081 | 0.600 | 0.355 |
| 2 | `submission-014` | Show links to source messages | 0.552 | 0.158 | 0.300 | 0.166 |
| 3 | `submission-016` | Action-item quality matters too | 0.542 | 0.125 | 0.100 | 0.054 |

### `eval-novel-relevant-003` — Separate facts from unresolved questions

Structured treatment of unresolved questions is a new, product-specific approach to safer summaries.

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.459 |
| Semantic aggregated similarity | 0.459 |
| Semantic novelty | 0.541 |
| Lexical max source | `submission-018` |
| Lexical max similarity | 0.105 |
| Lexical novelty | 0.895 |
| Semantic weighted contribution (0.850 weight) | 0.460 |
| Lexical weighted contribution (0.150 weight) | 0.134 |
| Raw novelty | 0.594 |
| Relevance similarity | 0.243 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.573 |
| Final score | 0.341 |

Expectation checks:

| Metric | Bound | Actual | Status |
|---|---:|---:|---|
| finalScore | min 0.150 | 0.341 | PASS |
| rawNovelty | min 0.450 | 0.594 | PASS |
| relevance | min 0.350 | 0.243 | FAIL |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-004` | Keep summaries concise | 0.461 | 0.026 | 0.600 | 0.277 |
| 2 | `submission-032` | Errors could damage confidence | 0.455 | 0.081 | 0.300 | 0.137 |
| 3 | `submission-013` | Summary accuracy is essential | 0.454 | 0.054 | 0.100 | 0.045 |

### `eval-novel-relevant-004` — Exclude bot storms from issue trends

Bot-driven distortion is a novel analytics failure mode while remaining specific to recurring support issues.

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.508 |
| Semantic aggregated similarity | 0.508 |
| Semantic novelty | 0.492 |
| Lexical max source | `submission-039` |
| Lexical max similarity | 0.167 |
| Lexical novelty | 0.833 |
| Semantic weighted contribution (0.850 weight) | 0.418 |
| Lexical weighted contribution (0.150 weight) | 0.125 |
| Raw novelty | 0.543 |
| Relevance similarity | 0.321 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.884 |
| Final score | 0.480 |

Expectation checks:

| Metric | Bound | Actual | Status |
|---|---:|---:|---|
| finalScore | min 0.150 | 0.480 | PASS |
| rawNovelty | min 0.450 | 0.543 | PASS |
| relevance | min 0.350 | 0.321 | FAIL |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-040` | Trend reporting intervals | 0.514 | 0.056 | 0.600 | 0.308 |
| 2 | `submission-037` | Recurring issues can guide product work | 0.505 | 0.051 | 0.300 | 0.151 |
| 3 | `submission-038` | Explain detected trends | 0.484 | 0.139 | 0.100 | 0.048 |

### `eval-novel-relevant-005` — Preview workflow effects with replay

Historical workflow replay is a new safety mechanism tied directly to summaries, action items, and admin rollout.

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.606 |
| Semantic aggregated similarity | 0.606 |
| Semantic novelty | 0.394 |
| Lexical max source | `submission-015` |
| Lexical max similarity | 0.108 |
| Lexical novelty | 0.892 |
| Semantic weighted contribution (0.850 weight) | 0.335 |
| Lexical weighted contribution (0.150 weight) | 0.134 |
| Raw novelty | 0.469 |
| Relevance similarity | 0.331 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.925 |
| Final score | 0.434 |

Expectation checks:

| Metric | Bound | Actual | Status |
|---|---:|---:|---|
| finalScore | min 0.150 | 0.434 | PASS |
| rawNovelty | min 0.450 | 0.469 | PASS |
| relevance | min 0.350 | 0.331 | FAIL |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-003` | Quicker wrap-up work | 0.622 | 0.049 | 0.600 | 0.373 |
| 2 | `submission-020` | Track human corrections | 0.592 | 0.051 | 0.300 | 0.178 |
| 3 | `submission-023` | Connect action items to tickets | 0.554 | 0.050 | 0.100 | 0.055 |

## Representative demo cases

These fixed cases cover the three behaviors needed for the demo. Their explanations use only deterministic score components and stored baseline comparisons.

### Semantic paraphrase — `eval-paraphrase-004`

**Candidate:** Local idioms can alter meaning — The assistant may misunderstand region-specific expressions when a customer switches between languages in one exchange.

**Why selected:** Low token overlap is counterbalanced by the nearest multilingual-theme submissions, demonstrating why semantic comparison is needed.

**Evaluation status:** PASS

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.632 |
| Semantic aggregated similarity | 0.632 |
| Semantic novelty | 0.368 |
| Lexical max source | `submission-006` |
| Lexical max similarity | 0.171 |
| Lexical novelty | 0.829 |
| Semantic weighted contribution (0.850 weight) | 0.312 |
| Lexical weighted contribution (0.150 weight) | 0.124 |
| Raw novelty | 0.437 |
| Relevance similarity | 0.294 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.774 |
| Final score | 0.338 |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-027` | Meaning can disappear in translation | 0.654 | 0.114 | 0.600 | 0.392 |
| 2 | `submission-028` | Language fallback behavior | 0.615 | 0.118 | 0.300 | 0.185 |
| 3 | `submission-025` | Multilingual summaries can unify teams | 0.552 | 0.143 | 0.100 | 0.055 |

### Novel + relevant — `eval-novel-relevant-002`

**Candidate:** Flag conflicting follow-up owners — Warn an agent when separate conversations assign the same customer follow-up to different teams before creating either task.

**Why selected:** A new conflict-detection idea remains clearly tied to extracted action items, so the relevance gate preserves its novelty reward.

**Evaluation status:** PASS

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.556 |
| Semantic aggregated similarity | 0.556 |
| Semantic novelty | 0.444 |
| Lexical max source | `submission-047` |
| Lexical max similarity | 0.158 |
| Lexical novelty | 0.842 |
| Semantic weighted contribution (0.850 weight) | 0.377 |
| Lexical weighted contribution (0.150 weight) | 0.126 |
| Raw novelty | 0.504 |
| Relevance similarity | 0.389 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 1.000 |
| Final score | 0.504 |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-045` | Automatic follow-ups reduce busywork | 0.598 | 0.100 | 0.600 | 0.359 |
| 2 | `submission-016` | Action-item quality matters too | 0.498 | 0.098 | 0.300 | 0.149 |
| 3 | `submission-017` | Agents should approve important outputs | 0.484 | 0.075 | 0.100 | 0.048 |

### Novel + irrelevant — `eval-novel-irrelevant-002`

**Candidate:** Plant tomatoes beside basil — Home gardeners can use companion planting and deep watering to improve vegetable yields during summer.

**Why selected:** The gardening idea is highly novel relative to the baseline, but source relevance falls below the low cutoff and the final reward is zero.

**Evaluation status:** PASS

| Component | Value |
|---|---:|
| Semantic neighbor weight sum | 1.000 |
| Semantic weighted similarity sum | 0.136 |
| Semantic aggregated similarity | 0.136 |
| Semantic novelty | 0.864 |
| Lexical max source | `submission-006` |
| Lexical max similarity | 0.083 |
| Lexical novelty | 0.917 |
| Semantic weighted contribution (0.850 weight) | 0.734 |
| Lexical weighted contribution (0.150 weight) | 0.137 |
| Raw novelty | 0.872 |
| Relevance similarity | 0.018 |
| Relevance gate low / high | 0.100 / 0.350 |
| Relevance gate | 0.000 |
| Final score | 0.000 |

Top-3 semantic neighbors:

| Rank | Submission | Headline | Semantic similarity | Lexical similarity | Aggregation weight | Semantic contribution |
|---:|---|---|---:|---:|---:|---:|
| 1 | `submission-049` | Peak-hour productivity gains | 0.142 | 0.051 | 0.600 | 0.085 |
| 2 | `submission-034` | Pilot controls are welcome | 0.133 | 0.000 | 0.300 | 0.040 |
| 3 | `submission-037` | Recurring issues can guide product work | 0.113 | 0.027 | 0.100 | 0.011 |

## Explainability contract

`NoveltyScoreResult` exposes the complete deterministic calculation path:

1. Ranked Top-K neighbors with semantic and lexical similarity, normalized aggregation weight, and semantic contribution.
2. Weighted semantic-similarity sum, weight sum, aggregated similarity, and semantic novelty.
3. Maximum lexical similarity, its source submission, and lexical novelty.
4. Semantic and lexical weights and their contributions to raw novelty.
5. Relevance similarity, low/high gate bounds, and the resulting gate.
6. Raw novelty and final score.

The formulas are:

```text
semanticNovelty = 1 - weightedTopKSemanticSimilarity
lexicalNovelty = 1 - maxLexicalSimilarity
rawNovelty = 0.85 * semanticNovelty + 0.15 * lexicalNovelty
finalScore = rawNovelty * relevanceGate
```

No generative model is called to create runtime score explanations.

## Known limitations

- Four of five novel-relevant cases miss the labeled raw-relevance threshold even though their raw novelty and final score checks pass.
- Novel-relevant versus paraphrase mean final-score separation is reversed by 0.026 because the novel-relevant group receives lower average source relevance.
- A single embedding can lose detail in multi-topic submissions and can understate relevance for product-specific edge cases.
- Thresholds are calibrated to this model and dataset; synthetic cases and 50 baselines do not establish production-scale validity.
- Novelty remains relative to baseline coverage, and token Jaccard is language- and wording-dependent.

## Reproduce

```bash
npm run evaluate
```

This rewrites both `evaluation/results.json` and this Markdown report from the same evaluation run.

