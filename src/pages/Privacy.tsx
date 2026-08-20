import LegalPage from "@/components/LegalPage";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    lastUpdated="April 17, 2026"
    sections={[
      {
        id: "intro",
        title: "Introduction",
        body: (
          <>
            <p>GeFlow ("we," "our," or "us"), operated by Gepard Tech, is committed to protecting your privacy and the integrity of every data point that flows through our business operating system. This Privacy Policy explains in detail how we collect, use, disclose, transfer, and safeguard your information when you access the GeFlow web platform, mobile applications, point-of-sale terminals, supplier portals, embedded analytics dashboards, and any related services (collectively, the "Service").</p>
            <p>We have authored this document to be transparent and complete. Privacy at GeFlow is not a checkbox — it is an architectural commitment baked into how we design schemas, design tenancy boundaries, and review every new feature before it ships. By accessing or using the Service, you confirm that you have read, understood, and agreed to the practices outlined below. If you do not agree with any portion of this Privacy Policy, you must discontinue use of the Service immediately and may request deletion of your account at any time.</p>
            <p>This Policy applies to information collected through the Service and does not apply to information you provide to or that is collected by any third party — including platforms our customers may integrate with such as accounting software, payment processors, or shipping carriers — even where links are presented inside the GeFlow interface. We encourage you to review the privacy notices of every external system you connect to your GeFlow workspace.</p>
            <p>Because GeFlow operates across multiple jurisdictions, this Policy is designed to satisfy the requirements of the General Data Protection Regulation (GDPR) within the European Economic Area, the California Consumer Privacy Act (CCPA) and CPRA, the United Kingdom Data Protection Act, the Personal Data Protection Act (PDPA) of Singapore, and other equivalent regional frameworks. Where local law affords you stronger protections than those described here, those local protections apply.</p>
          </>
        ),
      },
      {
        id: "info",
        title: "Information We Collect",
        body: (
          <>
            <p>We collect information about you and your business in three primary categories: information you provide directly, information collected automatically as you use the Service, and information received from third-party integrations you choose to enable. Each category is described below.</p>
            <p><strong className="text-foreground">Personal Identifiers.</strong> When you register for a workspace, we collect your full name, email address, phone number, country of residence, business name, business registration number where applicable, billing address, and shipping address. If you invite teammates, we collect equivalent identifiers for each invited user once they accept the invitation.</p>
            <p><strong className="text-foreground">Authentication Data.</strong> We store hashed passwords (never plaintext) using industry-standard bcrypt or Argon2id key-derivation functions. If you enable multi-factor authentication, we store TOTP secrets in encrypted form and the device fingerprints of trusted browsers. OAuth tokens for Google, Microsoft, or Apple sign-in are stored encrypted at rest.</p>
            <p><strong className="text-foreground">Business Operational Data.</strong> The data you create and manage within GeFlow — inventory items, purchase orders, sales receipts, customer contacts, supplier contracts, batch and expiry records, financial summaries, branch hierarchies, and uploaded documents — is collected and stored to deliver the Service. This data belongs to you; we act as a processor on your behalf.</p>
            <p><strong className="text-foreground">Payment Data.</strong> When you subscribe to a paid plan, your card or wallet details are submitted directly to our PCI-DSS-certified payment processors (Stripe and Paddle). GeFlow servers never store full card numbers, CVVs, or banking credentials. We retain only the last four digits, card brand, expiry month, and tokenized reference necessary for renewal and reconciliation.</p>
            <p><strong className="text-foreground">Device and Technical Data.</strong> Our servers automatically log IP addresses, browser type and version, operating system, device identifiers, screen resolution, language preference, referring URL, pages viewed, click paths, session duration, and timestamps. These signals help us detect fraud, troubleshoot issues, and improve the Service.</p>
            <p><strong className="text-foreground">Communication Records.</strong> When you contact our support team, we retain transcripts of chats, copies of emails, and recordings of any voice calls (with your consent). These records help us train support staff and improve self-service documentation.</p>
            <p><strong className="text-foreground">Cookies and Tracking Technologies.</strong> We use first-party cookies, local storage, and similar technologies for session management, preference persistence, A/B testing, and aggregated analytics. Third-party analytics — currently limited to a self-hosted Plausible instance — collect only anonymized event-level data with no cross-site tracking.</p>
          </>
        ),
      },
      {
        id: "use",
        title: "How We Use Your Information",
        body: (
          <>
            <p>The information we collect is used strictly to operate, maintain, secure, and improve the Service, and to fulfill our contractual and legal obligations. We do not sell, rent, or trade your personal information to data brokers or advertisers under any circumstance.</p>
            <p>Specifically, we may use information for the following purposes: to create and authenticate your account; to deliver the features you have subscribed to; to process payments and issue invoices and tax receipts; to send transactional notifications such as password resets, payment confirmations, low-stock alerts, and expiry warnings; to send service announcements about scheduled maintenance, security incidents, or material changes to this Policy; to provide customer support and respond to your inquiries; to perform internal research and analytics that improve product quality, performance, and reliability; to detect, investigate, and prevent fraudulent activity, abuse, and security incidents; to enforce our Terms of Service; to comply with applicable laws, court orders, lawful subpoenas, and regulatory requests; and to defend ourselves in legal proceedings.</p>
            <p>With your explicit, opt-in consent, we may also use your contact details to send marketing communications about new features, partner offerings, and educational content. You may withdraw this consent at any moment by clicking the unsubscribe link in any marketing email or by adjusting notification preferences inside your workspace. Withdrawing marketing consent does not affect your receipt of essential transactional messages required to operate your account.</p>
            <p>Aggregated, anonymized statistics — for example, "73% of GeFlow pharmacies stock fewer than 1,200 SKUs" — may be derived from operational data and used in benchmarking reports, marketing materials, or academic research. Aggregated outputs never contain personal identifiers and cannot be reverse-engineered to re-identify any individual or business.</p>
          </>
        ),
      },
      {
        id: "sharing",
        title: "Data Sharing and Disclosure",
        body: (
          <>
            <p>We do not share your personal information with third parties except in the limited circumstances described below. In every case, recipients are contractually bound by data-protection terms at least as strict as those in this Policy.</p>
            <p><strong className="text-foreground">Service Providers.</strong> We rely on a minimal set of vetted sub-processors to deliver the Service: cloud hosting (AWS, Frankfurt and Singapore regions), database backup storage (encrypted, in the same region as your primary workspace), email delivery (Postmark for transactional, Resend for product), payment processing (Stripe, Paddle), customer-support tooling (Plain), error monitoring (Sentry, with PII scrubbing enabled), and product analytics (self-hosted Plausible). A current, complete list of sub-processors is published at geflowai.com/sub-processors and updated at least 30 days before any new processor is added.</p>
            <p><strong className="text-foreground">Business Transfers.</strong> If GeFlow is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of its assets, your information may be transferred to the successor entity. We will notify you by email and prominently on the platform at least 30 days before any change in ownership of your data, and you will retain the right to export and delete your workspace prior to transfer.</p>
            <p><strong className="text-foreground">Legal Compliance.</strong> We may disclose information when we believe in good faith that disclosure is required by law, including in response to a valid subpoena, court order, or government request. Wherever legally permitted, we will notify you in advance so you may seek a protective order. We publish an annual transparency report disclosing the aggregate number of government requests received.</p>
            <p><strong className="text-foreground">Protection of Rights.</strong> We may disclose information when necessary to enforce our Terms of Service, investigate suspected fraud or security incidents, protect the safety of users or the public, or defend against legal claims.</p>
            <p><strong className="text-foreground">With Your Consent.</strong> We may share information with additional third parties when you explicitly direct us to do so, for example by enabling an integration with a third-party accounting platform.</p>
          </>
        ),
      },
      {
        id: "security",
        title: "Data Security",
        body: (
          <>
            <p>We implement administrative, technical, and physical safeguards designed to protect your information from unauthorized access, alteration, disclosure, or destruction. Our security program is reviewed annually by an independent third-party auditor and aligns with SOC 2 Type II and ISO 27001 control frameworks.</p>
            <p>Specific safeguards include: TLS 1.3 encryption for all data in transit; AES-256 encryption for all data at rest including database storage, file uploads, and backups; isolated tenant boundaries enforced at the database row level via row-level security policies; role-based access control with the principle of least privilege applied to internal staff; mandatory hardware security keys for all engineers with production access; quarterly penetration testing performed by external red-team specialists; continuous vulnerability scanning of dependencies and container images; automated daily backups retained for 30 days with a 5-minute Recovery Point Objective and 1-hour Recovery Time Objective; intrusion detection and 24/7 security monitoring; and a documented incident-response plan tested via tabletop exercises every six months.</p>
            <p>Despite these measures, no method of transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security. In the event of a data breach affecting your personal information, we will notify you and the relevant supervisory authorities within 72 hours of discovery as required by GDPR Article 33, and within the timeframes required by other applicable laws.</p>
            <p>You also play a critical role in keeping your account safe. Choose a strong, unique password, enable multi-factor authentication, never share credentials, log out of shared devices, and notify us immediately at security@geflowai.com if you suspect any unauthorized access.</p>
          </>
        ),
      },
      {
        id: "rights",
        title: "Your Rights",
        body: (
          <>
            <p>Depending on your jurisdiction, you have certain rights regarding your personal information. GeFlow honors these rights for all users globally, regardless of where you are located.</p>
            <p><strong className="text-foreground">Right of Access.</strong> You may request a copy of the personal information we hold about you. Most data is directly accessible inside your workspace; for everything else, contact privacy@geflowai.com and we will respond within 30 days.</p>
            <p><strong className="text-foreground">Right to Rectification.</strong> You may correct inaccurate or incomplete personal information at any time through your account settings or by contacting support.</p>
            <p><strong className="text-foreground">Right to Erasure.</strong> You may request deletion of your personal information ("the right to be forgotten"). Upon receipt of a verified request, we will delete your data from production systems within 30 days and from backups within 90 days, except where retention is required by law (for example, tax and invoicing records).</p>
            <p><strong className="text-foreground">Right to Data Portability.</strong> You may export your operational data in machine-readable formats (CSV, JSON, or SQL dump) at any time from the workspace export panel.</p>
            <p><strong className="text-foreground">Right to Restrict or Object to Processing.</strong> You may ask us to limit or stop certain processing activities, including direct marketing.</p>
            <p><strong className="text-foreground">Right to Withdraw Consent.</strong> Where processing is based on consent, you may withdraw that consent at any time without affecting the lawfulness of processing performed beforehand.</p>
            <p><strong className="text-foreground">Right to Lodge a Complaint.</strong> You may file a complaint with your local data-protection authority. We would, however, appreciate the opportunity to address your concerns directly first.</p>
            <p>To exercise any of these rights, email privacy@geflowai.com. We may need to verify your identity before fulfilling the request to protect your data from unauthorized disclosure.</p>
          </>
        ),
      },
      {
        id: "changes",
        title: "Changes to This Policy",
        body: (
          <>
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal obligations, or for other operational reasons. When we make material changes, we will notify you by email at least 30 days before the changes take effect, and we will update the "Last Updated" date at the top of this page.</p>
            <p>Continued use of the Service after the effective date of any updated Policy constitutes acceptance of the revised terms. If you do not agree with the updated terms, you must discontinue use of the Service and may request deletion of your account.</p>
            <p>Historical versions of this Policy are archived and available upon request at privacy@geflowai.com. We encourage you to review this Policy periodically — at a minimum, every six months — to remain informed about how we are protecting your information.</p>
            <p>If you have any questions, comments, or concerns about this Privacy Policy or our data-handling practices, please contact our Data Protection Officer at privacy@geflowai.com or by postal mail at: GeFlow / Gepard Tech, Attn: Data Protection Officer, 1 Innovation Plaza, Suite 400.</p>
          </>
        ),
      },
    ]}
  />
);

export default Privacy;
