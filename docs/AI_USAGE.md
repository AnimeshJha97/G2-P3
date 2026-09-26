# AI-Assisted Development

I used AI coding tools as implementation and review assistants. Before any code was written, I defined the architecture, scoring model, evaluation strategy, constraints, and success criteria. I then gave the agents bounded tasks: implement one module, write tests for stated behavior, or debug one specific failure. AI wrote a large share of the code, tests, and synthetic data.

## Tools used

| Tool | Role |
|---|---|
| **Codex** | Main implementation agent: modules, tests, synthetic baseline and labeled datasets, evaluation tooling, CLI, demo UI, targeted debugging, and documentation drafts. |
| **ChatGPT** | Early problem analysis and planning discussion. |
| **Claude** | Final consistency audit only: checked docs against code and results, and tightened the README and disclosure. |

No AI model runs in the scoring path. Scores come from a local embedding model and deterministic arithmetic.

## How AI was directed

Each task prompt came with written constraints from my design documents ([PROJECT_DECISION](PROJECT_DECISION.md), [ARCHITECTURE](ARCHITECTURE.md), [SCORING_DESIGN](SCORING_DESIGN.md), [EVALUATION_PLAN](EVALUATION_PLAN.md)):

- the architecture and module boundaries;
- the exact scoring formulas and initial parameters;
- the expected test behavior and dataset schema;
- the evaluation categories and pass criteria;
- explicit out-of-scope items (no database, hosted AI in the scoring path, LLM judge, or undocumented scoring rules).

The work was split into sprint-sized tasks. I never asked an agent to "build the solution."

## Summarized interaction trace

| # | Tool | Task I set, with its constraints | Kept | Rejected or changed |
|---|---|---|---|---|
| 1 | ChatGPT | Analyze the problem statement and draft a phased plan | Split novelty from relevance. Deterministic components. Sprint structure. | Treated as input only. I wrote the design docs myself. |
| 2 | Codex | Scaffold Node/TypeScript/Vitest only. No scoring, API, DB, or UI. | Minimal ESM toolchain | Anything beyond scaffolding |
| 3 | Codex | Zod schemas and canonical text. Keep the 3-field schema and 5 perspectives. | Strict schemas, 100-word limit on the fixed content | Early scoring or infrastructure |
| 4 | Codex | Pure scoring functions exactly as specified in `SCORING_DESIGN.md` | Cosine, Jaccard, Top-K, gate, and clamp, with boundary tests | Optional duplicate override and other undocumented rules |
| 5 | Codex | Local embedding provider using `all-MiniLM-L6-v2` with mean pooling and normalization. No hosted API. | Provider interface, caching, real-model integration test | Remote embedding dependency |
| 6 | Codex | `NoveltyScorer` orchestration without changing the formulas. Expose every component. | Full calculation path plus nearest neighbors | LLM-generated explanations |
| 7 | Codex | Generate the fixed content and 50 baselines to my schema and coverage rules | Schema-valid set covering all 5 perspectives | Invalid, duplicate, or leaked-ID records |
| 8 | Codex | 28 labeled cases in 7 categories with explicit bounds, plus the evaluator. Failures must be kept. | Golden dataset and evaluator | Removing or relabeling hard cases |
| 9 | Codex | Real-model calibration. Labels fixed. Change one parameter group at a time. | Gate thresholds 0.10 / 0.35 | Top-1 (narrowed the novel-vs-paraphrase gap) |
| 10 | Codex | JSON + Markdown report from one run, with every failure shown | 24/28 report, failed separation check shown | Any change to metrics for presentation |
| 11 | Codex | CLI and local demo UI reusing the locked scorer | CLI, UI, run log | Database or deployment |
| 12 | Codex | Fixes I specified after my stress tests: content-free input, truncation, restating the announcement | Word limits, fixed content as a comparison neighbor | Any change to the locked parameters |
| 13 | Claude | Final audit: check docs against code and results | Corrected test counts and one unsupported claim. Added a real-model golden-dataset test. | Changes to scoring logic |

The architecture and requirements I gave the agents are the design documents above. Each document opens with a note on when it was written and where the final state is recorded. The agent operating rules and the sprint-by-sprint kickoff prompts I used are in [AI_AGENT_PLAYBOOK.md](AI_AGENT_PLAYBOOK.md) and [SPRINTS.md](SPRINTS.md).

## Decisions I owned

- A deterministic local scorer instead of an LLM judge.
- Separate novelty and relevance, with relevance applied as a **multiplicative gate**, so high novelty cannot make up for being off-topic.
- Semantic novelty from **Top-3 weighted nearest neighbors** rather than a mean over all baselines. Lexical token Jaccard kept as a **secondary 15%** signal.
- Local `all-MiniLM-L6-v2` embeddings. JSON and in-memory exact search at hackathon scale.
- The seven evaluation categories, per-case bounds, and the 85% target.
- Calibration: change only the gate thresholds (0.10 / 0.35) based on observed relevance distributions. Reject Top-1. Keep the labels and all four failed cases unchanged.
- Post-evaluation edge-case fixes: word-count limits, the fixed content as a comparison neighbor, and English-only scope.

## Review and validation

- I reviewed agent diffs before accepting them. I rejected out-of-scope additions, such as optional duplicate overrides and extra infrastructure.
- I ran tests and the type-checker after changes. I re-ran the real-model evaluation after scoring-relevant changes.
- I inspected failed cases and their nearest neighbors, and treated the four novel-relevant failures as a limitation of the relevance signal. I did not relabel them.
- Parameter changes came only from observed evaluation output, as recorded in [calibration-log.md](../evaluation/calibration-log.md).
- I checked the final behavior manually through the CLI and the demo UI.

Passing tests show the code matches its specification. They do not prove the scorer is valid at production scale. The limitations are listed in the [README](../README.md#8-limitations).
