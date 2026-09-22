# Hiring and onboarding funnel

The site sends these GA4 events when `NEXT_PUBLIC_GA_ID` is configured. Events contain only their names; they do not include contact details, message text, builder IDs, or hire request IDs.

## Hiring

| Event | Meaning |
| --- | --- |
| `hire_profile_viewed` | A builder profile sidebar rendered in the browser |
| `hire_opened` | A visitor clicked Hire This Builder |
| `hire_form_started` | A visitor first focused a field in the hire form |
| `hire_request_submitted` | A valid form started a request to `/api/hire` |
| `hire_request_created` | `/api/hire` returned success after storing the request |
| `hire_request_validation_failed` | The browser rejected the form |
| `hire_request_api_failed` | `/api/hire` returned an error |
| `hire_request_network_failed` | The request or response failed in the browser |
| `hire_builder_replied` | The builder's dashboard received success after posting a reply |

Use GA4's event counts to locate the largest drop-off, then inspect the relevant UX. Browser events can be blocked, so use the database's `hire_requests` and `hire_messages` rows for actual request and reply totals. The existing `profile_views` table deduplicates views and excludes self-views, while `hire_profile_viewed` counts browser renders; do not compare their raw counts as a conversion rate.

## Onboarding

`onboarding_profile_viewed`, `onboarding_links_viewed`, `onboarding_project_viewed`, and `onboarding_go_viewed` mark visits to each step. `onboarding_profile_completed`, `onboarding_links_completed`, `onboarding_project_added`, `onboarding_project_skipped`, and `onboarding_completed` mark successful actions. The project step remains optional. The separate event names make stage counts available without registering GA4 custom dimensions.

Dashboard redirects for an existing profile to repair its GitHub connection use `mode=recovery`. These visits are excluded from new-user onboarding events; a new user's GitHub OAuth return to step 2 remains in the normal flow and proceeds to the optional project step.

## Production smoke test

Use a builder profile and inbox controlled by the team. Submit one request labeled as a test, confirm its row appears in the builder's dashboard, confirm the email arrives, reply from the builder dashboard, and confirm the sender's chat link shows the reply. Delete the test request afterward. Check the event stream for the corresponding hire events; allow for analytics blocking or processing delay.
