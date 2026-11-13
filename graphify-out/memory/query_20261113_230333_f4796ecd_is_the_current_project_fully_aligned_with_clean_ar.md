---
type: "query"
date: "2026-11-13T23:03:33.123121+00:00"
question: "Is the current project fully aligned with Clean Architecture?"
contributor: "graphify"
outcome: "dead_end"
source_nodes: ["DemoStore"]
---

# Q: Is the current project fully aligned with Clean Architecture?

## Answer

Expanded terms from graph vocabulary: controller service data core transaction. Existing graph contains older Flutter paths and does not cover the current backend, so it is insufficient for the full audit. Direct source inspection confirms mixed business rules and PostgreSQL in backend/src/plans/plans.service.ts, application imports concrete data repositories in app/lib/features/coach/application/coach_controller.dart, and domain imports a network exception in app/lib/domain/commerce/commerce.dart. frontend domain/progress.ts depends on wizard store types and browser sessionStorage. Modular monolith is compatible with Clean Architecture; ADR 0001 chooses deployment and transactions, not explicitly transaction scripts. Flutter has live API wiring, so DemoStore dependency does not prove all data is demo.

## Outcome

- Signal: dead_end

## Source Nodes

- DemoStore