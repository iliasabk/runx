---
name: crm-cleanup
description: Reconcile a call transcript against CRM records read live from a data store, then commit the supported allowlisted field updates through the CRM event-store transport and seal a write_result with before and after state.
---

# CRM Cleanup

Keep pipeline data from rotting after calls without letting an agent write to
the CRM on vibes. The skill reads the current records from a real CRM source
at run time — the event stream behind `crm_source` — reconciles the
transcript against them, and executes the supported field updates through a
CRM transport (`data.append_event`) in the same run. The sealed result proves
the write with a post-commit re-read: `write_result.before` is the projected
record set before the run's write, `write_result.after` is the projected set
re-read after it, and `committed_event` carries the event ref and digest.

## Procedure

1. An optional `crm_bootstrap` connector export is imported as a
   `crm.records_snapshot` event so harnesses and cold stores start populated;
   omit it when the store already holds the records.
2. `data.read_projection` and `data.read_events` read the current CRM stream
   at run time; deterministic code folds `crm.records_snapshot` and
   `crm.field_updates` events into the live record set.
3. Native `data.digest` binds the exact transcript and the projected records.
4. The reconciling agent proposes field updates from the transcript, each
   with the target record, field, new value, and a supporting quote, plus
   `takeaways` summarizing the call.
5. Deterministic enforcement checks every proposal: the record must exist in
   the stored set, the field must be inside `crm_schema.allowed_fields`
   (out-of-allowlist updates are rejected with a named reason, not silently
   dropped), the quote must appear verbatim in the transcript, the value must
   be non-empty, and it must actually change the stored value. An unknown
   record or an invented quote refuses the whole run; nothing partial is
   written.
6. When updates survive, `data.append_event` commits one `crm.field_updates`
   event carrying the batch, its evidence digests, and an idempotency key
   derived from the record digest — optimistic-concurrency checked against
   the head version read in step 2. When nothing survives, no write occurs.
7. A post-write `read_events` re-reads the stream; the seal step re-projects
   before and after state and binds the committed event to the decision.

## Output

`crm_cleanup_result` (`runx.crm_cleanup_result.v1`) carries `takeaways`,
`field_updates` (each with `record_id`, `field`, `from`, `to`, and the
verbatim `evidence_quote`), and `write_result` — `{transport, executed,
before, after, committed_event}` — plus `decision` (`executed`, `no_action`,
`refused`), `rejected_updates`, `validation`, and both input digests. The
three required outputs are also emitted separately as `takeaways`,
`field_updates`, and `write_result`.

Inputs are `transcript`, `crm_source` (`data_source_ref`, `resource`,
`aggregate_id`), `crm_schema`, and optional `crm_bootstrap`.

## Agent task contracts

### `crm-cleanup-reconcile`

Read `transcript` and `crm_schema` from step inputs and `crm_records` — the
record set projected from the CRM store — from step context. Return
`reconcile_draft` with `takeaways` (short strings capturing what the call
established) and `updates`: an array of `record_id`, `field`, `to`, and
`evidence_quote` entries. Only propose updates the transcript actually
supports, quote the transcript verbatim, and only target fields inside the
allowlist. Return an empty `updates` array when the call changes nothing.
Never invent records, quotes, or values.
