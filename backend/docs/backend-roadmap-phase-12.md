# Phase 12 — Administration, privacy, and public website

Questionnaire publication, specialist verification, prices, rewards, review moderation, support, AI controls, and audit logs already exist. Account deletion still removes the phone and clinical text and keeps the ledger. This phase adds the missing public magazine, consent versions, and versioned site configuration.

## Articles

`GET /v1/public/articles?page=&pageSize=` returns published cards compatible with the magazine list: `id`, `title`, `category`, `image`, `time`, `intro`. `pageSize` is at most 20. Drafts are absent, and a draft address returns 404.

`GET /v1/public/articles/:slug` adds `sections` of plain heading and body text. HTML is rejected and nothing is stored.

Admin create starts at version 1 as a draft. Each text change and each publish or unpublish writes the next version. The previous version stays in `article_versions`. Publishing the current status again does not mint a version.

The six magazine slugs are seeded published: `weekly-planning`, `balanced-plate`, `small-habits`, `shopping-list`, `food-variety`, `mindful-meals`.

## Consent

Published consent documents are `terms` and `health_data`, each version 1. `GET /v1/public/consents` lists published versions only.

`POST /v1/me/consents` records one row per user, purpose, and version. Repeating it returns the original time. A draft version cannot be recorded.

## App download

`GET /v1/public/config` still returns `minAppVersion` and the price catalog. It also returns `download`. Version 1 is `not_released` with `url: null`.

`GET /v1/public/app-download` returns the same download fact. An admin can publish a later version only with an `https` address the admin supplied. Example and local hosts are rejected. A not-yet-released version cannot carry an address.

Public reviews stay on their existing route. Production migration was not run.
