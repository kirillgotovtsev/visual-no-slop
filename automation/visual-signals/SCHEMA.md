# Producer data contract, schema version 1

JSON is UTF-8 with unique keys. IDs are unique ASCII letters/digits/hyphen/underscore (2–80 characters). URLs are public HTTPS without credentials. Observation timestamps are real UTC whole-second timestamps, `YYYY-MM-DDTHH:mm:ssZ`. Publication/work dates may be date-only when that is all the source establishes; unknown dates are null. No synthetic precision is added. The executable validator is [workflow.py](scripts/workflow.py).

## Sources

`sources.json` has `schema_version`, `corpus` and `sources`. All original A01–E16 IDs remain, with the original public URLs, authorship, historical date precision, access notes and limitations. Canonical aliases are not additional corroboration. Additional basis-only sources have F IDs. Each source has:

- id, title, author_or_publisher, role, urls (url, label, role)
- published_at, publication_date_note, registry_checked_at, historical_access, limitations
- independence: author_group, organization_group, template_family, repost_chain, dependency_groups, note
- monitoring: url, kind, setup endpoint verification; Git records also identify repository, branch and path
- retrieval, weekly_role, discovery_scope

Roles: primary visual example, professional_analysis, vendor_statement, scientific_paper, methodological_basis, historical_context. `static_baseline_conditional` checks versions without weekly theory summaries; `discovery_and_comparison` also checks registered author/publisher updates. Missing endpoint access is recorded honestly and remains pending. Weekly access status lives in state, never in the constant registry.

## Evidence and signals

`signals.json` has schema_version, revision, evidence and signals. Revision has status (uninitialized/active), updated_at, review_after, reviewed_active_ids, optional included_active_ids and a concise coverage_note. included_active_ids selects at most 24 displayed records; additional confirmed entries remain structured. The renderer emits only the existing six consumer frontmatter keys and the displayed active entries.

Each evidence object has id, source_id, origin_url (registered entry or discovery route), url (actual primary witness), author_or_publisher, kind, medium, access, published_at, modified_at, first_observed_at, checked_at, original_work_date, visible_observation, independent_origin_id, work_family, limitations and quote (null or short exact original-language quote). Actual image inspection also has visual_inspected=true, visual_inspected_at, visual_method, visual_url and visual_receipt. False inspection uses null dates/method. Motion additionally needs motion_scope and actual playback or frame_sequence. A receipt is a tool return identifier or a temporary image's content hash plus the recorded tool call and observation; a hash alone is not inspection.

relevance_at, relevance_kind and current_relevance_basis distinguish an actual dated work/discussion/new sample from checked_at. Allowed relevance kinds: dated_primary_work, dated_analysis_of_examples, new_sample_of_continued_use. HTTP headers, recrawls, repost dates and old-source rereads cannot renew relevance. The source's limitations remain part of the evidence even after a successful retrieval.

Each signal has id, name, status (active/watchlist/retired), medium, context, evidence_ids, limitations and history. Nonactive entries include status_reason. Active entries additionally have:

- visible_combination: at least three role/description components with relationships across at least two roles
- trigger, action, exception, independence_reason, confidence_basis
- first_seen, last_confirmed, expires_at; these are not replaced by the retrieval date
- editorial_review: decision=admit, concrete_visible_combination=true, reviewed_at, rationale, useful_convention, justified_exception, counterevidence

The model must make this editorial assessment from visible material. Repeated origin IDs and work_family values do not satisfy independent admission. Active entries require two recent independent origins and two inspected works. The timestamp validator is deliberately conservative: last_confirmed cannot exceed the weaker dated relevance basis. Unknown or older relevance leaves a candidate on watchlist. Structured validation does not establish artistic judgment or truthfulness of a receipt.

## State and run receipts

`state.json`: schema_version, last_completed_week, last_run_id, base_git_sha, input_sha256, completed_runs, incomplete_runs, sources, fetches, pending, coverage. Per-source state keeps last_check, last_successful_review_at, covered_through and unresolved ranges. Per-URL fetches retain ETag, Last-Modified, content SHA-256, observed upstream SHA, access and last checked time. Only reviewed ranges advance checkpoints. Static availability alone does not advance a dynamic discovery interval. Pending work is explicit and never marked read.

Run JSON records run_id, executor, base SHA, start/end, research interval, budgets consumed, source receipts, visuals, candidates, editorial review, tests, pending work, content changes and publication intent/readback limits. Its companion Markdown is a short Russian report. The scheduler result records the commit and post-commit verification. No raw source HTML or media is published by default.

## Publication plan

A temporary plan contains base_sha, base_tree_sha, run_id, protected_inputs and entries with path, mode, type, UTF-8 content, sha256 and git_blob_sha. These two hash fields are local verification fields, not GitHub tree parameters. The full diff is checked; symlinks, path traversal, deletion and unauthorized paths fail. Atomic reference update requires the original parent SHA. After an uncertain response, inspect the remote run ID and manifest before any retry.

Freshness and resource intervals are explicit initial project settings in config.json, not measured scientific thresholds. They may be changed only by a separate maintenance instruction.
