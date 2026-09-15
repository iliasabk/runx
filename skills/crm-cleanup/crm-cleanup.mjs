const SNAPSHOT_EVENT = "crm.records_snapshot";
const UPDATES_EVENT = "crm.field_updates";

export function bootstrapGate(inputs) {
  const bootstrap = record(inputs.crm_bootstrap);
  const records = (Array.isArray(bootstrap.records) ? bootstrap.records : []).map(record);
  return {
    bootstrap_gate: {
      decision: records.length > 0 ? "import" : "skip",
      snapshot_event: { type: SNAPSHOT_EVENT, payload: { records } },
      idempotency_key: "crm-cleanup:bootstrap:v1",
    },
  };
}

export function projectRecords(inputs) {
  const data = record(inputs.read_result);
  const events = Array.isArray(data.events) ? data.events : [];
  const records = applyEvents(events);
  return {
    records_packet: {
      schema: "runx.crm_records_projection.v1",
      records,
      event_count: events.length,
      head_version: numberOrNull(data.after_version),
      last_event_ref: lastEventRef(events),
    },
  };
}

export function decideUpdates(inputs) {
  const transcript = typeof inputs.transcript === "string" ? inputs.transcript : "";
  const source = record(inputs.crm_source);
  const records = (Array.isArray(inputs.crm_records) ? inputs.crm_records : []).map(record);
  const allowedFields = uniqueStrings(record(inputs.crm_schema).allowed_fields);
  const draft = record(inputs.reconcile_draft);
  const proposed = (Array.isArray(draft.updates) ? draft.updates : []).map(record);
  const takeaways = uniqueStrings(draft.takeaways);
  const recordsById = new Map(records.map((entry) => [stringValue(entry.id), entry]));
  const findings = [];
  const updates = [];
  const rejected = [];

  for (const update of proposed) {
    const recordId = stringValue(update.record_id);
    const field = stringValue(update.field);
    const to = update.to;
    const quote = stringValue(update.evidence_quote);
    const target = recordsById.get(recordId);
    if (!target) {
      findings.push({ code: "update.unknown_record", message: `update targets unknown record ${recordId ?? "(missing)"}.` });
      continue;
    }
    if (!field || !allowedFields.includes(field)) {
      rejected.push({ record_id: recordId, field: field ?? "", reason: "field is outside the crm_schema allowlist" });
      continue;
    }
    if (!quote || !transcript.includes(quote)) {
      findings.push({ code: "update.unsupported_evidence", message: `update to ${recordId}.${field} cites a quote that is not present in the transcript.` });
      continue;
    }
    if (to === undefined || to === null || to === "") {
      findings.push({ code: "update.empty_value", message: `update to ${recordId}.${field} carries no target value.` });
      continue;
    }
    const from = target[field] === undefined ? null : target[field];
    if (from === to) {
      rejected.push({ record_id: recordId, field, reason: "update does not change the stored value" });
      continue;
    }
    updates.push({ record_id: recordId, field, from, to, evidence_quote: quote });
  }

  const failed = findings.length > 0;
  const decision = failed ? "refused" : updates.length > 0 ? "executed" : "no_action";
  const recordsDigest = requiredDigest(inputs.records_digest);
  const transcriptDigest = requiredDigest(inputs.transcript_digest);
  return {
    decision_packet: {
      schema: "runx.crm_cleanup_decision.v1",
      decision,
      reason: failed
        ? "Refused: the reconciliation draft does not reconcile deterministically with the stored records and transcript."
        : updates.length > 0
          ? `Executed ${updates.length} allowlisted field update(s), each traced to transcript evidence, through the CRM event-store transport.`
          : "No actionable field updates were supported by the transcript; no write occurred.",
      takeaways,
      field_updates: failed ? [] : updates,
      rejected_updates: rejected,
      write_event: {
        type: UPDATES_EVENT,
        payload: {
          updates: failed ? [] : updates,
          decided_by: "crm-cleanup",
          evidence: { transcript_digest: transcriptDigest, records_digest: recordsDigest },
        },
      },
      idempotency_key: `crm-cleanup:${stringValue(source.aggregate_id) ?? "records"}:${recordsDigest.slice(7, 39)}`,
      transcript_digest: transcriptDigest,
      records_digest: recordsDigest,
      validation: { status: failed ? "fail" : "pass", findings },
    },
  };
}

export function sealResult(inputs) {
  const source = record(inputs.crm_source);
  const beforeData = record(inputs.before_events);
  const afterData = record(inputs.after_events);
  const decision = record(inputs.decision);
  const beforeEvents = Array.isArray(beforeData.events) ? beforeData.events : [];
  const afterEvents = Array.isArray(afterData.events) ? afterData.events : [];
  const beforeRecords = applyEvents(beforeEvents);
  const afterRecords = applyEvents(afterEvents);
  const committed = decision.decision === "executed"
    ? afterEvents.filter((entry) => entry.idempotency_key === decision.idempotency_key && (entry.event_type === UPDATES_EVENT || record(entry.event).type === UPDATES_EVENT)).pop() ?? null
    : null;
  const executed = Boolean(committed);
  const findings = Array.isArray(record(decision.validation).findings) ? record(decision.validation).findings : [];
  if (decision.decision === "executed" && !executed) {
    findings.push({ code: "write.not_observed", message: "the executed decision produced no committed crm.field_updates event in the post-write read." });
  }
  const appliedUpdates = committed ? (Array.isArray(record(record(committed.event).payload).updates) ? record(record(committed.event).payload).updates : []) : [];
  const writeResult = {
    transport: "data.append_event",
    data_source_ref: stringValue(source.data_source_ref) ?? "",
    resource: stringValue(source.resource) ?? "",
    aggregate_id: stringValue(source.aggregate_id) ?? "",
    provider: stringValue(afterData.provider) ?? stringValue(beforeData.provider) ?? "",
    executed,
    before: {
      records: beforeRecords,
      event_count: beforeEvents.length,
      head_version: numberOrNull(beforeData.after_version),
    },
    after: {
      records: afterRecords,
      event_count: afterEvents.length,
      head_version: numberOrNull(afterData.after_version),
    },
    committed_event: committed
      ? {
          event_ref: committed.event_ref,
          event_digest: committed.event_digest,
          event_type: committed.event_type,
          version: committed.version,
          idempotency_key: committed.idempotency_key,
          applied_updates: appliedUpdates,
        }
      : null,
  };
  const result = {
    schema: "runx.crm_cleanup_result.v1",
    decision: stringValue(decision.decision) ?? "refused",
    reason: stringValue(decision.reason) ?? "",
    takeaways: Array.isArray(decision.takeaways) ? decision.takeaways : [],
    field_updates: Array.isArray(decision.field_updates) ? decision.field_updates : [],
    write_result: writeResult,
    rejected_updates: Array.isArray(decision.rejected_updates) ? decision.rejected_updates : [],
    transcript_digest: requiredDigest(decision.transcript_digest),
    records_digest: requiredDigest(decision.records_digest),
    validation: { status: findings.length > 0 ? "fail" : "pass", findings },
  };
  return {
    takeaways: result.takeaways,
    field_updates: result.field_updates,
    write_result: writeResult,
    crm_cleanup_result: result,
  };
}

function applyEvents(events) {
  const byId = new Map();
  const order = [];
  for (const entry of events) {
    const eventType = entry.event_type ?? record(entry.event).type;
    const payload = record(record(entry.event).payload);
    if (eventType === SNAPSHOT_EVENT) {
      for (const item of Array.isArray(payload.records) ? payload.records : []) {
        const source = record(item);
        const id = stringValue(source.id);
        if (!id) continue;
        if (!byId.has(id)) order.push(id);
        byId.set(id, { ...(byId.get(id) ?? { id }), ...source, id });
      }
    } else if (eventType === UPDATES_EVENT) {
      for (const update of Array.isArray(payload.updates) ? payload.updates : []) {
        const id = stringValue(update.record_id);
        const field = stringValue(update.field);
        if (!id || !field) continue;
        if (!byId.has(id)) order.push(id);
        const current = byId.get(id) ?? { id };
        current[field] = update.to;
        byId.set(id, current);
      }
    }
  }
  return order.map((id) => byId.get(id));
}

function lastEventRef(events) {
  const last = events[events.length - 1];
  return last ? last.event_ref ?? null : null;
}

function requiredDigest(value) {
  if (typeof value !== "string" || !value.startsWith("sha256:")) {
    throw new Error("native digest evidence is missing");
  }
  return value;
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(stringValue).filter(Boolean))];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
