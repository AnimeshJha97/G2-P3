# AI Collaboration Playbook

## G2 AI Hiring Hackathon — Problem 3
### Practical AI Usage Strategy

**Submission context:** I prepared this playbook before implementation to set boundaries for AI-assisted work. I retain it as a planning and governance artifact, not as the record of tools ultimately used. My actual usage is disclosed in [AI_USAGE.md](AI_USAGE.md).

**Purpose:** Record how I planned to use AI tools to accelerate implementation without giving up control of architecture, exhausting usage limits, or accepting code I could not explain.

This playbook assumes:

- Problem 3 — Rewarding novelty in submissions
- VS Code as the primary development environment
- Codex as the primary implementation agent
- an optional secondary reviewer/debugger
- ChatGPT app for reasoning, planning, documentation, and discussion
- optional hosted AI API mainly for synthetic dataset generation where useful
- no paid external AI API usage
- AI usage must be disclosed and explained in the final submission

This document should be used together with:

- `PROJECT_DECISION.md`
- `ARCHITECTURE.md`
- `SCORING_DESIGN.md`
- `EVALUATION_PLAN.md`
- `PRE_REQUISITES_SETUP_GUIDE.md`

---

# 1. Core Rule

AI is an implementation accelerator.

AI is **not** the project owner.

I retained responsibility for:

```text
architecture
scope
algorithm choice
scoring logic
trade-offs
testing strategy
threshold acceptance
bug-fix decisions
final verification
submission quality
```

The AI may propose options, write code, review code, and find bugs.

I must be able to explain every final decision.

---

# 2. Agent Responsibilities

Use each tool for a distinct purpose.

## ChatGPT App

Primary role:

```text
architectural reasoning
decision support
documentation
evaluation analysis
debugging discussion
final presentation preparation
```

Use ChatGPT when the question is:

```text
"What should I do?"
"Why is this failing?"
"Is this metric meaningful?"
"Which trade-off is safer?"
"How should I explain this?"
```

Avoid using ChatGPT for bulk code generation when Codex already has repository context.

---

## Codex in VS Code

Primary role:

```text
implementation
repository edits
tests
refactoring
small debugging tasks
project scaffolding
```

Codex should be the main coding agent because it can directly work with the project files.

Use Codex when the task is:

```text
"Implement this already-decided module."
"Add tests for this behavior."
"Refactor this function without changing behavior."
"Fix this concrete failing test."
```

Codex should not be asked to decide the full project architecture from scratch once the preparation documents are available.

---

## Optional Secondary Reviewer

Primary role:

```text
independent reviewer
second opinion
logic audit
difficult debugging
test-gap analysis
```

The secondary reviewer should not duplicate Codex work by default.

Use the secondary reviewer when:

```text
a module is complete and needs review
a bug remains after one Codex debugging pass
the algorithm behavior looks suspicious
you want an independent assessment before changing architecture
```

The secondary reviewer is most valuable when it challenges the existing implementation rather than generating another version of it.

---

## Optional Hosted AI Service

Primary role:

```text
synthetic baseline data generation
synthetic evaluation candidate generation
controlled test-content generation
```

A hosted AI service should not be the primary novelty scorer.

Prefer:

```text
Hosted AI service -> generate static data
Local deterministic system -> score data
```

Do not make the core solution unavailable if a hosted AI service is unreachable.

---

# 3. Agent Priority Order

For normal implementation:

```text
1. Read preparation docs yourself
2. Decide the immediate task
3. Use Codex to implement
4. Run tests yourself
5. Fix obvious issues manually if easy
6. Ask Codex for one targeted debugging pass
7. Use the secondary reviewer if the issue remains unclear
8. Use ChatGPT when the problem is architectural or analytical
```

Do not send the same vague problem to every agent simultaneously.

---

# 4. The Most Important Prompting Rule

Never use:

```text
"Build the whole project."
```

Prefer:

```text
"Implement one bounded module according to these existing decisions."
```

Large autonomous prompts create:

- unnecessary abstractions,
- unexplained design changes,
- difficult review,
- higher token usage,
- harder debugging,
- weaker AI-use disclosure.

---

# 5. Context Hierarchy for Agents

When asking an agent to work on the project, point it to the project documents in this order:

```text
1. PROJECT_DECISION.md
2. ARCHITECTURE.md
3. SCORING_DESIGN.md
4. EVALUATION_PLAN.md
5. AI_AGENT_PLAYBOOK.md
```

Instruction pattern:

```text
Read the relevant project documents first.
Do not change architectural decisions unless you explicitly identify a conflict.
If you believe a change is necessary, explain it before editing.
```

---

# 6. First Codex Prompt of the Hackathon

After creating the repository and copying the approved planning documents into it:

```text
Read:

- PROJECT_DECISION.md
- ARCHITECTURE.md
- SCORING_DESIGN.md
- EVALUATION_PLAN.md
- AI_AGENT_PLAYBOOK.md

Do not write implementation code yet.

Summarize:
1. the required behavior,
2. the implementation order,
3. the modules you expect to create,
4. any contradictions you see between the documents,
5. any assumptions that still require runtime validation.

Do not redesign the solution.
```

Purpose:

- verify the agent understood the plan,
- expose contradictions before code exists,
- create a clean first AI interaction to document.

---

# 7. Second Codex Prompt — Project Initialization

After reviewing the summary:

```text
Initialize the TypeScript project structure described in ARCHITECTURE.md.

Requirements:
- Node.js
- TypeScript
- npm
- Vitest
- tsx
- Zod if useful for validation
- no frontend
- no API
- no database
- no hosted AI integration yet
- no scoring implementation yet

Create only:
- package.json
- tsconfig.json
- .gitignore
- directory structure
- basic types/interfaces
- basic test configuration

Before editing, list the files you will create.
```

Then inspect the resulting files before proceeding.

---

# 8. Codex Prompt — Pure Scoring Primitives

Use after scaffolding:

```text
Read SCORING_DESIGN.md.

Implement only these pure functions:

1. cosineSimilarity
2. lexical normalization
3. token Jaccard similarity
4. Top-K weighted similarity aggregation
5. semantic novelty
6. lexical novelty
7. raw novelty
8. piecewise linear relevance gate
9. final score clamping
10. scoring config validation

Requirements:
- TypeScript
- pure functions where possible
- add focused Vitest tests
- no embedding model yet
- no hosted AI service
- no API
- no UI
- do not invent relevance thresholds
- do not change the documented scoring formula

Before editing, summarize the files to be created or modified.
```

After completion:

```bash
npm test
```

Read failures yourself before asking for more help.

---

# 9. Codex Prompt — Embedding Provider

Once scoring primitives are stable:

```text
Implement the local EmbeddingProvider abstraction defined in ARCHITECTURE.md.

Use @huggingface/transformers.

Requirements:
- local inference
- feature-extraction pipeline
- mean pooling
- normalized output
- embed(text)
- embedMany(texts)
- lazy model initialization if practical
- clear initialization errors
- no scoring logic inside this provider
- no hosted AI service
- add a small smoke/integration test if practical

Do not change the scoring modules.
```

---

# 10. Codex Prompt — NoveltyScorer

After embeddings work:

```text
Implement NoveltyScorer using the existing modules and SCORING_DESIGN.md.

It must:
- validate inputs
- canonicalize candidate text
- use prepared baseline embeddings
- calculate semantic similarity against all baselines
- sort nearest neighbors
- aggregate Top-K similarity
- calculate semantic novelty
- calculate max lexical similarity
- calculate lexical novelty
- calculate raw novelty
- calculate source relevance
- apply the relevance gate
- clamp the final score to [0,1]
- return intermediate metrics and nearest neighbors

Use mocked embeddings for deterministic scoring tests.

Do not:
- add a hosted AI service
- add a database
- add an API
- add a UI
- change weights or thresholds silently
```

---

# 11. Independent Review Prompt — After Scorer Completion

Use the secondary reviewer only after tests pass.

```text
Read:
- ARCHITECTURE.md
- SCORING_DESIGN.md
- the current scoring implementation
- the current tests

Review only.

Do not edit files.

Check specifically for:
1. mathematical mistakes
2. incorrect Top-K weighting
3. failure to renormalize weights when fewer than K neighbors exist
4. cosine edge cases
5. score range violations
6. relevance being applied additively instead of multiplicatively
7. hidden hard-coded thresholds
8. near-duplicate failure modes
9. tests that merely repeat implementation details
10. unnecessary abstraction

Return:
- critical issues
- medium issues
- missing tests
- optional improvements
```

Then decide which findings are real before changing anything.

---

# 12. How to Handle Agent Disagreement

Example:

```text
Codex recommends Top-1
Secondary reviewer recommends Top-5
Preparation plan uses Top-3
```

Do not choose based on which model sounds more confident.

Use:

```text
evaluation evidence
```

Procedure:

```text
1. keep Top-3 as baseline
2. run evaluation
3. test Top-1 if there is a measured failure
4. test Top-5 if useful
5. compare category behavior
6. document the decision
```

Agent opinion is not evidence.

---

# 13. Synthetic Data Generation Prompt — Baseline Dataset Generation

After the fixed source content is finalized onsite:

```text
You are generating synthetic user submissions for an evaluation dataset.

Fixed content:
[PASTE FIXED CONTENT]

Each submission must contain exactly:
- headline
- body
- perspective

Allowed perspectives:
support, concern, question, suggestion, observation

Generate 50 submissions.

Requirements:
- all submissions must remain relevant to the fixed content
- create repeated semantic clusters rather than 50 unrelated ideas
- include multiple submissions around:
  [list relevant themes]
- vary wording naturally
- include some near-duplicate ideas
- include some paraphrases
- include some genuinely distinct ideas
- avoid exact duplicate text
- keep each body concise
- return valid JSON only

Do not assign novelty scores.
```

Then manually inspect the output.

Do not commit raw generated content without review.

---

# 14. Synthetic Data Generation Prompt — Evaluation Candidates

Generate evaluation candidates separately from the baseline.

Example:

```text
Using the fixed content below and the following summary of existing baseline themes:

Fixed content:
[PASTE]

Baseline themes:
[PASTE THEMES]

Generate controlled evaluation candidates in these categories:

- 3 exact duplicates or intentionally copied variants
- 4 near duplicates
- 4 semantic paraphrases
- 4 common-theme submissions
- 5 novel but relevant submissions
- 5 novel but irrelevant submissions
- 3 borderline-relevance submissions

Each candidate must contain:
- headline
- body
- perspective

For each candidate also include:
- category
- short rationale

Do not assign scores.
Return JSON only.
```

Every candidate must be manually reviewed before it becomes a labeled evaluation case.

---

# 15. ChatGPT App — Best Uses During Implementation

Use ChatGPT for questions such as:

```text
"These relevance scores overlap heavily between relevant and irrelevant examples. What are the likely causes?"

"My paraphrase cases are scoring too high. Which component should I inspect first?"

"Does this evaluation metric actually prove what I claim?"

"Help me interpret these failed cases without changing the algorithm yet."

"How should I explain this limitation in the README?"

"Review this calibration table and tell me what conclusion is justified."
```

This keeps ChatGPT focused on reasoning rather than repository editing.

---

# 16. ChatGPT App — Poor Uses

Avoid:

```text
"Rewrite my whole project."
"Generate all files from scratch."
"Give me a complete alternative architecture."
```

once implementation is underway.

That creates divergence from the VS Code repository and wastes time reconciling versions.

---

# 17. Debugging Escalation Strategy

When a bug appears:

## Level 1 — Developer

Read:

```text
error
stack trace
failing test
recent change
```

Fix it manually if obvious.

---

## Level 2 — Codex targeted debug

Prompt:

```text
This test is failing:

[TEST NAME / ERROR]

Inspect only the relevant implementation.

Explain the likely cause before editing.

Make the smallest fix that preserves documented behavior.

Do not refactor unrelated modules.
```

---

## Level 3 — Independent secondary diagnosis

If Codex fails or suggests large rewrites:

```text
Review this failing test and the related implementation.

Do not edit anything.

Identify:
- root cause
- whether the test or implementation is wrong
- minimum safe fix
- any regression risk
```

---

## Level 4 — ChatGPT reasoning

Use ChatGPT if the failure is conceptual:

```text
threshold behavior
evaluation methodology
embedding behavior
scoring interpretation
architecture conflict
```

---

# 18. Never Let Debugging Become Agent Ping-Pong

Bad workflow:

```text
Codex changes code
Secondary reviewer rewrites it
Codex rewrites the secondary review
ChatGPT proposes another architecture
```

Stop after one or two unsuccessful agent passes.

Then:

```text
read the code
reduce the problem
create a minimal reproduction
fix manually if possible
```

Your coding and logical reasoning are the fallback.

---

# 19. Usage-Limit Conservation

Because your agent capacity is finite:

Use high-value prompts.

Prefer:

```text
one precise task
```

over:

```text
many exploratory prompts
```

Before invoking Codex or the secondary reviewer:

1. read the error,
2. know the desired outcome,
3. identify the relevant files,
4. give constraints,
5. request minimal changes.

This reduces unnecessary iterations.

---

# 20. When Not to Use an Agent

Do it manually when:

```text
renaming a variable
changing a threshold value
fixing an obvious typo
adding one assertion
editing README wording you already know
running commands
inspecting JSON
making a one-line bug fix
```

Do not spend agent quota on trivial edits.

---

# 21. Commit Discipline

Use Git before and after meaningful AI changes.

Suggested flow:

```text
working state
-> git commit
-> agent performs bounded change
-> run tests
-> inspect diff
-> accept/fix/revert
-> git commit
```

Suggested commit examples:

```text
chore: initialize TypeScript project
feat: add similarity primitives
test: cover scoring edge cases
feat: add local embedding provider
feat: implement novelty scorer
test: add behavioral evaluation cases
feat: add evaluation runner
docs: document calibration results
```

---

# 22. Inspect Every Agent Diff

Before committing agent-generated code:

```bash
git diff
```

Check:

- unexpected files,
- dependency changes,
- removed tests,
- hidden constants,
- unrelated refactors,
- changed architecture,
- API keys,
- generated junk.

Do not rely on "tests pass" alone.

---

# 23. AI Usage Documentation

Maintain:

```text
AI_USAGE.md
```

Do not wait until the final 10 minutes.

Record only meaningful interactions.

Suggested format:

```markdown
# AI Usage

## Interaction 01 — Architecture Interpretation

Tool:
Codex

Objective:
Review the preparation documents and identify the implementation modules.

Constraints provided:
- TypeScript
- deterministic scoring
- no database
- local embeddings
- no UI initially

Prompt summary:
Asked Codex to summarize the architecture without writing code.

Output:
Proposed module/file breakdown.

My decision:
Accepted the module breakdown with minor naming changes.

Reason:
It matched the approved architecture and did not introduce new dependencies.
```

---

# 24. What Counts as a Meaningful Interaction

Document:

```text
architecture interpretation
module generation
substantial implementation
important debugging
test-generation strategy
evaluation framework generation
major review
significant refactor
```

You do not need to document every:

```text
typo fix
terminal command
single-line edit
small naming request
```

---

# 25. AI_USAGE.md Fields

For each important interaction, capture:

```text
Tool
Objective
Context supplied
Constraints supplied
Prompt summary
Output/result
What I accepted
What I rejected/changed
Why
```

This directly demonstrates directed collaboration.

---

# 26. Avoid Misleading AI Disclosure

Do not write:

```text
"AI was only used for minor assistance"
```

if it implemented substantial parts of the project.

Be accurate.

A strong disclosure is:

```text
AI coding agents were used to accelerate implementation, test scaffolding,
review, and debugging. Architecture, scoring design, evaluation criteria,
parameter acceptance, and final validation remained my decisions.
```

---

# 27. Suggested AI_USAGE.md Header

```markdown
# Coding Agent Usage

This project used coding agents as implementation and review tools.

I retained ownership of:
- architecture
- scoring design
- evaluation methodology
- parameter decisions
- code acceptance
- final verification

Major interactions are summarized below.
```

---

# 28. Agent Change-Control Rule

Agents must not silently change any of these:

```text
Top-K
neighbor weights
semantic/lexical weights
relevance gate design
embedding model
submission schema
evaluation categories
success criteria
```

If an agent recommends a change:

```text
1. explain why
2. show the measured failure
3. propose the smallest change
4. wait for my decision
```

---

# 29. Threshold Changes

Threshold changes are especially important.

Do not prompt:

```text
"Optimize the thresholds."
```

Prefer:

```text
"Here are relevance distributions for relevant, irrelevant, and borderline cases.
Analyze overlap and suggest two defensible threshold options.
Do not modify code."
```

Then choose manually.

---

# 30. Prevent Overfitting Through AI

AI may try to "fix" every failed case.

Reject prompts/changes that introduce:

```text
case-specific exceptions
category-specific magic numbers
keyword lists created from evaluation cases
hard-coded IDs
special handling for individual examples
```

A few documented failures are better than an overfit system.

---

# 31. Evaluation Review Workflow

After the first full evaluation:

```text
1. generate results
2. inspect failed cases manually
3. ask ChatGPT to help interpret patterns
4. ask the secondary reviewer for independent evaluation-review if useful
5. change only one parameter group
6. rerun evaluation
7. record calibration decision
```

Do not ask Codex:

```text
"Make all tests pass."
```

That is dangerous for an evaluation-driven system.

---

# 32. Critical Prompt to Avoid

Never use:

```text
"Change the implementation until all evaluation cases pass."
```

Why:

The agent may overfit the scoring logic to the test dataset.

Instead:

```text
"Analyze why these cases fail.
Do not modify code.
Group failures by likely cause."
```

---

# 33. Independent Review Prompt — Evaluation Audit

```text
Read:
- EVALUATION_PLAN.md
- current labeled cases
- current evaluation output

Do not change files.

Audit for:
- data leakage
- ambiguous labels
- weak success criteria
- overfitting
- suspicious threshold choices
- missing negative examples
- categories that are too easy
- claims not supported by the results

Return findings ranked by severity.
```

---

# 34. ChatGPT Prompt — Calibration Discussion

```text
Here are the current category metrics and failed cases.

[PASTE RESULTS]

My current configuration is:

[PASTE CONFIG]

Help me determine:
1. whether the main issue is relevance, semantic novelty, lexical novelty, or dataset quality
2. what single change would be most informative to test next
3. what result would justify keeping or reverting that change

Do not redesign the system.
```

---

# 35. If Codex Usage Limit Is Reached

Continue manually.

Priority order:

```text
1. preserve current working state
2. stop adding features
3. run tests
4. implement only core missing pieces
5. use ChatGPT app for reasoning/documentation
6. use the secondary reviewer if still available for targeted review
```

Because the architecture is already documented, core implementation should remain understandable without Codex.

---

# 36. If Secondary Review Tool Usage Limit Is Reached

No major issue.

The secondary reviewer is optional.

Use:

```text
Codex
+
manual review
+
ChatGPT discussion
```

Do not restructure the workflow around recovering access to a secondary-review tool.

---

# 37. If Both VS Code Agents Are Unavailable

Fallback:

```text
manual coding
+
ChatGPT discussion
```

The project was deliberately designed so that no generated code is conceptually difficult.

Core components are:

```text
cosine
Jaccard
Top-K sorting
weighted averages
piecewise gate
JSON loading
tests
```

---

# 38. If ChatGPT Is Temporarily Unavailable

Continue from the local documents.

They should contain enough guidance to keep implementing:

```text
PROJECT_DECISION.md
ARCHITECTURE.md
SCORING_DESIGN.md
EVALUATION_PLAN.md
AI_AGENT_PLAYBOOK.md
```

This is why important decisions should not exist only in chat history.

---

# 39. If a Hosted AI Service Is Unavailable

Do not block the project.

Options:

```text
manually create dataset
use a small already-generated static dataset if allowed and created onsite
use ChatGPT app to draft synthetic samples manually and save them
```

The core scoring system does not depend on a hosted AI service.

---

# 40. Agent-Safe Implementation Order

Recommended AI-assisted sequence:

```text
1. Codex reads docs
2. Codex scaffolds project
3. Codex implements pure scoring primitives
4. I run, test, and review
5. Codex implements embedding provider
6. I validate real embedding output
7. Codex implements NoveltyScorer
8. an optional secondary reviewer reviews the scorer
9. I accept or reject the findings
10. a hosted AI service generates synthetic baseline
11. I review the data
12. a hosted AI service generates evaluation candidates
13. I review the labels
14. Codex implements evaluator
15. I run the full evaluation
16. ChatGPT helps interpret results
17. optional independent evaluation audit
18. I calibrate one parameter at a time
19. Codex adds CLI/API only if time remains
20. ChatGPT helps prepare README/presentation
```

---

# 41. Time-Aware Agent Strategy

If the hackathon duration is tight:

## Early phase

Use agents heavily for:

```text
scaffolding
pure functions
tests
embedding integration
```

## Middle phase

Use agents for:

```text
evaluation implementation
targeted debugging
dataset scripts
```

## Final phase

Reduce code generation.

Focus on:

```text
tests
README
AI usage log
evaluation results
demo stability
Git status
presentation
```

Do not let an agent perform a large refactor near submission time.

---

# 42. Final-Hour Rule

During the final hour:

Do not approve:

```text
new architecture
new database
new framework
new embedding model
large refactor
new scoring strategy
```

unless the current project is fundamentally broken.

Prefer:

```text
working + explainable
```

over:

```text
more sophisticated + unstable
```

---

# 43. Before Every Large Agent Edit

Checklist:

```text
[ ] working tree understood
[ ] tests currently known
[ ] latest working state committed
[ ] task is bounded
[ ] expected output is clear
[ ] agent told what NOT to change
```

---

# 44. After Every Large Agent Edit

Checklist:

```text
[ ] inspect git diff
[ ] inspect package.json changes
[ ] run tests
[ ] run type-check
[ ] run relevant command manually
[ ] understand new code
[ ] update AI_USAGE.md if interaction was significant
[ ] commit only after acceptance
```

---

# 45. Minimal Verification Commands

Likely commands:

```bash
npm test
npm run typecheck
npm run evaluate
git status
git diff
```

If scripts differ, use the project equivalents.

---

# 46. What You Must Be Able to Explain Yourself

Before submission, make sure you can answer:

```text
Why local embeddings?
Why cosine similarity?
Why Top-K?
Why Top-3 initially?
Why use a lexical signal too?
Why is relevance separate?
Why is relevance multiplicative?
Why no database?
Why not an LLM judge?
How were thresholds selected?
What failed in evaluation?
How would this scale?
How exactly was AI used?
```

If you cannot explain a generated component, review it before submission.

---

# 47. AI Usage Explanation for the Final Interview

A concise explanation:

```text
I used coding agents heavily for implementation acceleration, test scaffolding,
review, and debugging.

Before implementation, I defined the architecture, scoring strategy, and
evaluation plan separately.

I gave the agents bounded tasks and explicit constraints rather than asking
them to design the whole solution.

I reviewed diffs and tests after major changes, and I kept an AI usage log
showing what I asked, what I accepted, and what I changed.

The core scoring and evaluation decisions remained mine.
```

---

# 48. Common Agent Failure Modes

Watch for:

## Over-engineering

Agent creates:

```text
repositories
factories
DI containers
multiple services
generic plugin systems
```

Reject unless justified.

---

## Silent algorithm changes

Agent changes:

```text
weights
thresholds
Top-K
formula
```

Check diffs.

---

## Test gaming

Agent modifies tests to match current output rather than intended behavior.

Always compare tests to `EVALUATION_PLAN.md`.

---

## Excessive dependencies

Agent adds libraries for simple math.

Prefer manual code for:

```text
cosine
Jaccard
weighted averages
clamping
```

---

## Unnecessary LLM calls

Agent may suggest using a hosted AI service to score novelty.

Reject unless deliberately running a secondary experiment.

---

## Confidence without evidence

Treat statements such as:

```text
"This threshold is optimal."
"This model is best."
```

as proposals unless supported by evaluation.

---

# 49. Prompt Style Template

Good agent prompts should contain:

```text
Context
Objective
Constraints
Files in scope
Out-of-scope items
Expected output
Verification requirement
```

Template:

```text
Context:
[what already exists]

Objective:
[one bounded goal]

Constraints:
[architecture/technology rules]

Files in scope:
[list]

Do not:
[list]

Expected result:
[behavior]

Verification:
[tests/commands that must pass]

Before editing:
[summarize intended changes]
```

---

# 50. Example: Bad vs Good Prompt

Bad:

```text
Implement novelty scoring.
```

Good:

```text
Context:
Pure similarity functions and the EmbeddingProvider already exist.

Objective:
Implement NoveltyScorer exactly as defined in SCORING_DESIGN.md.

Constraints:
- Top-K = config driven
- relevance must be multiplicative
- return intermediate metrics
- use existing abstractions
- no hosted AI service
- no persistence
- no UI

Files in scope:
src/scoring/*
tests/novelty-scorer.test.ts

Do not:
change scoring weights or relevance thresholds.

Verification:
all current tests must pass and new deterministic tests must cover
duplicate, relevant-novel, and irrelevant-novel behavior.

Before editing:
summarize your implementation plan.
```

---

# 51. Git + AI Audit Trail

A clean Git history helps support the AI disclosure.

Example:

```text
commit A:
project scaffold

commit B:
similarity primitives

commit C:
embedding provider

commit D:
novelty scorer

commit E:
behavioral tests

commit F:
evaluation framework

commit G:
calibrated config

commit H:
documentation
```

This naturally shows iterative engineering rather than a single giant AI-generated dump.

---

# 52. Do Not Commit Raw Agent Conversations

The brief allows summarized traces.

Prefer:

```text
AI_USAGE.md
```

over exporting huge chat transcripts.

Reasons:

- cleaner repository,
- easier review,
- lower privacy risk,
- clearer explanation of my decisions.

---

# 53. What to Record Immediately

Record an AI interaction immediately if it changes:

```text
architecture
scoring logic
model selection
evaluation methodology
thresholds
major implementation
major bug fix
```

Small implementation interactions can be summarized later if needed.

---

# 54. Emergency Simplification Strategy

If time is running out:

Remove or skip in this order:

```text
1. UI
2. REST API
3. optional Markdown report generation
4. persistent embedding cache
5. lexical n-grams
6. extra adversarial cases
7. secondary embedding experiments
```

Do not remove:

```text
core scorer
local embeddings
relevance gate
baseline data
automated tests
evaluation
README
AI disclosure
```

---

# 55. Final Agent Review Prompt

Near submission, ask the secondary reviewer or Codex in review-only mode:

```text
Review the repository against these documents:

- PROJECT_DECISION.md
- ARCHITECTURE.md
- SCORING_DESIGN.md
- EVALUATION_PLAN.md

Do not edit anything.

Check:
1. missing required functionality
2. contradictions with documentation
3. secrets or credentials
4. failing or weak tests
5. undocumented configuration
6. dead code
7. broken setup instructions
8. claims in README not supported by evaluation
9. missing AI usage disclosure
10. obvious demo risks

Return only prioritized findings.
```

Then fix only high-value findings.

---

# 56. Submission-Time AI Freeze

Once final verification starts:

```text
AI may review
AI should not perform broad edits
```

I kept the final steps under my control:

```text
npm install from clean state if practical
npm test
npm run typecheck
npm run evaluate
review README
review AI_USAGE.md
git status
verify no .env tracked
push repository
verify remote commit
```

---

# 57. Definition of Good AI Collaboration

The collaboration is successful if:

```text
AI makes implementation faster
the architecture remains coherent
I understand the code
tests reflect intended behavior
evaluation drives parameter changes
agent disagreements are resolved with evidence
usage is transparently documented
the project can continue if an agent becomes unavailable
```

---

# 58. Next Recommended Document

Next document to prepare:

```text
HACKATHON_RUNBOOK.md
```

It should define the onsite timeline from minute zero through submission, including:

- first 10–15 minutes,
- repository initialization,
- when to copy/read preparation documents,
- implementation milestones,
- Git commit checkpoints,
- dataset generation,
- evaluation/calibration window,
- optional-feature cutoff,
- final-hour freeze,
- final submission checklist.
