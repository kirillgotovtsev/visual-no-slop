# Meatlook enquiry journey check

Checked on **25 October 2026, Europe/Moscow** (24 October UTC). Repository
baseline: `762bb0a68e9ea4584f28b5c9859a6202b15e0ede`. This record describes
the live site at the time of inspection, not an immutable property of release
1.4.0. No customer enquiry, file upload, payment or message was sent.

## Result

No blocking navigation or form-initialization failure was observed. The
homepage and both service pages match the personal marketing review described
by the repository. All three routes reach the same working enquiry interface.
There is a specific measurement gap for late analytics consent, and the
browser's form payload has no explicit campaign or service attribution fields.
Successful storage and delivery of a submitted enquiry remain unverified.

## Routes and offer match

All entry URLs below returned HTTP 200 without losing their query parameters.
They were also opened in Chrome, and each named CTA was followed to
`https://meatlook.ru/order.html`.

| Entry | What the visitor sees | CTA followed | Result |
|---|---|---|---|
| [README homepage link](https://meatlook.ru/?utm_source=visual_no_slop&utm_medium=readme&utm_campaign=human_review) | A general review of a site, product, strategy or presentation; author identity, 50,000 RUB, personal discussion and written conclusions | Прислать материал | Enquiry form ready |
| [Skill: website](https://meatlook.ru/services/razbor-sayta.html?utm_source=visual_no_slop&utm_medium=skill&utm_campaign=human_review) | Offer, evidence, purchase conditions and next action; explicitly covers advertising launch and contractor acceptance | Показать сайт | Enquiry form ready |
| [Skill: proposal/presentation](https://meatlook.ru/services/razbor-kp-i-prezentacii.html?utm_source=visual_no_slop&utm_medium=skill&utm_campaign=human_review) | Argument, evidence, terms and the client's decision before sending a document | Показать КП или презентацию | Enquiry form ready |

The price is a dated observation, not a value to insert into recurring skill
suggestions. Scope and timing are agreed before work. The service pages exclude
redesign/implementation and do not guarantee business results. This is
consistent with `references/human-review.md`.

The homepage is a valid route: its primary CTA reaches the form in one click.
It gives less service-specific detail than the two landing pages. The original
README tells readers to see the service pages but links only to the homepage.
Adding two direct links is a small navigation improvement, not a repair of a
broken link or evidence that the homepage converts worse. The homepage link
remains available. The README now also identifies the landing pages as Russian;
this does not claim that the service is available in any particular language.

## Form interface

The common form shows the price and explains that submission starts a discussion
of the task and timing, including when the visitor has not yet decided to buy.
It requests name, email or phone, task, optional material links/files and deadline,
plus data-processing consent. File formats and limits are stated. The desktop
form and a service page were visually inspected; physical mobile devices,
mobile layouts, Safari and assistive technology were not tested.

Observed checks:

- The initial disabled submit button becomes enabled with “Форма готова к отправке.”
  This occurred with only necessary cookies selected; analytics consent is not
  required to initialize the form.
- Activating submit with all fields empty displays errors for name, contact,
  task and consent, and focuses the first invalid field.
- Entering an invalid contact while leaving the required fields empty displays
  the email/phone-specific error. The value was subsequently cleared.
- Inspection of the served `order.js` confirms that these invalid cases return
  before `fetch`/POST. No valid form was submitted and consent was not checked.
- Cookie settings can be reopened; both choices work. Allowing analytics on the
  form page inserts the Metrika script. The choice was restored to necessary
  cookies after inspection. Script insertion does not prove receipt of events.

The public code posts `new FormData(form)` to `/api/orders.php`. It only shows
success and calls `orderSuccess` after an OK response containing `ok: true`
and a nonempty `order_id`. Error/retry paths and file validation exist in source,
but their server behavior, actual attachments, persistence, notification delivery
and the success UI were not exercised. No claim of an end-to-end booking test
is made.

## Attribution: confirmed facts and limits

### Entry parameters survive; internal CTA URLs omit them

The README uses `utm_medium=readme`; skill links use `utm_medium=skill`.
Both use `utm_source=visual_no_slop` and `utm_campaign=human_review`.
The two skill services are distinguished by landing path, not their UTM triple.
All three CTAs point to plain `/order.html`; the browser address then has no UTM.

That alone is **not proof of broken analytics**. Metrika can associate later
actions with a visit that began on a tagged landing page. Its
[official documentation](https://yandex.ru/support/metrica/ru/general/source-tags)
says that campaign tags are taken from the first pageview of the visit.
Checking this site's reports and goal configuration requires counter access.

### Medium priority: late consent misses the tagged first pageview

Reproduction: choose necessary cookies, open a tagged landing page, follow its
CTA, then allow analytics through cookie settings on `/order.html`. The form URL
is untagged when the counter starts. In the inspected presentation route,
`document.referrer` still contained the tagged service URL, but that is not the
current pageview URL. `navigation.js` initializes Metrika with
`url: location.href` and `referrer: document.referrer`.

Neither `navigation.js`, `analytics.js` nor `order.js` captures the entry UTM
triple for later use. The custom analytics storage records page type and article
history, not these campaign values. Based on this observed initialization and
Metrika's documented first-pageview rule, late consent cannot be relied on to
populate the standard UTM visit report. The exact report classification and
frequency of this case were not measured. Refusal of analytics consent itself
is an expected measurement limit, not a defect to bypass.

### Medium priority: enquiry-level attribution is not explicit

The live form and `order.js` have no campaign, landing-page or selected-service
field in their FormData. The hidden fields are `consent_version`, `csrf_token`
and `request_id`; no UTM field is appended by the submit handler. All three
routes use the same generic form heading, and the service choice is not
prefilled. The handler's POST URL is also untagged.

This proves the absence of explicit attribution in the browser's enquiry
payload. It does **not** prove that the unseen PHP backend, server session or
logs cannot reconstruct an origin. No source access to that backend or enquiry
records was available. The site needs that check before claiming per-enquiry
channel attribution or paid-customer conversion.

### Useful measurement already present

The served code defines `service_view`, `order_form_view`, `order_form_start`,
`order_submit_attempt`, `order_form_error` and `order_success`. These require
analytics consent. `order_success` follows server acceptance, not a mere button
click. There is no reason to replace these events without checking the counter.
The presence of code does not establish that matching goals are configured,
events arrive, or accepted enquiries become paying customers.

## Minimal changes and acceptance criteria

1. **Repository, proposed in this PR:** keep the general Meatlook link and add
   the two direct service links in README with `utm_medium=readme`. Preserve
   the existing source/campaign values, disclose the landing-page language and
   add this dated validation record. No price, urgency or new skill offer is added.
2. **Meatlook source project, pending access:** carry a bounded, allowlisted
   entry campaign and landing/service identifier to the form, and persist them
   with the accepted enquiry on the server. Choose the implementation after
   inspecting existing sessions and storage. Respect the site's consent choices;
   do not start Metrika early or retain analytics identifiers after refusal.
   Do not copy arbitrary query parameters, client materials or personal data into
   analytics. A dedicated internal entry identifier can preserve the route
   without re-tagging every internal link as a new campaign.
3. **Late consent:** retain permitted entry context through navigation and attach
   it as an explicitly named, consent-gated analytics parameter when analytics
   starts. Do not label that custom parameter as repaired historical UTM data.
   If standard UTM reports are required, validate the counter's supported
   initialization behavior separately. The solution must cover entry consent,
   late consent, refusal, later untagged navigation and both service paths.
4. **Verification in the original project:** use its test/staging mechanism to
   intercept submissions and assert form payload, server persistence and success/
   error behavior without creating production leads or sending notifications.
   Verify missing/invalid campaign values and service identifiers are rejected
   or treated as unknown. In the live counter, check existing goals against
   actual traffic; no synthetic live enquiry is needed.

For channel reporting, separate tagged visits, form starts, accepted enquiries
and paid reviews. Compare README and skill traffic by medium; split the two
skill routes by entry page. Analytics opt-outs, blocked scripts and later visits
limit coverage. Downloads/installs, offer impressions and paid conversions are
not measured by this check. Do not make a network request merely to record that
the skill showed an offer.

## Scope and provenance

The connected repository permits changes and had no open PR when checked. The
Meatlook source project was not located in accessible GitHub repositories, Sites
or saved-file searches. Only its public HTML and JavaScript were inspected; no
reconstructed project was deployed. No production site change was made.

The proposal changes only README, VALIDATION and this record. All installed
skill files, including `human-review.md`, remain byte-identical to the baseline.
Research/producer files, current signals, version metadata, release tag and
published archives are unchanged. The restrictions on relevance, once-per-
conversation mentions, refusals, complete delivery and keeping offers out of
artifacts remain intact.

Public script snapshots inspected (SHA-256):

| Script URL | SHA-256 |
|---|---|
| `https://meatlook.ru/analytics.js?v=analytics-20261018-v2` | `ee38f4fbfd9914fc40aa38d681c696e73baff3831c39f83008ab9c2f4344672a` |
| `https://meatlook.ru/navigation.js?v=analytics-20261017-v1` | `a03c727edf276f494fc50b4e71483cfd1f6bb11857d82b97cf2887bdaf039059` |
| `https://meatlook.ru/order.js?v=analytics-20261018-v2` | `5f9c4803d94331fb6c761738f55b609be4e72e61b5b41d68858484134eeb447e` |
