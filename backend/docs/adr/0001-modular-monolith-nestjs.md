# ADR 0001: NestJS modular monolith

Sabzine's purchase, plan request, review, publication, meal log, and weekly reward must commit together or not at all. One NestJS codebase with two processes (`api` and `worker`) sharing one PostgreSQL database keeps those transactions local.

A separate service per workflow would split the wallet debit from request creation and force a distributed transaction. The expected load does not justify that. Modules follow the product boundaries (identity, wallet, plans, and so on) so a later split is still possible.

Dart on the server was rejected because payment, SMS, and model SDKs are stronger in the Node ecosystem. The Flutter app keeps its own models and will consume the OpenAPI document.
