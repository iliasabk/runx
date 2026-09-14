# Delivery notes — postmortem-maker (Frantic bounty #83)

Published package: `iliasabk/postmortem-maker@sha-e6bc1b98d052`
(registry: https://api.runx.ai, listing: https://runx.ai/x/iliasabk/postmortem-maker)

## What this change adds

- `fixtures/` — three fragment sets, including `aws_dynamodb_2025-10-19.json`
  transcribed verbatim from the live-fetched AWS post-event summary.
- `harness/` — harness output and sealed case receipts from local runs.
- `evidence.json`, `verification.json` — delivery evidence for the bounty.
- `SKILL.md` — new "Verifying a dogfood run" section documenting the
  live-source read and the gated send-as composition.

## Dogfood summary

web-fetch read the real AWS DynamoDB disruption summary
(aws.amazon.com/message/101925/) at run time; five fragments quote it
verbatim; the skill sealed `publishable` with validation pass
(receipt sha256:2df59e...), then send-as `plan` sealed the gated publish
composition (receipt sha256:441fda...).
