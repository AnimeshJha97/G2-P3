# Explainable Novelty Scoring System

I built this hackathon-scale TypeScript prototype to score how novel a structured submission is relative to prior submissions while suppressing ideas that are unrelated to a fixed source announcement. I consider it an evaluated prototype, not a production-ready service.

I made the scoring path deterministic after embedding generation. It combines semantic similarity, lexical overlap, and a source-relevance gate, then returns the intermediate values and nearest baseline submissions used to calculate the final score.

## Problem and solution

A novelty-only system can reward irrelevant text simply because it differs from the baseline. I designed this project to separate two questions:

1. How different is the candidate from earlier submissions?
2. How relevant is the candidate to the fixed source content?

I combine semantic and lexical novelty into a raw novelty score, then use a multiplicative relevance gate to reduce or remove the reward for off-topic candidates. I expose the full calculation path instead of generating an explanation with an LLM.

## What I implemented

- Strict Zod validation for fixed content, baseline submissions, and labeled evaluation cases.
- Local embeddings through `Xenova/all-MiniLM-L6-v2` using mean pooling and normalized vectors.
- In-memory caching of completed and in-flight embeddings.
- Cosine semantic similarity and normalized token-set Jaccard lexical similarity.
- A reusable `NoveltyScorer` with a prepared baseline context.
- A 50-submission baseline and 28 labeled evaluation cases.
- JSON and Markdown evaluation reports with category metrics, failed cases, score components, and nearest neighbors.
- A minimal CLI that scores inline JSON, a JSON file, or a labeled evaluation case.
- Automated tests for validation, text representation, scoring primitives, embeddings, end-to-end scoring, evaluation, report rendering, and the CLI.

I intentionally did not add a frontend, HTTP API, database, vector database, authentication layer, or generative model to the runtime scoring path.

## Architecture

```text
fixed content + baseline submissions
              |
              v
validation -> canonical text -> local embeddings -> prepared scoring context
                                                    |
candidate -> validation -> semantic + lexical comparisons
                             |              |
                             v              v
                     semantic novelty   lexical novelty
                             \              /
                              raw novelty
                                   |
fixed-content similarity -> relevance gate
                                   |
                                   v
                              final score
```

I organized the implementation into these main modules:

- `src/types/`: data contracts and Zod schemas.
- `src/text/`: canonical semantic text and lexical normalization.
- `src/embeddings/`: embedding-provider contract and local Hugging Face implementation.
- `src/similarity/`: cosine and token Jaccard similarity.
- `src/scoring/`: novelty components, relevance gate, context preparation, and orchestration.
- `src/evaluation/`: locked evaluation configuration, evaluator, report renderer, and runner.
- `src/cli/score.ts`: command-line scoring entry point.
- `data/`: fixed content, 50 baselines, and 28 labeled cases.
- `evaluation/`: machine-readable results, human-readable results, and calibration log.

## Setup

Requirements:

- Node.js 24 or newer.
- npm.
- Network access on the first model-backed run if `Xenova/all-MiniLM-L6-v2` is not already cached locally.

From the repository root:

```bash
npm install
npm test
npm run typecheck
```

In my verified repository state, all 79 tests across 13 test files pass, as does TypeScript type-checking.

## Commands

Run the complete test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Type-check without emitting JavaScript:

```bash
npm run typecheck
```

Regenerate `evaluation/results.json` and `evaluation/results.md` with the real local embedding model:

```bash
npm run evaluate
```

Use the CLI. npm automatically runs the `prescore` lifecycle script first, compiling `src/` into `.tmp/score-cli`:

```bash
npm run score -- --case eval-novel-relevant-002
```

To compile without scoring, run `npm run prescore` directly.

I designed the score command to accept exactly one candidate source:

```bash
npm run score -- --json '{"id":"candidate-001","headline":"Flag conflicting owners","body":"Warn agents before duplicate follow-up tasks are created.","perspective":"suggestion"}'
npm run score -- --file candidate.json
npm run score -- --case eval-novel-irrelevant-002
```

I require each candidate to have a unique non-empty `id`, `headline`, and `body`, plus one of these perspectives: `support`, `concern`, `question`, `suggestion`, or `observation`. Run commands from the repository root because my CLI loads `data/fixed-content.json`, `data/submissions.json`, and, for `--case`, `data/labeled-cases.json` by relative path.

## Scoring design

I locked the following configuration after calibration:

| Parameter | Value |
|---|---:|
| Embedding model | `Xenova/all-MiniLM-L6-v2` |
| Semantic neighbors | 3 |
| Neighbor weights | 0.60 / 0.30 / 0.10 |
| Semantic novelty weight | 0.85 |
| Lexical novelty weight | 0.15 |
| Relevance low cutoff | 0.10 |
| Relevance high cutoff | 0.35 |

For each candidate, my scorer calculates:

```text
semanticNovelty = 1 - weightedTopKSemanticSimilarity
lexicalNovelty = 1 - maxLexicalSimilarity
rawNovelty = 0.85 * semanticNovelty + 0.15 * lexicalNovelty
finalScore = rawNovelty * relevanceGate
```

I set the relevance gate to `0` at or below `0.10`, `1` at or above `0.35`, and a linear interpolation between those cutoffs. I clamp scores to `[0, 1]` and return the selected neighbors, normalized neighbor weights and contributions, semantic and lexical components, raw novelty, source relevance, gate, and final score.

See the [calibration log](evaluation/calibration-log.md) for the parameter analysis and rejected alternative.

## Evaluation strategy

I ran the checked-in evaluation with the real local embedding model against 50 fixed baseline submissions and 28 separate labeled candidates. I included exact duplicates, near duplicates, low-overlap paraphrases, common ideas, novel relevant ideas, novel irrelevant ideas, and relevance-boundary cases.

I gave each labeled case explicit minimum or maximum bounds for final score, raw novelty, and/or raw relevance. My evaluator preserves every failed case and generates both machine-precision JSON and a readable Markdown report from the same run. In the calibration log, I recorded the initial gate, observed relevance distributions, the Top-1 alternative I considered, and the thresholds I locked.

## Final evaluation results

My checked-in locked run at `2026-09-26T06:50:13.287Z` passed 24 of 28 cases (`85.7%`).

| Category | Passed | Mean final | Mean raw novelty | Mean relevance |
|---|---:|---:|---:|---:|
| Duplicate | 3/3 | 0.077 | 0.129 | 0.273 |
| Near duplicate | 4/4 | 0.169 | 0.237 | 0.319 |
| Paraphrase | 4/4 | 0.440 | 0.492 | 0.347 |
| Common | 4/4 | 0.329 | 0.429 | 0.317 |
| Novel + relevant | 1/5 | 0.415 | 0.519 | 0.309 |
| Novel + irrelevant | 5/5 | 0.000 | 0.816 | 0.047 |
| Borderline | 3/3 | 0.471 | 0.529 | 0.374 |

My main guardrail succeeded on this dataset: all five novel-but-irrelevant cases received a zero final score even though their mean raw novelty was `0.816`. All final scores remained within `[0, 1]`.

I retained these four failed cases rather than hiding or relabeling them:

- `eval-novel-relevant-001`: relevance `0.261`.
- `eval-novel-relevant-003`: relevance `0.243`.
- `eval-novel-relevant-004`: relevance `0.321`.
- `eval-novel-relevant-005`: relevance `0.331`.

All four pass their final-score and raw-novelty bounds but miss the labeled minimum raw relevance of `0.350`. I also found that the novel-relevant mean final score remains `0.026` below the paraphrase mean, although it exceeds the duplicate mean by `0.337` and the common mean by `0.085`.

See the full [evaluation report](evaluation/results.md) and [machine-readable results](evaluation/results.json).

## Limitations

- I found that four of five novel-relevant cases miss the labeled raw-relevance threshold. I did not hide this with relabeling or case-specific rules.
- My novel-relevant versus paraphrase mean final-score separation is reversed by `0.026` because the novel-relevant group receives lower average source relevance.
- My use of one embedding can lose details in multi-topic submissions and understate relevance for product-specific edge cases.
- I calibrated the thresholds for one embedding model and this synthetic dataset; 50 baselines and 28 cases do not establish production-scale validity.
- I measure novelty relative to baseline coverage, so missing prior ideas can appear more novel than they are.
- My token Jaccard signal is sensitive to wording and language, even though I use it only as the secondary signal.
- My implementation performs an in-memory scan over every baseline and has no persistence, access control, monitoring, or service-level safeguards.

## Possible production evolution

To take this work toward production, I would need broader and independently reviewed datasets, model and threshold revalidation, slice-based and multilingual evaluation, monitoring for drift and abuse, durable storage, access controls, and operational failure handling. At larger baseline sizes, I could replace the current in-memory comparison with precomputed embeddings and a vector index while preserving exact score-component logging for auditability.

I present these only as possible extensions, not as claims that my current prototype is production-ready.

## Documentation

- [Project decisions](docs/PROJECT_DECISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Scoring design](docs/SCORING_DESIGN.md)
- [Evaluation plan](docs/EVALUATION_PLAN.md)
- [Evaluation results](evaluation/results.md)
- [Calibration log](evaluation/calibration-log.md)
- [AI-use disclosure](docs/AI_USAGE.md)

