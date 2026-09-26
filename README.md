# Explainable Novelty Scoring

G2 AI Hiring Hackathon — Problem 3: *Rewarding novelty in submissions.*

A deterministic TypeScript scorer that rates how novel a structured submission is against ~50 prior submissions, **without rewarding content that is unrelated to the source announcement**. Every score comes with the intermediate values and nearest neighbors that produced it.

This is an evaluated hackathon prototype, not a production service.

| | |
|---|---|
| Labeled evaluation | **24/28 cases pass (85.7%)** with the real embedding model |
| Irrelevance guardrail | 5/5 novel-but-irrelevant cases scored **0.000** despite mean raw novelty **0.816** |
| Automated tests | 103 tests across 16 files, including the golden dataset run through the real model; type-check clean |
| Runtime dependencies on hosted AI | None: local embeddings, no API keys |

## 1. Problem

Each submission responds to a fixed product announcement (53 words, [data/fixed-content.json](data/fixed-content.json)) and has three user-provided fields:

```json
{ "headline": "string", "body": "string", "perspective": "support | concern | question | suggestion | observation" }
```

The score must be in `[0, 1]`: high for new *and* relevant ideas, low for repeats, and low for off-topic text.

## 2. Core insight

**Novelty alone rewards irrelevance.** Text about gardening is maximally "different" from customer-support feedback. So novelty and relevance are measured separately, and relevance controls whether novelty is rewarded at all.

## 3. Architecture

```text
fixed content + 50 baselines ──validate──► canonical text ──► local embeddings ──► prepared context (cached)
                                                                                      │
candidate ──validate──► embed ──┬─► cosine vs baselines + fixed content ─► Top-3 weighted ─► semantic novelty ─┐
                                ├─► token Jaccard vs same set ─────────► max overlap ─────► lexical novelty ──┤
                                │                                                   0.85 / 0.15 ─► raw novelty
                                └─► cosine vs fixed content ─► relevance gate (0.10 → 0.35) ───────────── × ──► final score
```

```text
semanticNovelty = 1 − (0.60·sim₁ + 0.30·sim₂ + 0.10·sim₃)     # Top-3 nearest neighbors
lexicalNovelty  = 1 − max token-Jaccard similarity
rawNovelty      = 0.85·semanticNovelty + 0.15·lexicalNovelty
gate            = 0 if relevance ≤ 0.10;  1 if relevance ≥ 0.35;  linear in between
finalScore      = clamp(rawNovelty · gate, 0, 1)
```

The fixed content is also included as a comparison neighbor, so restating the announcement is not scored as a new idea (a verbatim copy dropped from `0.494` to `0.149`; no labeled case changed).

| Module | Responsibility |
|---|---|
| [src/types/](src/types/) | Zod schemas: 3 fields, 5 perspectives, ≥1-word headline, ≥5-word body, ≤100 words total |
| [src/text/](src/text/) | Canonical embedding text and lexical normalization |
| [src/embeddings/](src/embeddings/) | Provider interface; local `Xenova/all-MiniLM-L6-v2` (mean pooling, normalized) with caching |
| [src/similarity/](src/similarity/) | Cosine and token Jaccard |
| [src/scoring/](src/scoring/) | Pure novelty, gate, and final-score functions; `NoveltyScorer` orchestration |
| [src/evaluation/](src/evaluation/) | Locked config, evaluator, JSON + Markdown reports |
| [src/cli/](src/cli/), [src/server/](src/server/) | CLI and local demo UI, both using the same `NoveltyScorer` |

## 4. Design decisions

| Decision | Why |
|---|---|
| **Separate novelty and relevance** | They are different questions: "is this new?" versus "is this about the announcement?". Combining them into one similarity number hides which one failed. |
| **Relevance as a multiplicative gate, not an additive term** | With `a·novelty + b·relevance`, enough novelty can make up for zero relevance. A multiplier cannot: gate `0` means final `0`. The linear band between 0.10 and 0.35 partly reduces scores for borderline topical matches instead of cutting them off at a hard threshold. |
| **Local embeddings** | Deterministic, reproducible, free, and no network or API key at scoring time. The model name is explicit and the provider can be swapped. No LLM judge: the explanation *is* the calculation. |
| **Nearest-neighbor comparison (Top-3 weighted)** | Averaging over all 50 baselines would hide a single near-duplicate among unrelated submissions. Top-3 also penalizes ideas repeated across several submissions. Top-1 was tested and rejected: it narrowed the novel-vs-paraphrase gap (0.027 → 0.023). |
| **Lexical similarity as a secondary 15% signal** | Token Jaccard reliably catches copies (duplicate lexical novelty `0.000`) and light edits (`0.465`), but cannot tell a low-overlap paraphrase from a new idea (both ≈ `0.859`). It supports the semantic signal but does not decide the score. |
| **JSON + in-memory exact search** | Exact comparison against 50 vectors is trivial. A database or vector index would add setup risk without improving the evaluation. |

Details: [docs/SCORING_DESIGN.md](docs/SCORING_DESIGN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PROJECT_DECISION.md](docs/PROJECT_DECISION.md).

## 5. Evaluation methodology

- **Data:** 50 baseline submissions ([data/submissions.json](data/submissions.json)) covering all five perspectives. The **golden dataset** is 28 labeled candidates ([data/labeled-cases.json](data/labeled-cases.json)), each with a written rationale and IDs kept separate from the baselines. Both are synthetic.
- **Categories:** duplicate, near duplicate, paraphrase, common theme, novel + relevant, novel + irrelevant, borderline relevance.
- **Expectations:** each case has explicit min/max bounds on final score, raw novelty, and/or raw relevance. A case passes only if every bound passes.
- **Calibration** ([calibration-log.md](evaluation/calibration-log.md)): first ran with a pass-through gate (0/1) to observe raw relevance distributions. Irrelevant cases reached at most `0.081` and relevant cases started at `0.170`, so `relevanceLow = 0.10` sits in that gap. `relevanceHigh = 0.35` matches the labeled relevance minimum. Only the gate thresholds changed. Labels were not edited and failed cases were kept.
- **Reproducibility:** `npm run evaluate` regenerates [results.json](evaluation/results.json) and [results.md](evaluation/results.md) from one run. A re-run during the final review reproduced every score exactly.
- **Automated checks:** unit tests prove each behavior with controlled mock vectors. [golden-dataset.integration.test.ts](tests/golden-dataset.integration.test.ts) runs the golden dataset through the real model and fails the build if any required behavior regresses.

## 6. Success criteria and achievement

I set these criteria before the final run ([EVALUATION_PLAN.md §23](docs/EVALUATION_PLAN.md)). The 85% target is a practical goal for a hackathon, not a production benchmark.

| # | Criterion | Result | Met |
|---|---|---|:---:|
| R1 | Novel + relevant content is rewarded | Lowest novel-relevant score `0.314` is above the highest duplicate score `0.107` | ✅ |
| R2 | Non-novel content is not rewarded | Duplicates average `0.077` and near duplicates `0.169` | ✅ |
| R3 | Highly novel but irrelevant content is not rewarded | 5/5 score `0.000`, although their raw novelty averages `0.816` | ✅ |
| C1 | ≥ 85% of labeled cases pass | 24/28 (85.7%) | ✅ |
| C2 | Novel-relevant mean > duplicate mean | margin +0.337 | ✅ |
| C3 | Novel-relevant mean > paraphrase mean | margin **−0.026** | ❌ |
| C4 | Novel-relevant mean > common mean | margin +0.085 | ✅ |
| C5 | Novel-relevant mean > novel-irrelevant mean | margin +0.415 | ✅ |
| C6 | Irrelevant cases have high raw novelty but low final score | raw 0.816 → final 0.000 | ✅ |
| C7 | Every score is in `[0, 1]` | 28/28 | ✅ |

**Overall: the three required behaviors (R1–R3) hold. 6 of the 7 quantitative criteria are met.** C3 misses by 0.026. The cause is explained under the results table below.

Hackathon deliverables: three user-provided fields (headline, body, perspective). A 53-word fixed announcement, within the 100-word limit. 50 comparison submissions. Scores normalized to `[0, 1]`. Automated tests for R1–R3 with both mock vectors and the real model. Golden dataset, tests, and design docs in this repository. Coding-agent use disclosed in [docs/AI_USAGE.md](docs/AI_USAGE.md).

### Results by category

| Category | Passed | Mean final | Mean raw novelty | Mean relevance |
|---|---:|---:|---:|---:|
| Duplicate | 3/3 | 0.077 | 0.129 | 0.273 |
| Near duplicate | 4/4 | 0.169 | 0.237 | 0.319 |
| Paraphrase | 4/4 | 0.440 | 0.492 | 0.347 |
| Common theme | 4/4 | 0.329 | 0.429 | 0.317 |
| Novel + relevant | 1/5 | 0.415 | 0.519 | 0.309 |
| Novel + irrelevant | 5/5 | **0.000** | 0.816 | 0.047 |
| Borderline | 3/3 | 0.471 | 0.529 | 0.374 |

**Failures, reported as they are:** `eval-novel-relevant-001/003/004/005` pass their final-score and raw-novelty bounds but have raw relevance of `0.261 / 0.243 / 0.321 / 0.331`, below the labeled minimum of `0.35`. The same weak relevance signal pushes the novel-relevant mean slightly below the paraphrase mean. This is a limitation of the embedding representation, and I did not tune it away.

**Edge cases found after evaluation and fixed** (details in [SCORING_DESIGN.md §58](docs/SCORING_DESIGN.md)). None changed the locked parameters:
- Content-free input (`ok`, emoji) scored as novel, so minimum word counts were added.
- Text longer than the model window was silently truncated, so a 100-word cap was added.
- Restating the announcement scored `0.494`, so the fixed content was added as a comparison neighbor.

## 7. Run it

Requires Node.js ≥ 24. The first model-backed run downloads `Xenova/all-MiniLM-L6-v2` (network needed once).

```bash
npm install
npm test              # 103 tests, 16 files (includes a real-model golden-dataset test)
npm run typecheck
npm run evaluate      # real-model evaluation → evaluation/results.{json,md}
npm run dev           # demo UI at http://localhost:3000 (PORT to override)
```

**Demo UI:** enter a headline, body, and perspective, or pick a preset (exact duplicate, semantic paraphrase, novel + relevant, novel + irrelevant). The result shows the final score, every component, and the Top-3 neighbors. A hidden-by-default baseline panel lets you add, remove, upload (JSON, or CSV with `id,headline,body,perspective` columns), download, or reset the baseline set. Edits stay in memory. `data/submissions.json` is never modified.

**CLI** (compiles to `.tmp/score-cli` first). Takes exactly one of:

```bash
npm run score -- --case eval-novel-irrelevant-002
npm run score -- --file candidate.json
npm run score -- --json '{"id":"c-1","headline":"Flag conflicting owners","body":"Warn agents before duplicate follow-up tasks are created.","perspective":"suggestion"}'
```

Run from the repository root. On Windows PowerShell 5.1, use `--file` or `--case`, because PowerShell removes the quotes inside `--json`. Every CLI and UI run is appended to [logs/score-runs.csv](logs/score-runs.csv) with all components, the Top-3 neighbors, and a baseline fingerprint. The committed log holds my manual UI checks (`source = ui`) and a CLI run of all 28 golden-dataset cases (`source = cli`).

## 8. Limitations

- **Relevance signal is weak for specific new ideas:** 4/5 novel-relevant cases fall below the labeled relevance minimum, and novel-relevant trails paraphrase by 0.026.
- **Small, synthetic evaluation:** 50 baselines and 28 labeled cases for one announcement, calibrated for one model. This shows the intended behavior; it does not show the scorer holds up in general.
- **English only:** in my testing, a Spanish translation of a baseline scored `0.467` (treated as novel) and a Hindi translation was gated to `0.049`.
- **Keyword stuffing is not blocked:** a list of announcement keywords scored `0.409`.
- **Novelty depends on baseline coverage:** an idea missing from the baseline looks novel.
- **One embedding per submission** can blur multi-topic text. Token Jaccard is sensitive to wording.
- **Prototype infrastructure:** exact in-memory scan, no persistence, auth, or monitoring.

## 9. Production path

| Concern | Direction |
|---|---|
| Scale | Precompute embeddings at write time and store them in pgvector or another ANN index, partitioned by source content. Keep exact re-ranking of the Top-K candidates. |
| Validity | A larger human-labeled benchmark across many announcements, with per-slice and multilingual evaluation, and a multilingual model if needed. |
| Calibration | Recalibrate the gate per model version. Log score components per request (already done locally) so changes can be audited. |
| Operations | Track drift in score and relevance distributions, abuse patterns such as keyword stuffing, latency, access control, and durable storage. |

## 10. AI-assisted development

I owned the problem breakdown, architecture, scoring model, relevance-gate design, evaluation method, and every accept/reject decision. Codex implemented bounded modules and tests under constraints I wrote. ChatGPT supported early analysis and planning. Claude was used only for the final consistency audit. See [docs/AI_USAGE.md](docs/AI_USAGE.md).

## Repository map

| Path | Contents |
|---|---|
| [evaluation/results.md](evaluation/results.md) | Full report: per-case components, neighbors, failed cases |
| [evaluation/calibration-log.md](evaluation/calibration-log.md) | Calibration runs, distributions, rejected alternative |
| [docs/](docs/) | Design records written before the build (each notes where the final state is recorded) and the AI disclosure |
