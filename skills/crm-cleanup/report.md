# Delivery report — crm-cleanup (Frantic bounty #79)

- Published package: `iliasabk/crm-cleanup@sha-53fe0b2c748b`, listing https://runx.ai/x/iliasabk/crm-cleanup via `runx registry publish ./skills/crm-cleanup/SKILL.md --registry https://api.runx.ai` on runx-cli 0.9.1.
- Clean install verified with `runx add iliasabk/crm-cleanup@sha-53fe0b2c748b --registry https://api.runx.ai`.
- Harness green: `runx harness ./skills/crm-cleanup` passed all 4 cases locally (traced updates proposed, unlisted field rejected, no-change transcript seals no_action, missing transcript needs evidence).
- Dogfood records came from a real data-store read: `append_event` seeded `acct-nsc` and `read_projection` read it back from the live sqlite event store (receipts `sha256:4e16734c…`, `sha256:1bdaccc5…`).
- Dogfood transcript is a real call: `web-fetch` pulled the Norfolk Southern Q3 2021 earnings call transcript from the public ECTSum dataset at run time (receipt `sha256:d72528f7…`, 21,592 chars).
- Sealed dogfood run `run_reconcile_46e57495be69e8df`: `decision=proposed`, two allowlisted updates (account_status → watch, next_action → Q4 review) each traced to a verbatim quote, `write_performed=false`, gate `crm-operator-or-human-approver`, receipt `sha256:922db219…`.
- `fixtures/` keeps the verbatim transcript and the records/schema read; `harness/` keeps the dogfood output and sealed receipt.

## What changed

- `fixtures/`, `harness/`, `evidence.json`, `verification.json`, and this report for the bounty delivery.
