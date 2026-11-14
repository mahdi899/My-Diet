# ADR 0004: Isolate application rules inside the modular monolith

ADR 0001 remains the deployment and transaction model: one PostgreSQL database,
with API and worker processes. Clean Architecture concerns source dependencies,
so these boundaries do not require separate services or databases.

## Plans

`plans/domain/` owns draft models, validation and generation contracts.
`plans/application/PlanUseCases` coordinates generation, review, publication and
questions through application-owned ports. It does not import Nest, pg, SQL,
environment configuration, or concrete onboarding/budget services.

`plans/infrastructure/PostgresPlanRepository` implements storage operations and
maps driver results into port records. Its transaction callback supplies one
session for every operation, audit entry, notification and outbox event in that
transaction. The generation lock stays held across the provider call and cost
recording, preserving the existing concurrency and billing behavior.

`plans.service.ts` is the Nest compatibility adapter. Existing consumers keep
the same methods and HTTP errors. When money or another existing workflow passes
a `PoolClient`, this adapter binds a session to that client; it must not open a
second transaction. `plans.module.ts` supplies concrete providers, encryption,
profile access, budget checks and telemetry.

## Onboarding transfers

The HTTP controller handles routing and actors. `onboarding/application/` owns
the transfer scenarios and ports; `onboarding/infrastructure/` owns SQL and Zibal.
The admin module composes these with phone hashing, unique amounts and SMS.
User locks, unique bank references, callback confirmation and their audits retain
their original transaction boundaries. SMS is sent after confirmation commits.

## Clients

Flutter's `CoachSession` is independent of Flutter; the presentation
`CoachController` adapts its changes to `ChangeNotifier`. Repository selection
belongs in `features/coach/composition.dart`.

Commerce top-up orchestration lives in `application/commerce/`, receives a browser
callback, and throws application failures rather than network exceptions.
The home and main plan tabs consume `CustomerWorkspace`; nutrition calculations
consume `NutritionSource`. `DemoStore` remains a legacy adapter implementing those
contracts. Meal/questionnaire models and date/digit helpers live in `domain/`;
legacy data paths re-export them for existing consumers. Water storage implements
`WaterRepository` in the data layer.

The React onboarding domain already owns its stage types and pure history rules;
browser persistence belongs in `infrastructure/progress-storage.ts`.

## Enforcement and scope

Architecture tests traverse inner-layer imports, including type imports, to
prevent renewed dependencies on frameworks, drivers or concrete adapters.
Behavioral tests cover application failures, top-up browser injection, and
duplicate/concurrent transfers against PostgreSQL.

This is an incremental boundary repair for the identified slices. Other legacy
backend services and Flutter screens still require their own migration; this ADR
does not declare the entire repository Clean Architecture compliant.
