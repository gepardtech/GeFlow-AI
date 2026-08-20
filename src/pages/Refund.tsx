import LegalPage from "@/components/LegalPage";

const Refund = () => (
  <LegalPage
    title="Refund Policy"
    lastUpdated="April 17, 2026"
    sections={[
      {
        id: "intro",
        title: "Introduction",
        body: (
          <>
            <p>This Refund Policy explains the conditions under which GeFlow ("we," "our," or "us"), operated by Gepard Tech, will issue refunds for subscription fees and one-time payments collected through the GeFlow business operating system (the "Service"). We have written this Policy to be transparent, fair, and aligned with consumer-protection laws in the jurisdictions where our customers operate.</p>
            <p>By subscribing to any paid plan or completing a one-time purchase, you acknowledge that you have read, understood, and agreed to the terms of this Refund Policy in addition to our Terms of Service and Privacy Policy. If you do not agree with any portion of this Refund Policy, please do not subscribe and instead continue using our generous Free plan, which has no associated charges.</p>
            <p>Our refund philosophy is rooted in fairness: we want every customer to be confident that GeFlow will deliver tangible operational value. That is why we offer a 14-day unconditional money-back guarantee on all monthly and annual paid subscriptions, a 30-day evaluation window on Lifetime plans, and prorated refunds for service-level failures attributable to GeFlow. The detailed terms below explain exactly when and how refunds are processed.</p>
          </>
        ),
      },
      {
        id: "subscriptions",
        title: "Subscription Refund Eligibility",
        body: (
          <>
            <p><strong className="text-foreground">14-Day Money-Back Guarantee.</strong> All Standard and Premium monthly and annual subscriptions include an unconditional 14-day money-back guarantee starting from the date of your initial paid charge. If, for any reason or no reason at all, GeFlow does not meet your expectations within the first 14 days, contact billing@geflowai.com and we will issue a full refund of your initial subscription payment within 5 to 10 business days. No justification is required and no questions will be asked.</p>
            <p><strong className="text-foreground">Annual Subscription Cancellations.</strong> If you cancel an annual subscription after the 14-day guarantee window but within the first 90 days of the annual term, you may request a prorated refund equal to the value of unused months minus a 15% administrative and processing fee. Cancellations after 90 days will end auto-renewal but no refund will be issued for the remaining term; you will retain access to all paid features until the end of your current billing cycle.</p>
            <p><strong className="text-foreground">Monthly Subscription Cancellations.</strong> Monthly subscriptions can be cancelled at any time. Cancellations made after the 14-day guarantee window are not eligible for a refund of the current monthly charge, but you will not be charged again and you will retain access to all paid features until the end of your current billing month.</p>
            <p><strong className="text-foreground">Plan Downgrades.</strong> If you downgrade from a higher-tier plan (e.g., Premium to Standard), the unused portion of the current billing cycle on the higher tier will be credited to your account and applied automatically toward future invoices. Downgrade credits do not expire and are not refundable in cash.</p>
          </>
        ),
      },
      {
        id: "lifetime",
        title: "Lifetime Plan Refunds",
        body: (
          <>
            <p>Lifetime plans represent a substantial one-time investment, and we want every Lifetime customer to be confident in their decision before that purchase becomes final.</p>
            <p><strong className="text-foreground">30-Day Evaluation Window.</strong> All Lifetime plan purchases include an unconditional 30-day evaluation window. Within these 30 days, you may request a full refund for any reason by emailing billing@geflowai.com. Refunds will be processed within 5 to 10 business days using the original payment method.</p>
            <p><strong className="text-foreground">After 30 Days.</strong> Lifetime purchases are non-refundable after the 30-day evaluation window has expired, except where required by applicable consumer-protection law in your jurisdiction. We have intentionally designed Lifetime plans with this longer evaluation window precisely so that customers have ample opportunity to confirm fit before the purchase becomes irrevocable.</p>
            <p><strong className="text-foreground">Lifetime Transfers.</strong> Lifetime entitlements are tied to the original purchaser's email and may not be transferred, sold, or assigned to third parties without our prior written consent. Requests for transfer (for example, due to business sale or restructuring) will be evaluated case-by-case and a small administrative fee may apply.</p>
          </>
        ),
      },
      {
        id: "non-refundable",
        title: "Non-Refundable Items",
        body: (
          <>
            <p>The following items are not eligible for refund under any circumstance:</p>
            <p><strong className="text-foreground">Add-on services and overages</strong> — including SMS notification credits, additional storage above plan limits, premium support hours, and one-time professional-services engagements such as data migrations or custom integrations — are non-refundable once delivered or consumed.</p>
            <p><strong className="text-foreground">Third-party fees</strong> — including credit-card processing fees retained by Stripe or Paddle, currency-conversion fees applied by your bank, and taxes or VAT remitted to government authorities — cannot be refunded by GeFlow because we do not retain those amounts.</p>
            <p><strong className="text-foreground">Subscriptions terminated for breach</strong> of our Terms of Service, including but not limited to fraudulent activity, chargeback abuse, harassment of staff, attempts to circumvent rate limits, or use of the Service for illegal purposes, are non-refundable. Suspended accounts forfeit all paid balances.</p>
            <p><strong className="text-foreground">Promotional or discounted purchases</strong> made under a non-refundable promotion (clearly labeled as such at the point of sale) are non-refundable in cash but may be eligible for plan downgrade credits at our discretion.</p>
          </>
        ),
      },
      {
        id: "process",
        title: "How to Request a Refund",
        body: (
          <>
            <p>To request a refund, send an email to billing@geflowai.com from the email address registered to your GeFlow workspace. Please include the following details to help us process your request quickly: the email address associated with your workspace; the workspace identifier (visible in Settings → Workspace); the invoice number(s) for which you are requesting a refund; the original payment method (card, PayPal, bank transfer); and a brief reason for the refund request (optional but appreciated, as it helps us improve).</p>
            <p>Our billing team will acknowledge your request within one business day and confirm whether the refund is eligible under this Policy. Eligible refunds are processed within 5 to 10 business days back to the original payment method. Depending on your bank or card issuer, the refund may take an additional 3 to 7 business days to appear on your statement.</p>
            <p>You may also cancel your subscription at any time without contacting support by visiting Settings → Billing → Manage Subscription. Cancellation immediately stops future charges; refund eligibility for the most recent charge is determined according to the rules in the Subscription Refund Eligibility section above.</p>
          </>
        ),
      },
      {
        id: "sla",
        title: "Service Credits and SLA Refunds",
        body: (
          <>
            <p>GeFlow Premium and Lifetime Premium customers are covered by our 99.9% uptime Service Level Agreement (SLA). If our monthly uptime falls below the SLA threshold due to causes within our reasonable control, you are entitled to service credits according to the following schedule: 99.0% to 99.89% uptime entitles you to a 10% service credit; 95.0% to 98.99% uptime entitles you to a 25% service credit; below 95.0% uptime entitles you to a 50% service credit applied to your next invoice.</p>
            <p>Service credits do not apply to downtime caused by factors outside our reasonable control, including but not limited to: scheduled maintenance announced at least 72 hours in advance; force majeure events; failures of upstream providers; failures of customer-controlled integrations or networks; or actions of the customer or its agents that cause service degradation.</p>
            <p>To claim a service credit, contact billing@geflowai.com within 30 days of the affected billing period. Credits are applied automatically to your next invoice and do not expire while your subscription remains active.</p>
          </>
        ),
      },
      {
        id: "chargebacks",
        title: "Chargebacks and Disputes",
        body: (
          <>
            <p>If you have a billing concern, please contact us at billing@geflowai.com before initiating a chargeback or payment dispute with your card issuer. We resolve the vast majority of billing inquiries within one business day, often faster than a chargeback can be processed.</p>
            <p>Initiating a chargeback for a charge that is valid under this Refund Policy and our Terms of Service may result in immediate suspension of your workspace pending dispute resolution. Repeated or fraudulent chargebacks will result in permanent termination of your account and forfeiture of all data and paid balances.</p>
            <p>We carefully document evidence for every chargeback dispute, including IP logs, login timestamps, feature-usage records, and email correspondence. Our chargeback win-rate exceeds 92%, but we always prefer to resolve concerns directly through honest conversation rather than through dispute mechanisms.</p>
          </>
        ),
      },
      {
        id: "changes",
        title: "Changes to This Refund Policy",
        body: (
          <>
            <p>We reserve the right to modify this Refund Policy at any time. Material changes — those that meaningfully reduce your refund rights — will be communicated by email at least 30 days before they take effect, and the "Last Updated" date at the top of this page will be revised accordingly.</p>
            <p>Changes never apply retroactively: subscriptions purchased before a Policy revision continue to be governed by the terms in force at the time of purchase. This applies to both monthly, annual, and Lifetime plans.</p>
            <p>If you have any questions about this Refund Policy or wish to request a refund, please contact billing@geflowai.com. Our team is available Monday through Friday, 9:00 AM to 8:00 PM (UTC), and we typically respond within one business day.</p>
          </>
        ),
      },
    ]}
  />
);

export default Refund;
