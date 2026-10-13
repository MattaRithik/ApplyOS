# ApplyOS legal pages

Prepared October 13, 2026. The public pages are `/legal`, `/privacy`, `/terms`, `/cookies`, `/acceptable-use`, `/ai-policy`, and `/contact`. Anonymous users can read these exact paths. Protected pages and APIs remain authenticated.

The language uses the ApplyOS brand and neutral service descriptions. It makes no claim that monitoring is temporary or for testing, that only users can access their records, that exports contain every personal-data record, or that a 24-hour telemetry cleanup exists. The current code does not enforce such cleanup. Parser context persists even for failed or unsaved attempts. Operator access through privileged systems is disclosed.

## Public operator details

Optional server environment variables populate the legal/contact pages at request time:

```dotenv
APP_PUBLIC_OPERATOR_NAME=
APP_PUBLIC_OPERATOR_LOCATION=
APP_PUBLIC_CONTACT_EMAIL=
```

Leave these empty while preparing the release if the public identity/contact channel has not been chosen. The app uses generic operator wording and honestly states that no public contact email is published. It never copies `APP_OWNER_EMAIL` into a public page. Before announcing open registration, provide an accurate operator identity and monitored contact channel; generic wording alone does not fulfill location-specific identification requirements. No fake address, company registration, jurisdiction, or email has been added.

## Entry points and acknowledgment

The landing footer, auth pages, Settings → Account, and Legal Center link the policies. The parser displays a short notice before submission. The signup form requires an unchecked terms/age acknowledgment and links the Terms, Acceptable Use Policy, and Privacy Policy. Age eligibility is 18+; no birth date is collected.

Successful signups submit the policy version and client timestamp as Supabase user metadata. This is a UI acknowledgment record, **not an immutable acceptance ledger**: user metadata is mutable and clients can bypass the signup UI. Direct Supabase registration and future OAuth entry points need a server-enforced, durable acceptance design before claiming universal enforcement. Existing accounts are not silently marked as having accepted new terms.

## Operational decisions before release

- Ensure privacy/account-deletion requests reach someone who can verify and handle them. The contact page does not submit requests, send email automatically, or guarantee a response deadline beyond applicable requirements.
- Current telemetry and AI context have no automatic age-based expiration. Approve retention criteria and implement deletion if introducing fixed periods; change the policy at the same time. Archiving, signing out, deleting an application, and account deletion have different effects.
- Operator-assisted account deletion includes B2 cleanup and database cascades. Audit records and provider backups/logs may remain. Verify hosted backup retention and legal preservation rules; do not claim universal instant erasure.
- Confirm provider regions, data-processing arrangements, international transfer requirements, and OpenAI project data-sharing settings. The pages do not assert GDPR certification, a particular transfer mechanism, end-to-end encryption, or zero provider retention.
- Obtain jurisdiction-specific review of operator identification, consumer terms, liability provisions, age requirements, applicable privacy bases/rights, and any additional notices or representatives required for the intended markets. Generic published text is not a certification of compliance.
- If nonessential tracking, paid plans, Google/GitHub login, or additional data uses are introduced, update the relevant disclosures and consent/account flow first.

## Drafting references

Disclosures were grounded in the app's code and checked against the [FTC's privacy guidance](https://www.ftc.gov/business-guidance/privacy-security), the [ICO's right-to-be-informed guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/), and [OpenAI's API data controls](https://developers.openai.com/api/docs/guides/your-data). Provider defaults do not establish the operator's actual hosted configuration.
