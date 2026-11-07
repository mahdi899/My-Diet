# Demo campaign links

Admin: `/admin/#campaign-links`. Create a name, source and unique English suffix; copy `/go/<suffix>` into the advertisement. Each request checks the database and redirects temporarily to the fixed `/demo/` destination with `utm_source`, `utm_medium=campaign`, and `utm_campaign=<suffix>`. Existing demo navigation preserves these parameters and Umami reports them in **کانال‌های ورودی**.

Disabling returns HTTP 410 without a redirect. Unknown suffixes also return 410. The API and Nginx prohibit caching these responses; no permanent redirects are used. Already-open pages and the public demo URL remain accessible. Shared/copied final demo URLs are not revocable campaign links.

Only authenticated administrators can list/create/toggle links. Changes are audited. Destinations cannot be supplied by clients, preventing open redirects. Names and sources cannot be changed after creation; create another link for a different campaign. The raw open count includes previews, bots, and repeated requests; use Umami visits for audience statistics. HEAD does not increase the count.

Deployment: apply migration `1737763200000_demo_campaign_links.sql`, rebuild the API image, run `tool/deploy-tracking.py` to install the `/go/` gateway and restart the API. The existing PostgreSQL backup includes the table.

Validation:

```text
cd backend
npm run build
node --test test/unit/campaign-links.spec.mjs
cd ..
node tool/check-campaign-links.cjs
```

The live check creates a unique temporary link, verifies authorization, validation, duplicate handling, active/disabled/reactivated responses through the public CDN, then removes only its own fixture. It requires the existing ignored local admin configuration and SSH access.
