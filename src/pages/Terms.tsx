import LegalPage from "@/components/LegalPage";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    lastUpdated="April 17, 2026"
    sections={[
      {
        id: "agreement",
        title: "Agreement to Terms",
        body: (
          <>
            <p>These Terms of Service ("Terms") constitute a legally binding agreement between you (whether an individual or an entity, the "Customer" or "you") and GeFlow, a product operated by Gepard Tech ("GeFlow," "we," "our," or "us"), governing your access to and use of the GeFlow business operating system, including the web application, mobile applications, point-of-sale terminals, supplier portals, embedded analytics dashboards, application programming interfaces, and all related services (collectively, the "Service").</p>
            <p>By creating a workspace, signing in, or otherwise accessing the Service in any manner, you confirm that you have read, understood, and agreed to be bound by these Terms, our Privacy Policy, our Refund Policy, and our Acceptable Use Policy, each of which is incorporated by reference. If you are accepting these Terms on behalf of a company or other legal entity, you represent and warrant that you have full authority to bind that entity, in which case "you" refers to that entity.</p>
            <p>If you do not agree with any portion of these Terms, you must not access or use the Service. We reserve the right to suspend, restrict, or terminate any account whose owner does not accept these Terms in their entirety.</p>
          </>
        ),
      },
      {
        id: "eligibility",
        title: "Eligibility and Account Registration",
        body: (
          <>
            <p>You must be at least 18 years of age, or the age of majority in your jurisdiction (whichever is greater), to register for a GeFlow workspace. By creating an account, you represent and warrant that you meet this age requirement, that you have the legal capacity to enter into a binding contract, and that you are not barred from using the Service under any applicable law or regulation.</p>
            <p>When registering, you agree to provide accurate, current, and complete information about yourself and your business, and to keep that information current throughout the lifetime of your account. You are solely responsible for safeguarding your credentials and for all activity that occurs under your account, whether or not authorized by you. You agree to notify us immediately at security@geflow.io of any unauthorized access, suspected breach, or other security concern.</p>
            <p>One natural person may operate multiple workspaces. Sharing a single set of credentials among multiple natural persons is prohibited; each individual user must register their own account. We reserve the right to require additional verification — including government-issued identification or business registration documents — at any time to confirm the legitimacy of an account, particularly in connection with high-value transactions, suspected fraud, or compliance investigations.</p>
          </>
        ),
      },
      {
        id: "subscriptions",
        title: "Subscriptions, Billing, and Renewal",
        body: (
          <>
            <p>The Service is offered on a freemium model. The Free plan is available indefinitely at no cost and includes the feature set described on our pricing page at the time of registration. Paid plans (Standard, Premium, and Lifetime variants) unlock additional features, capacity, and support, and are billed in advance on a monthly, annual, or one-time basis as selected at checkout.</p>
            <p><strong className="text-foreground">Automatic Renewal.</strong> Monthly and annual subscriptions automatically renew at the end of each billing period at the then-current rate, unless you cancel before the renewal date. We will email a renewal notice 30 days before each annual renewal and 7 days before each monthly renewal. By subscribing, you authorize us to charge your selected payment method automatically for each renewal.</p>
            <p><strong className="text-foreground">Price Changes.</strong> We may modify subscription pricing from time to time. New pricing applies only to renewals occurring at least 30 days after the change is announced; your current term continues at the rate in force at the time of your most recent payment.</p>
            <p><strong className="text-foreground">Failed Payments.</strong> If a renewal payment fails, we will retry the charge over a 14-day grace period and notify you by email. During the grace period, your workspace remains fully functional. If payment cannot be collected after the grace period expires, your workspace will be downgraded to the Free plan and paid features will be locked until the outstanding balance is settled.</p>
            <p><strong className="text-foreground">Taxes.</strong> Subscription prices are exclusive of taxes. You are responsible for all applicable sales tax, VAT, GST, and other governmental charges arising from your use of the Service. Where required by law, we will collect and remit these taxes to the relevant authorities.</p>
            <p>Refund eligibility is governed by our Refund Policy, available at geflow.io/refund-policy and incorporated into these Terms by reference.</p>
          </>
        ),
      },
      {
        id: "license",
        title: "License Grant and Restrictions",
        body: (
          <>
            <p>Subject to your compliance with these Terms and timely payment of all applicable fees, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Service for your internal business operations during the term of your subscription.</p>
            <p>You agree that you will not, and will not permit any third party to: copy, modify, adapt, translate, reverse-engineer, decompile, or disassemble any portion of the Service except as expressly permitted by applicable law; circumvent or disable any security or technical features of the Service; access the Service to build a competitive product, benchmark for competitive purposes, or copy any features, design, or functionality; resell, sublicense, lease, distribute, or otherwise commercially exploit access to the Service except where you are an authorized reseller under a separate written agreement; use the Service to transmit malicious code, conduct security scans, or stage attacks against any system; use the Service in a manner that exceeds reasonable usage parameters or that we determine in our sole discretion is excessive, abusive, or imposes a disproportionate burden on our infrastructure; or violate any applicable law, regulation, or third-party right in connection with your use of the Service.</p>
          </>
        ),
      },
      {
        id: "data",
        title: "Customer Data and Ownership",
        body: (
          <>
            <p>You retain all right, title, and interest in and to the data you submit to, store within, or generate through the Service ("Customer Data"). We claim no ownership over Customer Data and act solely as a data processor on your behalf. You grant us a limited, worldwide, royalty-free license to host, store, transmit, display, and process Customer Data exclusively for the purpose of providing, maintaining, and improving the Service for you.</p>
            <p>You are solely responsible for the accuracy, legality, and quality of all Customer Data, and for obtaining all rights and consents necessary to submit Customer Data to the Service. You represent and warrant that your submission of Customer Data does not violate any law, regulation, or third-party right, including intellectual-property rights and privacy rights.</p>
            <p>You may export your Customer Data at any time using the in-product export tools, which support CSV, JSON, and SQL-dump formats. Upon termination of your account, your Customer Data will remain accessible for export for 30 days, after which it will be permanently deleted from production systems within 30 days and from backups within 90 days, except where retention is required by law.</p>
            <p>We may use aggregated, anonymized, and de-identified data derived from Customer Data for benchmarking, analytics, research, and product-improvement purposes. Aggregated data does not contain personal identifiers and cannot be reverse-engineered to re-identify any individual or business.</p>
          </>
        ),
      },
      {
        id: "ip",
        title: "Intellectual Property Rights",
        body: (
          <>
            <p>The Service and all associated software, source code, designs, user interfaces, trademarks, logos, documentation, and other materials (collectively, the "GeFlow IP") are the exclusive property of Gepard Tech and its licensors and are protected by copyright, trademark, patent, trade-secret, and other intellectual-property laws. Except for the limited license granted in these Terms, no rights are granted to you by implication, estoppel, or otherwise.</p>
            <p>You may not remove, obscure, or alter any proprietary notices contained in the Service. You may not use the GeFlow name, logos, or trademarks except as expressly permitted by our brand-usage guidelines available at geflow.io/brand or under a separate written agreement.</p>
            <p>If you submit feedback, suggestions, feature requests, or ideas about the Service ("Feedback"), you grant us a perpetual, irrevocable, royalty-free, worldwide license to use, modify, and incorporate that Feedback into the Service or any other product without obligation or compensation. We sincerely value Feedback and encourage you to share it openly.</p>
          </>
        ),
      },
      {
        id: "termination",
        title: "Suspension and Termination",
        body: (
          <>
            <p>You may terminate your account at any time by visiting Settings → Workspace → Delete Workspace, or by emailing support@geflow.io. Termination by you takes effect at the end of your current billing period for monthly and annual subscriptions; refund eligibility is governed by our Refund Policy.</p>
            <p>We may suspend or terminate your access to the Service, in whole or in part, at any time and without prior notice if we determine in our reasonable discretion that you have breached these Terms, our Acceptable Use Policy, or any other agreement with us; that your use of the Service poses a security risk, may subject us to liability, or may harm other users; that we are required to do so by law, court order, or governmental authority; or that you have failed to pay any amount due within the grace period described above.</p>
            <p>Upon termination, all rights granted to you under these Terms will immediately cease, and you must stop using the Service. Sections of these Terms that by their nature should survive termination — including ownership, indemnification, limitations of liability, and dispute resolution — will survive.</p>
          </>
        ),
      },
      {
        id: "warranties",
        title: "Disclaimers and Limitation of Liability",
        body: (
          <>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.</p>
            <p>We do not warrant that the Service will be uninterrupted, error-free, or completely secure; that defects will be corrected; or that the Service will meet your specific requirements. Your use of the Service is at your sole risk.</p>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p>OUR TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US IN THE 12 MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED UNITED STATES DOLLARS (USD $100). The limitations in this section apply to the maximum extent permitted by law and even if any limited remedy fails of its essential purpose.</p>
          </>
        ),
      },
      {
        id: "law",
        title: "Governing Law and Dispute Resolution",
        body: (
          <>
            <p>These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Gepard Tech is registered, without regard to conflict-of-laws principles. Any dispute arising out of or related to these Terms or the Service will first be addressed through good-faith negotiation between the parties for a period of at least 30 days.</p>
            <p>If informal resolution fails, the dispute will be resolved through binding arbitration administered by an internationally recognized arbitration body, conducted in English, with each party bearing its own costs. Notwithstanding the foregoing, either party may seek injunctive or equitable relief in any court of competent jurisdiction to protect intellectual-property rights or confidential information.</p>
            <p>You agree that any claim must be filed within one year after the claim arose; otherwise, the claim is permanently barred. Class actions, class arbitrations, and representative actions are not permitted. If any provision of this section is found unenforceable, the remainder will continue in full force and effect.</p>
          </>
        ),
      },
      {
        id: "general",
        title: "General Provisions and Changes",
        body: (
          <>
            <p>These Terms constitute the entire agreement between you and us regarding the Service and supersede all prior agreements, communications, or understandings. If any provision is held invalid or unenforceable, the remaining provisions will continue in full force and effect, and the invalid provision will be modified to the minimum extent necessary to make it enforceable while preserving its original intent.</p>
            <p>Our failure to enforce any right or provision of these Terms will not be deemed a waiver of that right or provision. You may not assign or transfer these Terms or any rights hereunder without our prior written consent; we may assign these Terms freely.</p>
            <p>We may modify these Terms at any time. Material changes will be communicated by email and in-product notice at least 30 days before they take effect. Continued use of the Service after the effective date of any update constitutes your acceptance of the revised Terms. If you do not agree, you must discontinue use and may terminate your account.</p>
            <p>Questions about these Terms should be directed to legal@geflow.io. We typically respond within two business days.</p>
          </>
        ),
      },
    ]}
  />
);

export default Terms;
