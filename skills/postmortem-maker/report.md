# Delivery report — postmortem-maker (Frantic bounty #83)

- Published package: `iliasabk/postmortem-maker@sha-e6bc1b98d052`, public listing https://runx.ai/x/iliasabk/postmortem-maker — published with `runx registry publish ./skills/postmortem-maker/SKILL.md --registry https://api.runx.ai` on runx-cli 0.9.1.
- Clean install verified: `runx add iliasabk/postmortem-maker@sha-e6bc1b98d052 --registry https://api.runx.ai` fetched the package from the registry into `/tmp/skills/iliasabk/postmortem-maker/sha-e6bc1b98d052/`.
- Harness green twice: `runx harness ./skills/postmortem-maker` passed all 4 cases locally, and `runx harness` on the installed registry copy also passed 4/4 (publishable seals, unknowns block, invented citation refuses, missing fragments need more evidence).
- Live-source dogfood: `runx skill ./skills/web-fetch -i url=https://aws.amazon.com/message/101925/` read the real AWS DynamoDB post-event summary at run time; five incident fragments quote it verbatim.
- Sealed dogfood result: run `run_make_6cee8a9a55298f09` sealed receipt `sha256:2df59ed9cc936aeb147273a5f29f860e51ff669a44e165582d493772dd3ee901` with `decision=publishable` and citation validation pass.
- Gated publish composition: `runx skill ./skills/send-as plan` sealed receipt `sha256:441fdabde78d808631e73d08648789b8d793f6501b8fcf0b6facf2e1faa9cf5a`; the send stayed behind the `human-approver` gate and was honestly blocked with `connector_required` because no comms connector is bound.
- Negative proof: an earlier run with an incomplete fragment set was refused (`timeline.unsupported`, `root_cause.unsupported`, receipt `sha256:550d2146...`), showing the validator rejects unsupported citations.
- `fixtures/` adds `aws_dynamodb_2025-10-19.json` (verbatim transcription of the fetched AWS incident) alongside the consistent and conflicting sets; `harness/` keeps the harness output and sealed case receipts.

## What changed

- `fixtures/`, `harness/`, `evidence.json`, `verification.json`, this report, and a new "Verifying a dogfood run" section in `SKILL.md` documenting the live-source read and the send-as composition.
