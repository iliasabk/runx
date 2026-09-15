# Delivery report — crm-cleanup 0.2.0 (Frantic bounty #79, revision)

- Published package: `iliasabk/crm-cleanup@sha-b96caf149e87`, listing
  https://runx.ai/x/iliasabk/crm-cleanup, via
  `runx registry publish ./skills/crm-cleanup/SKILL.md --registry https://api.runx.ai`
  on `runx-cli 0.9.1`.
- Registry metadata resolves:
  `runx registry read iliasabk/crm-cleanup@sha-b96caf149e87 --registry https://api.runx.ai --json`
  returns digest `0160d1c5…`, runner `reconcile`, required scopes
  `runx:data:append` + `runx:data:read`.
- Clean install verified:
  `runx add iliasabk/crm-cleanup@sha-b96caf149e87 --registry https://api.runx.ai`.
- Harness green on the source tree and on the installed registry package:
  `runx harness` passes all 5 cases — an executing case, a no-op case, an
  allowlist rejection, a refused invented quote, and a missing-transcript
  failure.

## What the skill does now

The graph reads the CRM stream at run time (`data.read_projection` +
`data.read_events` on `crm_source`), folds `crm.records_snapshot` /
`crm.field_updates` events into the live record set, lets the agent draft
`takeaways` + `updates`, validates every update deterministically
(allowlist, verbatim transcript quote, known record, non-empty changed
value), commits the survivors through the CRM transport
(`data.append_event`, optimistic concurrency against the read head
version), re-reads the stream, and seals `takeaways`, `field_updates`, and
`write_result {before, after, committed_event}`. With no supported updates
the write step does not run and nothing is committed.

## Dogfood

- Records source: `acct-nsc` was seeded as a `crm.records_snapshot` on
  `local://runx-data-store/crm-dogfood-final` (seed receipt
  `sha256:0bf4d593…`); the run read it back live through
  `data.read_projection` + `data.read_events`.
- Transcript source: real Norfolk Southern Q3 2021 earnings call transcript
  fetched live from the public ECTSum dataset (receipt `sha256:a5c0508f…`).
- Executed run (`run_reconcile_e359651c0afb5730`, installed registry
  package): `decision=executed`; three allowlisted updates —
  `account_status active→watch`, `next_action none→"Revisit service-level
  impact in the fourth quarter review"`, `health_score 72→68` — each bound
  to a verbatim quote; committed `crm.field_updates` event
  `crm_records:pipeline-q3:2` (digest `sha256:eb689cf2…`); receipt
  `sha256:87b7b267a4235be66cf83edc98c92a0e64d2cd3882abf7ef7da510aa902e911e`.
- No-op run (`run_reconcile_8e691f6603dc1109`): `decision=no_action`,
  `write_result.executed=false`, `committed_event=null`, before==after;
  receipt
  `sha256:12ff9ce1e71617d3bc564ccfec7c72237f0299c7f94dad098299c5ccc3afc5a7`.
- Both receipts verify:
  `runx verify --receipt <receipt>.json --allow-local-development-signatures --json`
  → signature valid (local-development `runtime-skeleton`), content address
  valid, zero findings.

## Files

- `skills/crm-cleanup/` — package source (`SKILL.md`, `X.yaml`,
  `crm-cleanup.mjs`, `fixtures/`, `harness/` input fixtures).
- `deliverables/frantic-79/` — dogfood outputs, sealed receipts, seed and
  transcript-fetch receipts, `evidence.json`, `verification.json`, and this
  report.
