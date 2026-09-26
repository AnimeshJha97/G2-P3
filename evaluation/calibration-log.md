# Scoring Calibration Log

## Scope and controls

Calibration used the fixed 50-submission baseline, the 28 labeled evaluation
cases, and the real local `Xenova/all-MiniLM-L6-v2` embedding model. Evaluation
labels were not changed. Parameter groups were considered independently, and
the only production evaluation change was the relevance threshold pair.

## Run 01 — uncalibrated relevance gate

Configuration:

- Top-K: 3
- neighbor weights: 0.60 / 0.30 / 0.10
- semantic/lexical weights: 0.85 / 0.15
- relevance low/high: 0.00 / 1.00

Result:

- 24/28 cases passed (85.7%)
- duplicate mean final score: 0.034
- paraphrase mean final score: 0.173
- common mean final score: 0.133
- novel-relevant mean final score: 0.159
- novel-irrelevant mean final score: 0.038
- failed cases: `eval-novel-relevant-001`, `-003`, `-004`, and `-005`

The 0–1 gate made the gate equal to raw cosine relevance and was retained only
to observe the model's distributions.

## Relevance analysis

Observed fixed-content cosine similarities:

| Group | Count | Minimum | Median | Maximum |
|---|---:|---:|---:|---:|
| Clearly irrelevant | 5 | 0.000 | 0.069 | 0.081 |
| Clearly relevant | 20 | 0.170 | 0.302 | 0.487 |
| Borderline | 3 | 0.280 | 0.361 | 0.480 |

The 0.081–0.170 gap provides a defensible low cutoff. `relevanceLow = 0.10`
suppresses every clearly irrelevant case while retaining margin below the
lowest clearly relevant case.

Borderline and clearly relevant distributions overlap, so the data does not
support a clean upper classifier boundary. `relevanceHigh = 0.35` is a simple,
round operating point aligned with the labeled minimum relevance expectation:
scores at or above it receive the full novelty reward, while lower topical
matches remain in the transition region. This overlap is retained as a known
model limitation rather than hidden with special-case rules.

## Novelty analysis

The initial novelty configuration produced these raw-novelty means:

| Category | Mean raw novelty |
|---|---:|
| Duplicate | 0.129 |
| Near duplicate | 0.237 |
| Common | 0.429 |
| Paraphrase | 0.492 |
| Novel relevant | 0.519 |

All novel-relevant cases passed their raw-novelty minimum. Token Jaccard also
behaved as the intended secondary signal: mean lexical novelty was 0.000 for
duplicates and 0.465 for near duplicates. Paraphrase and novel-relevant lexical
novelty were both approximately 0.859, confirming that lexical overlap alone
cannot distinguish low-overlap paraphrases from new ideas.

A controlled Top-1 recomputation was considered against the existing Top-3
result. It reduced duplicate mean raw novelty from 0.129 to 0.000, but narrowed
the novel-relevant versus paraphrase raw-novelty gap from 0.027 to 0.023. Since
the failed cases were relevance failures and Top-1 did not improve the weak
novel/paraphrase separation, no Top-K or lexical change was adopted.

## Run 02 — locked configuration

Configuration:

- embedding model: `Xenova/all-MiniLM-L6-v2`
- Top-K: 3
- neighbor weights: 0.60 / 0.30 / 0.10
- semantic/lexical weights: 0.85 / 0.15
- relevance low/high: 0.10 / 0.35

Result:

| Category | Passed | Mean final | Mean raw novelty | Mean relevance |
|---|---:|---:|---:|---:|
| Duplicate | 3/3 | 0.077 | 0.129 | 0.273 |
| Near duplicate | 4/4 | 0.169 | 0.237 | 0.319 |
| Paraphrase | 4/4 | 0.440 | 0.492 | 0.347 |
| Common | 4/4 | 0.329 | 0.429 | 0.317 |
| Novel relevant | 1/5 | 0.415 | 0.519 | 0.309 |
| Novel irrelevant | 5/5 | 0.000 | 0.816 | 0.047 |
| Borderline | 3/3 | 0.471 | 0.529 | 0.374 |

Overall, 24/28 cases passed (85.7%). Every clearly irrelevant case received a
zero final score, despite high raw novelty. No previously passing case regressed.

## Known failures and limitations

The four failures remain `eval-novel-relevant-001`, `-003`, `-004`, and `-005`.
Their raw novelty values all pass, their Top-3 neighbors are conceptually
appropriate, and their calibrated final scores pass. They fail only the labeled
`minRelevance = 0.35` expectation because their raw relevance similarities are
0.261, 0.243, 0.321, and 0.331 respectively. Relevance thresholds cannot alter
that raw metric.

The final novel-relevant mean exceeds duplicate by 0.337, common by 0.085, and
novel-irrelevant by 0.415. It remains 0.026 below the paraphrase mean because
the embedding model assigns the novel-relevant group lower average source
relevance. This is documented as a representation/model limitation; labels and
individual cases were not tuned to conceal it.

## Decision

Lock the simplest configuration: Top-3 semantic aggregation, 85/15
semantic/lexical weighting, token Jaccard lexical similarity, and relevance
thresholds 0.10/0.35. The configuration meets the 85% labeled-case target,
strongly suppresses irrelevant novelty, preserves duplicate suppression, and
does not add complexity unsupported by the observed failures.
