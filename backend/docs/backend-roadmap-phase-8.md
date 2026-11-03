# Phase 8 — Plan-change requests and publication

A customer can ask to replace the current active plan. The previous plan stays active until a replacement draft is published in the same transaction as the request approval.

## API

- `GET /v1/me/plan-change-reasons` lists active configured reasons.
- `POST /v1/me/plan-changes` accepts `commandId`, the current `versionId`, one or more reason ids, an optional explanation, and optional day or meal targets. The same command returns the original request. A second open request is `409 open_request`. A version that is no longer active is `409 plan_changed`.
- Reason labels are copied onto the request. Renaming or deactivating a reason does not rewrite that copy.
- `GET /v1/me/plan-changes` and `GET /v1/me/plan-changes/:id` are the customer projection. `POST /v1/me/plan-changes/:id/replies` answers an open clarification and returns the request to the specialist queue.
- `GET /v1/specialist/plan-changes` is the assigned specialist queue. Unassigned specialists receive `404`. The queue is not inserted into the chat as a request card.
- `POST /v1/specialist/plan-changes/:id/review` moves `awaiting_review` to `under_review`.
- `POST /v1/specialist/plan-changes/:id/clarifications` opens one required question. `substate` becomes `awaiting_clarification` and approval stays blocked.
- `POST /v1/specialist/plan-changes/:id/reject` requires an explanation and does not change the active plan.
- `POST /v1/specialist/plan-changes/:id/approve` requires `If-Match` for the replacement draft. Publication, request completion, the active-plan pointer, and the plan notification happen in one transaction. A failed publication leaves the request unapproved and the previous plan in place. One of two concurrent approvals succeeds.
- `PUT /v1/admin/plan-change-reasons/:id` changes the live label or active flag only.

Submission, clarification reply, rejection, and successful publication also write a short system line on the care conversation. The line and the notification carry the request id, not the explanation, the reply, or a phone number. Old plan versions and existing consumption rows stay where they were.

## Storage

Additive migration `1737244800000_plan_changes.sql`. Production migration was not run.
