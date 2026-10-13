import Link from "next/link";
import type { PolicyDocument } from "@/components/legal/policy-document";
import { getPublicOperator } from "./operator";

function ContactLink() {
  return <Link href="/contact">Contact &amp; Data Requests</Link>;
}

export function getPolicyDocument(slug: string): PolicyDocument | null {
  const operator = getPublicOperator();
  const documents: Record<string, PolicyDocument> = {
    privacy: {
      title: "Privacy Policy",
      description:
        "How ApplyOS collects, uses, stores, and protects information when you use the service.",
      summary:
        "Your workspace is associated with your account and is not published to other users. ApplyOS processes workspace content, uses service providers, and records account activity. The operator can access information through privileged systems to operate and support the service.",
      sections: [
        {
          id: "scope",
          title: "Who this policy covers",
          content: (
            <>
              <p>
                This policy applies to the ApplyOS website, account services, job-search workspace,
                and optional AI features. ApplyOS is operated by {operator.name}
                {operator.location ? `, based in ${operator.location}` : ""}. References to
                “ApplyOS,” “we,” “us,” and “our” refer to that operator.
              </p>
              <p>
                Employer websites and other services you visit through links have their own privacy
                practices. ApplyOS does not control those websites.
              </p>
            </>
          ),
        },
        {
          id: "information",
          title: "Information we collect",
          content: (
            <>
              <ul>
                <li>
                  <strong>Account information:</strong> your email address, name, account
                  identifier, authentication information, sign-in records, and profile preferences.
                  Authentication is handled by Supabase.
                </li>
                <li>
                  <strong>Workspace content:</strong> applications, company and contact information,
                  outreach records, interviews, notes, follow-up dates, resume files and metadata,
                  job descriptions, and any optional education, graduation, work authorization, or
                  immigration timeline information you enter.
                </li>
                <li>
                  <strong>AI processing records:</strong> submitted job descriptions, source URLs,
                  target-role preferences, extracted results, cached results, request timestamps,
                  model identifiers, status, token usage, latency, and estimated processing costs.
                  Input and results may be stored even if you do not save an application or a parse
                  fails.
                </li>
                <li>
                  <strong>Activity and connection information:</strong> account and tab identifiers,
                  visited page sections, visit and action timestamps, tab visibility and focus,
                  recent interaction time, estimated foreground time, and download/export activity,
                  including file names. Where supplied by the hosting service, we also receive IP
                  addresses, approximate IP-based location, and browser/device information.
                </li>
                <li>
                  <strong>Support and security information:</strong> requests you send us, account
                  access restrictions, and records of administrative actions.
                </li>
              </ul>
              <p>
                Interaction tracking records timing and page sections; the heartbeat feature does
                not capture the characters you type or create screen recordings. Approximate
                location is derived from network information, not your device’s precise location
                permission. Activity records indicate use of an account or connection, not proof of
                a particular person’s identity.
              </p>
            </>
          ),
        },
        {
          id: "purposes",
          title: "How we use information",
          content: (
            <>
              <p>
                We use information to authenticate users, maintain accounts, store and display
                workspace records, provide requested uploads and downloads, generate exports,
                extract job details, organize follow-ups, deliver support, investigate service
                issues, measure service use, enforce limits, protect accounts, prevent abuse, and
                comply with applicable obligations.
              </p>
              <p>
                Where data protection law requires a lawful basis, processing needed to provide
                requested account features is based on performance of our agreement with you.
                Security, abuse prevention, and service administration may rely on legitimate
                interests, subject to applicable rights. Legal requirements may provide a separate
                basis. Where a feature requires consent under applicable law, we must obtain it
                separately; acknowledging this policy is not blanket consent to unrelated
                processing.
              </p>
            </>
          ),
        },
        {
          id: "access",
          title: "Access and sharing",
          content: (
            <>
              <p>
                Other ordinary users cannot browse your workspace through their accounts. The
                operator and authorized service personnel can access account information, activity
                records, workspace content, parser records, and stored files through privileged
                systems for service operation, support, security, and handling your requests. This
                is an account-based service; it does not provide end-to-end encryption that prevents
                operator access.
              </p>
              <p>We use providers to deliver the service:</p>
              <ul>
                <li>
                  <strong>Supabase:</strong> account authentication and database storage.
                </li>
                <li>
                  <strong>Backblaze B2:</strong> uploaded resume file storage and file delivery.
                </li>
                <li>
                  <strong>Vercel:</strong> website hosting, request delivery, and hosting-related
                  connection or diagnostic information.
                </li>
                <li>
                  <strong>OpenAI:</strong> job description processing when you choose the optional
                  AI parser. See the <Link href="/ai-policy">AI Disclosure</Link>.
                </li>
              </ul>
              <p>
                These providers process information under their applicable service arrangements. We
                may disclose information when legally required, to investigate misuse or protect
                rights and safety, or as part of a lawful service transfer subject to applicable
                notice and safeguards. ApplyOS does not currently sell personal information or use
                workspace content for targeted advertising.
              </p>
              <p>
                Adding an application or setting its status to “Applied” does not transmit it to an
                employer. You control files and exports you download and any information you share
                outside ApplyOS.
              </p>
            </>
          ),
        },
        {
          id: "retention",
          title: "Storage, retention, and deletion",
          content: (
            <>
              <p>
                Workspace records and resume files are retained while associated with your account
                unless you delete them or your account is removed. Archiving a record, signing out,
                or closing a tab does not delete stored information. Deleting an application does
                not automatically delete a separately uploaded resume or its earlier AI processing
                records.
              </p>
              <p>
                The current service has no automatic age-based deletion schedule for parser inputs,
                results, caches, usage records, activity history, or tab-state records. These remain
                until account deletion or applicable manual removal. An offline indicator is not a
                deletion event. You can request removal or further retention information through{" "}
                <ContactLink />.
              </p>
              <p>
                Account deletion removes the account and associated application records from active
                systems and includes stored-file cleanup. Limited administrative audit records may
                survive account deletion, and copies in provider backups or logs follow the relevant
                provider’s retention process. Information subject to a legal preservation
                requirement may be retained for that requirement. We do not promise immediate
                erasure from every backup or external system.
              </p>
            </>
          ),
        },
        {
          id: "choices",
          title: "Your choices and rights",
          content: (
            <>
              <p>
                You can edit profile and workspace records, export supported workspace tables to CSV
                or Excel, download your uploaded resumes, and delete records or files using
                available controls. Workspace exports are not a complete personal-data access
                report: security logs, activity history, and some parser records are not included in
                those exports.
              </p>
              <p>
                You may request access, correction, account deletion, or information about
                processing through <ContactLink />. Depending on your location and applicable law,
                you may also have rights to portability, restriction, objection, withdrawal of
                consent where used, or a complaint to a data protection authority. We will verify
                requests using information proportionate to the request and respond within
                applicable legal requirements. Some rights have lawful exceptions; we will explain
                relevant limitations.
              </p>
              <p>
                Account deletion is handled by the operator; there is currently no self-service
                account deletion button. You can choose manual job entry instead of the optional AI
                parser. Browser storage choices are described in the{" "}
                <Link href="/cookies">Cookie &amp; Storage Notice</Link>.
              </p>
            </>
          ),
        },
        {
          id: "security-transfers",
          title: "Security and international processing",
          content: (
            <>
              <p>
                ApplyOS uses account authentication, database access controls, server-side ownership
                checks, and short-lived file access links to protect information. No online service
                can guarantee complete security. Keep your password and downloaded files secure, and
                do not share signed file links.
              </p>
              <p>
                Providers may process information outside your country. The applicable protections
                and transfer requirements depend on your location and the provider arrangement.
                Contact us for information about the arrangements relevant to your account; this
                policy does not assert a particular data residency, certification, or international
                transfer mechanism.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Age requirements",
          content: (
            <p>
              ApplyOS is intended for people aged 18 or older. Do not create an account or submit
              personal information if you are under 18. If you believe a minor has provided
              information, contact us so we can investigate and handle removal as required.
            </p>
          ),
        },
        {
          id: "updates",
          title: "Updates and contact",
          content: (
            <p>
              We may revise this policy as the service or its processing changes. The date and
              version identify the current text. Material changes will be communicated through an
              appropriate service notice or account communication before they take effect where
              required. For questions and requests, use <ContactLink />.
            </p>
          ),
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      description: "The terms that govern your access to ApplyOS and use of its job-search tools.",
      summary:
        "ApplyOS helps you organize your own job search. You retain ownership of your content, must use the service responsibly, and should review AI-generated fields and important deadlines. The service does not submit job applications or guarantee employment outcomes.",
      sections: [
        {
          id: "agreement",
          title: "Your agreement with ApplyOS",
          content: (
            <>
              <p>
                These Terms are an agreement between you and {operator.name}, the operator of
                ApplyOS. They include the <Link href="/acceptable-use">Acceptable Use Policy</Link>.
                The <Link href="/privacy">Privacy Policy</Link>,{" "}
                <Link href="/cookies">Cookie &amp; Storage Notice</Link>, and{" "}
                <Link href="/ai-policy">AI Disclosure</Link> explain related practices.
              </p>
              <p>
                By creating an account and accepting these Terms, you agree to follow them. You must
                be at least 18 years old and legally able to enter the agreement. If you act for an
                organization, you must have authority to do so. If you do not agree, do not create
                an account or use the service.
              </p>
            </>
          ),
        },
        {
          id: "accounts",
          title: "Accounts and responsibilities",
          content: (
            <>
              <p>
                Provide accurate account information, protect your credentials, and use only
                accounts you are authorized to access. Tell us promptly if you suspect unauthorized
                access. You are responsible for your authorized use and the content you submit,
                subject to rights that cannot be excluded by law.
              </p>
              <p>
                Keep copies of important records and files. You are responsible for reviewing your
                entries, confirming dates with employers, and complying with any employer’s
                application process. A record marked “Applied” reflects information entered into
                ApplyOS and does not confirm an external submission.
              </p>
            </>
          ),
        },
        {
          id: "service",
          title: "What the service provides",
          content: (
            <>
              <p>
                ApplyOS provides tools for tracking applications, contacts, outreach, resumes,
                interviews, follow-ups, timelines, exports, and optional AI-assisted extraction.
                Availability, storage limits, AI access, and usage limits may vary by account and
                may change to protect service capacity and security.
              </p>
              <p>
                ApplyOS is not an employer, recruiting agency, or government authority. It does not
                guarantee a job, interview, salary, visa, sponsorship, eligibility decision, or
                response from an employer. Immigration timeline information and career or financial
                information are general organizational aids and do not replace advice from a
                qualified professional or official source.
              </p>
              <p>
                The current application does not collect subscription payments. If paid services are
                introduced, pricing, billing authorization, cancellation, and applicable refund
                terms will be presented before purchase. These Terms do not authorize undisclosed
                charges.
              </p>
            </>
          ),
        },
        {
          id: "content",
          title: "Your content and our permission to process it",
          content: (
            <>
              <p>
                You retain ownership of content you submit. You grant ApplyOS the limited permission
                needed to host, store, copy, process, display to you, and transmit that content to
                service providers to operate requested features, support your account, and secure
                the service. This permission does not transfer ownership or authorize sale of your
                content.
              </p>
              <p>
                Only submit information and files you are entitled to use. Obtain any necessary
                permission before storing other people’s contact details, correspondence, or
                confidential information. Avoid unnecessary sensitive information such as government
                identification numbers, financial account credentials, or medical records.
              </p>
              <p>
                Your use of AI features is subject to the{" "}
                <Link href="/ai-policy">AI Disclosure</Link>. Review extracted results before saving
                or relying on them.
              </p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use and intellectual property",
          content: (
            <>
              <p>
                Follow the <Link href="/acceptable-use">Acceptable Use Policy</Link>. Do not access
                another user’s information, bypass service controls, upload malicious files,
                impersonate someone, or use the service unlawfully.
              </p>
              <p>
                ApplyOS software, design, and branding belong to their respective rights holders.
                Subject to these Terms, you may use the service for its intended purposes. These
                Terms do not grant ownership of ApplyOS or rights to use its branding to imply
                endorsement. Third-party job postings and materials remain subject to their rights
                holders’ terms.
              </p>
            </>
          ),
        },
        {
          id: "availability",
          title: "Availability and changes",
          content: (
            <>
              <p>
                We may update, maintain, limit, or discontinue features. Outages, errors, delayed
                notifications, and incomplete processing can occur. We will provide reasonable
                notice of material changes where practicable or required. Maintain your own copies
                of important records and confirm critical deadlines independently.
              </p>
              <p>
                External links, employers, and providers are outside ApplyOS’s control. Their
                services may have separate terms and may change or become unavailable.
              </p>
            </>
          ),
        },
        {
          id: "termination",
          title: "Suspension, termination, and leaving",
          content: (
            <>
              <p>
                We may restrict access when reasonably necessary to address security risks, misuse,
                unlawful activity, material breaches, or service operation requirements. Where
                appropriate, we will explain the restriction and provide an opportunity to contact
                us; urgent security or legal circumstances may require immediate action.
              </p>
              <p>
                You may stop using the service at any time and request account deletion through{" "}
                <ContactLink />. Export needed records and download files before requesting
                deletion. Retention and deletion limitations are described in the Privacy Policy.
                Provisions needed to address outstanding obligations and lawful disputes survive
                termination as applicable.
              </p>
            </>
          ),
        },
        {
          id: "warranties",
          title: "Disclaimers and legal limits",
          content: (
            <>
              <p>
                To the extent permitted by applicable law, the service is provided “as is” and “as
                available.” We do not warrant uninterrupted availability, error-free results, or
                suitability for every purpose. AI outputs, matching scores, deadlines, and reminders
                may be incomplete or inaccurate.
              </p>
              <p>
                To the extent permitted by applicable law, ApplyOS is not responsible for indirect
                or consequential losses, lost opportunities, or employment outcomes arising from use
                of the service. Nothing in these Terms excludes mandatory consumer protections or
                responsibility that cannot lawfully be excluded, including applicable responsibility
                for fraud, intentional misconduct, or other protected claims.
              </p>
            </>
          ),
        },
        {
          id: "disputes",
          title: "Questions, disputes, and updates",
          content: (
            <>
              <p>
                Contact us through <ContactLink /> to raise a concern or seek an informal
                resolution. Any applicable mandatory consumer law, jurisdictional rights, and access
                to competent courts remain in effect. These Terms do not impose compulsory
                arbitration or waive rights that cannot lawfully be waived.
              </p>
              <p>
                We may revise these Terms. The published date and version identify the current text,
                and we will provide notice of material changes and seek renewed agreement where
                required. If a provision is unenforceable, the remainder continues to apply to the
                extent allowed by law.
              </p>
            </>
          ),
        },
      ],
    },
    cookies: {
      title: "Cookie & Storage Notice",
      description:
        "How ApplyOS uses cookies and browser storage to maintain sessions and remember preferences.",
      summary:
        "ApplyOS uses sign-in cookies and local browser preferences. The current application has no advertising cookies, tracking pixels, or third-party marketing analytics integration. Account activity is recorded separately as described in the Privacy Policy.",
      sections: [
        {
          id: "session",
          title: "Authentication cookies",
          content: (
            <p>
              Supabase authentication uses cookies associated with this site to maintain and refresh
              your signed-in session. Their names can vary by project and may be split into multiple
              cookie entries. Their duration depends on session and authentication configuration.
              Signing out clears the app’s authentication session; it does not delete account
              records. Blocking these cookies may prevent sign-in and protected features from
              working.
            </p>
          ),
        },
        {
          id: "preferences",
          title: "Browser preferences",
          content: (
            <p>
              ApplyOS stores your theme preference in local storage under <code>theme</code> and
              your sidebar preference under <code>applyos-sidebar-collapsed</code>. These remain in
              that browser until changed or cleared. Clearing them resets the preference; it does
              not delete server-side workspace data. The activity feature uses an in-memory tab
              identifier that is recreated when the component mounts rather than a persistent
              advertising identifier.
            </p>
          ),
        },
        {
          id: "activity",
          title: "Activity records and service providers",
          content: (
            <p>
              Signed-in page-section activity, interaction timing, connection information, and
              service actions are recorded on the server as explained in the{" "}
              <Link href="/privacy">Privacy Policy</Link>. These records are separate from browser
              preference storage. Hosting and authentication providers may process network requests
              and security information needed to deliver their services.
            </p>
          ),
        },
        {
          id: "controls",
          title: "Your controls",
          content: (
            <>
              <p>
                You can use your browser settings to view, block, or delete cookies and local
                storage. On shared devices, sign out and remove downloaded files before leaving.
                Browser controls and privacy signals do not automatically erase information already
                stored in your account; use <ContactLink /> for requests concerning that
                information.
              </p>
              <p>
                The current app does not include a nonessential marketing-cookie consent banner
                because it has no marketing-cookie integration. If nonessential tracking is
                introduced, this notice and the consent controls must be updated before enabling it
                where required.
              </p>
            </>
          ),
        },
      ],
    },
    "acceptable-use": {
      title: "Acceptable Use Policy",
      description:
        "Rules for using ApplyOS safely, lawfully, and with respect for other users and third parties.",
      summary:
        "Use ApplyOS for legitimate job-search organization. Respect other people’s information, service limits, and the rights of employers and content owners.",
      sections: [
        {
          id: "permitted",
          title: "Appropriate use",
          content: (
            <p>
              Use the service to manage job-search information you are entitled to store and
              process. Keep account and application records accurate, use AI results as drafts for
              review, and follow applicable laws and the terms of any external services you use.
            </p>
          ),
        },
        {
          id: "prohibited",
          title: "Prohibited conduct",
          content: (
            <ul>
              <li>
                Accessing or attempting to access another user’s account, records, files, or
                credentials without authorization.
              </li>
              <li>
                Bypassing authentication, ownership checks, access restrictions, quotas, rate
                limits, or AI entitlements.
              </li>
              <li>
                Uploading malware, harmful executable content, unlawful materials, or files that
                misrepresent their type.
              </li>
              <li>
                Using the service for spam, harassment, threats, discrimination, impersonation,
                fraud, or exploitation.
              </li>
              <li>
                Submitting stolen, confidential, or personal information without the necessary
                rights or permissions.
              </li>
              <li>
                Disrupting the service, conducting unauthorized vulnerability testing, extracting
                secrets, or automating requests in a way that overloads the service.
              </li>
              <li>
                Misusing AI features to generate harmful content, evade safeguards, or make
                unsupported claims about another person.
              </li>
            </ul>
          ),
        },
        {
          id: "information",
          title: "Sensitive and third-party information",
          content: (
            <p>
              Limit stored contact and correspondence data to what is relevant to your job search.
              Do not upload credentials, government identification numbers, private medical records,
              or unrelated financial information. Do not use ApplyOS as a system for making
              employment or other significant decisions about other people.
            </p>
          ),
        },
        {
          id: "reports",
          title: "Reporting concerns",
          content: (
            <p>
              Report suspected account misuse, unlawful content, or vulnerabilities through{" "}
              <ContactLink />. Include only the details needed to explain the concern. Do not access
              additional private information to demonstrate an issue or publish another user’s
              records. Reporting a concern is not permission to conduct further testing.
            </p>
          ),
        },
        {
          id: "enforcement",
          title: "Enforcement",
          content: (
            <p>
              We may investigate suspected violations, remove prohibited content, restrict features,
              suspend accounts, or take further action required by law. We consider the nature and
              severity of the conduct and relevant context. You may contact the operator to ask
              about a restriction. This policy forms part of the{" "}
              <Link href="/terms">Terms of Service</Link>.
            </p>
          ),
        },
      ],
    },
    "ai-policy": {
      title: "AI Disclosure",
      description: "What happens when you use ApplyOS’s optional AI job description parser.",
      summary:
        "The AI parser sends job text and relevant parsing context to OpenAI and returns an editable draft. You can enter jobs manually instead. Always check important fields against the original posting.",
      sections: [
        {
          id: "processing",
          title: "Information processed by AI",
          content: (
            <>
              <p>
                When you request a parse, ApplyOS sends the job description, any supplied source
                URL, and target-role preferences used for that request to OpenAI, along with
                instructions for extracting fields. The parser’s current request does not attach
                your uploaded resume file or send your entire workspace.
              </p>
              <p>
                Job text can itself contain personal or confidential information. Remove anything
                you do not have permission to disclose before submitting it. The service does not
                need government identifiers, account passwords, or private medical information to
                parse a posting.
              </p>
            </>
          ),
        },
        {
          id: "storage",
          title: "Stored records and provider handling",
          content: (
            <>
              <p>
                ApplyOS stores parser input, URLs, results, caches, status, and usage information as
                described in the <Link href="/privacy">Privacy Policy</Link>. These records can
                remain after an unsaved or failed parse. Operator access and account deletion
                limitations also apply to these records.
              </p>
              <p>
                OpenAI’s{" "}
                <a
                  href="https://developers.openai.com/api/docs/guides/your-data"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  published API data controls
                </a>{" "}
                state that API data is not used for model training by default, unless the API
                customer opts in. OpenAI may retain inputs, outputs, and abuse-monitoring records
                under its endpoint rules and account settings. ApplyOS does not promise zero
                provider retention or that deleting an application immediately removes provider
                logs.
              </p>
            </>
          ),
        },
        {
          id: "review",
          title: "Human review and limitations",
          content: (
            <>
              <p>
                AI-generated fields may be wrong, incomplete, or inferred. Review compensation,
                currency and pay periods, location, employment type, experience requirements,
                recruiter information, work authorization, sponsorship, and deadlines before saving
                or acting on a result. A confidence value is a model assessment, not a guarantee of
                accuracy.
              </p>
              <p>
                Target-role priority and relevance scores are organizational suggestions. They are
                not assessments of your employability, protected characteristics, eligibility, or
                hiring chances. ApplyOS does not use these scores to make employer hiring decisions
                or automatically submit an application.
              </p>
            </>
          ),
        },
        {
          id: "choice",
          title: "Your choice and feature availability",
          content: (
            <p>
              You can create and edit applications manually without the AI parser. Access depends on
              your account’s enabled features and usage limits. Cached results may be reused for
              matching requests. Limits, models, and availability may change, and provider outages
              or rejected requests may prevent processing.
            </p>
          ),
        },
      ],
    },
    contact: {
      title: "Contact & Data Requests",
      description:
        "Contact ApplyOS about your account, privacy, data removal, or a security concern.",
      summary:
        "Use a verified account contact channel for requests about personal data. Never include passwords, access tokens, or unnecessary sensitive documents in a support request.",
      sections: [
        {
          id: "contact",
          title: "Contact the operator",
          content: (
            <>
              <p>
                ApplyOS is operated by {operator.name}
                {operator.location ? `, based in ${operator.location}` : ""}.
              </p>
              {operator.email ? (
                <p>
                  For support, privacy requests, and security reports, email{" "}
                  <a href={`mailto:${operator.email}`}>{operator.email}</a>.
                </p>
              ) : (
                <p>
                  For an existing account, use the contact channel through which you received access
                  to ApplyOS. A public support email is not currently listed.
                </p>
              )}
            </>
          ),
        },
        {
          id: "requests",
          title: "Access, correction, and deletion requests",
          content: (
            <>
              <p>
                Identify the account email address and the type of request: access, correction, data
                removal, account deletion, or another applicable privacy right. Send the request
                from your account email where possible. We may ask for proportionate verification to
                protect your information; we will not ask for your account password.
              </p>
              <p>
                Export important workspace records and download resume files before requesting
                account deletion. Export Center provides supported CSV and Excel exports; it does
                not include every security or activity record. Account deletion is handled by the
                operator and is not currently a self-service setting. See the{" "}
                <Link href="/privacy#retention">retention and deletion details</Link> for backup,
                provider, and audit-record limitations.
              </p>
            </>
          ),
        },
        {
          id: "security",
          title: "Security reports",
          content: (
            <p>
              Describe the issue, the affected feature, and the minimum steps needed to reproduce it
              without including another person’s private data. Do not continue accessing information
              you are not authorized to view. If your own account is compromised, reset your
              password and contact the operator promptly.
            </p>
          ),
        },
        {
          id: "response",
          title: "Handling your request",
          content: (
            <p>
              We review requests, verify account ownership where appropriate, and respond according
              to applicable legal requirements. We may request clarification or explain a lawful
              limitation.
            </p>
          ),
        },
      ],
    },
  };
  return Object.hasOwn(documents, slug) ? documents[slug] : null;
}
