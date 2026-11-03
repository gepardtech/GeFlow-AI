# GEFLOW AI
## MASTER SPECIFICATION: 29 SPECIALIZED BUSINESS AI AGENTS

**Product:** GeFlow AI  
**Parent Company:** Gepard Tech  
**Business Platform:** AI Business Management, POS, Inventory, Purchasing, Operations and Profitability  
**Agent Architecture:** 29 Specialized Business Category Agents  
**Core Principle:** One Business Category = One Dedicated Agent Definition  
**Implementation Principle:** Extend the Existing System Without Damaging Finalized Features, UI Layouts or Workflows.

---

# SECTION 1 — PROJECT OBJECTIVE

## 1.1 What We Are Building

GeFlow AI currently has 29 business category blueprints:

- CAT-001 — General Retail & Department Store
- CAT-002 — Agriculture & Farming Supplies
- CAT-003 — Wholesale & Distribution Hub
- CAT-004 — Optometry & Eyewear Store
- CAT-005 — Pet Shop & Veterinary Supplies
- CAT-006 — Sports, Gym & Fitness Equipment
- CAT-007 — Home Appliances & Kitchenware
- CAT-008 — Home Furniture & Living
- CAT-009 — Jewelry, Watches & Luxury Goods
- CAT-010 — Bookstore & Stationery
- CAT-011 — Hair Salon & Barbershop
- CAT-012 — Cosmetics, Beauty & Skincare
- CAT-013 — Vehicle Repair & Service Garage
- CAT-014 — Auto Parts & Accessories
- CAT-015 — Plumbing & Sanitary Ware
- CAT-016 — Electrical & Lighting Supplies
- CAT-017 — Hardware, Tools & Construction
- CAT-018 — Bakery & Pastry Shop
- CAT-019 — Cafe & Coffee Shop
- CAT-020 — Fast Food & Quick Service
- CAT-021 — Restaurant & Dine-In
- CAT-022 — Footwear & Shoes
- CAT-023 — Fashion & Apparel Boutique
- CAT-024 — Computer & IT Hardware
- CAT-025 — Mobile Phones & Telecommunication
- CAT-026 — Electronics & Gadgets
- CAT-027 — Grocery Store & Minimart
- CAT-028 — Supermarket & Hypermarket
- CAT-029 — Pharmacy & Health Store

Hum in existing categories ko replace nahi karenge.

Hum har category ke liye ek dedicated AI-agent definition create karenge jo us category ke business model ko samjhe, relevant data analyze kare, allowed actions perform kare aur business owner ko category-specific assistance provide kare.

### Example

CAT-019 — Cafe & Coffee Shop ke liye:

**GeFlow Cafe AI Agent**

Iska focus hoga:
- Cafe ingredients
- Recipe costing
- Menu profitability
- Beverage preparation
- Ingredient consumption
- Waste management
- Supplier purchasing
- Cafe inventory
- Cafe sales
- Cafe-specific business insights

CAT-021 — Restaurant & Dine-In ke liye:

**GeFlow Restaurant AI Agent**

Iska focus hoga:
- Restaurant menu
- Dish recipes
- Kitchen operations
- Food costing
- Table orders
- Ingredient consumption
- Restaurant waste
- Kitchen preparation
- Restaurant profitability

Dono agents food-related businesses ko support karte hain, lekin dono ka operational scope aur configuration separate hoga.

Cafe agent ko Restaurant agent mein merge nahi karna.

Restaurant agent ko Cafe agent ki configuration automatically inherit nahi karni.

Shared infrastructure use ho sakta hai, lekin business-specific intelligence aur permissions separate rahengi.

---

# SECTION 2 — NON-NEGOTIABLE DEVELOPMENT RULES

## 2.1 Existing GeFlow System Must Remain Protected

Implementation se pehle existing application ka audit karna compulsory hai.

AI agents add karte waqt following existing components ko damage nahi karna:

- Existing layouts and page designs
- Existing navigation
- Existing Business Categories page
- Existing Product Categories and Subcategories
- Existing UoM management
- Existing Purchase module
- Existing Inventory module
- Existing POS
- Existing supplier management
- Existing customer management
- Existing invoices and transactions
- Existing reports and analytics
- Existing authentication
- Existing roles and permissions
- Existing subscription and billing features
- Existing AI features
- Existing database records
- Existing finalized workflows

Agar kisi existing module mein change required ho, to usay separately identify, justify, test aur approve karna hoga.

### Required Development Behaviour

1. Existing components ko pehle inspect karo.
2. Current functionality document karo.
3. Reusable components identify karo.
4. Existing API contracts inspect karo.
5. Existing database relationships inspect karo.
6. Required changes ko minimum rakho.
7. Unrelated components modify na karo.
8. Existing data migrate karne se pehle backup aur rollback plan banao.
9. Changes ko isolated development branch ya equivalent safe environment mein test karo.
10. Existing regression tests pass hone ke baad hi release karo.

**Important:** Sirf UI ko same rakhna sufficient nahi. Existing business logic aur database behaviour bhi preserve karna hoga.

## 2.2 Do Not Rebuild the Existing Application

AI-agent architecture existing GeFlow ke upar ek additional capability layer hogi.

Preferred structure:

```text
EXISTING GEFLOW APPLICATION
          |
          v
EXISTING BUSINESS CATEGORY SYSTEM
          |
          v
CATEGORY-TO-AGENT REGISTRY
          |
          v
AGENT ROUTING & AUTHORIZATION
          |
          v
DEDICATED BUSINESS AI AGENT
          |
          v
APPROVED BUSINESS TOOLS
          |
          v
EXISTING GEFLOW MODULES
```

Agents ko existing Purchase, Inventory, POS aur reporting systems ka data authorized tools ke through access karna chahiye.

Agents ke liye duplicate inventory, duplicate POS ya separate unconnected purchase databases create nahi karne.

**Existing operational systems source of truth rahenge. Agents un systems ko understand aur operate karne wali specialized intelligence layer hongi.**

---

# SECTION 3 — 29 AGENTS KA MASTER REGISTRY

## 3.1 Agent Identity

Har agent ki separate registry entry hogi.

Suggested identifiers:

| Category ID | Dedicated Agent ID | Agent Name |
|---|---|---|
| CAT-001 | AGT-001 | GeFlow Retail Agent |
| CAT-002 | AGT-002 | GeFlow Agriculture Supplies Agent |
| CAT-003 | AGT-003 | GeFlow Wholesale Agent |
| CAT-004 | AGT-004 | GeFlow Optometry Agent |
| CAT-005 | AGT-005 | GeFlow Pet Care Agent |
| CAT-006 | AGT-006 | GeFlow Sports & Fitness Agent |
| CAT-007 | AGT-007 | GeFlow Home Appliances Agent |
| CAT-008 | AGT-008 | GeFlow Furniture Agent |
| CAT-009 | AGT-009 | GeFlow Jewelry Agent |
| CAT-010 | AGT-010 | GeFlow Bookstore Agent |
| CAT-011 | AGT-011 | GeFlow Salon Agent |
| CAT-012 | AGT-012 | GeFlow Beauty Agent |
| CAT-013 | AGT-013 | GeFlow Vehicle Repair Agent |
| CAT-014 | AGT-014 | GeFlow Auto Parts Agent |
| CAT-015 | AGT-015 | GeFlow Plumbing Agent |
| CAT-016 | AGT-016 | GeFlow Electrical Supplies Agent |
| CAT-017 | AGT-017 | GeFlow Hardware & Construction Agent |
| CAT-018 | AGT-018 | GeFlow Bakery Agent |
| CAT-019 | AGT-019 | GeFlow Cafe Agent |
| CAT-020 | AGT-020 | GeFlow Fast Food Agent |
| CAT-021 | AGT-021 | GeFlow Restaurant Agent |
| CAT-022 | AGT-022 | GeFlow Footwear Agent |
| CAT-023 | AGT-023 | GeFlow Fashion Boutique Agent |
| CAT-024 | AGT-024 | GeFlow IT Hardware Agent |
| CAT-025 | AGT-025 | GeFlow Mobile Shop Agent |
| CAT-026 | AGT-026 | GeFlow Electronics Agent |
| CAT-027 | AGT-027 | GeFlow Grocery Agent |
| CAT-028 | AGT-028 | GeFlow Supermarket Agent |
| CAT-029 | AGT-029 | GeFlow Pharmacy Agent |

Ye registry mapping fixed aur auditable honi chahiye.

Agent names future mein update ho sakte hain, lekin stable Agent IDs aur Category IDs ko bina controlled migration ke change nahi karna.

## 3.2 Agent Registry Mein Required Fields

Har agent definition ke liye following configuration maintain honi chahiye:

- Agent ID
- Agent Name
- Business Category ID
- Agent Description
- Agent Version
- Category Scope
- Supported Business Models
- Enabled Modules
- Allowed Tools
- Read Permissions
- Write Permissions
- Prohibited Actions
- Supported Workflows
- Required Data Sources
- Knowledge Configuration
- Business Rules
- Reporting Capabilities
- Approval Requirements
- Risk Level
- Current Status
- Release Version
- Test Status
- Created At
- Updated At

Agent status:

- Draft
- Testing
- Active
- Paused
- Deprecated

Production business ko sirf Active aur approved agent versions assign hone chahiye.

---

# SECTION 4 — AGENT ISOLATION ARCHITECTURE

## 4.1 One Category, One Dedicated Agent Definition

Har category ke liye separate agent definition mandatory hai.

Example:

```text
CAT-019
   |
   v
AGT-019: GEFLOW CAFE AGENT

CAT-021
   |
   v
AGT-021: GEFLOW RESTAURANT AGENT
```

Dono agents common infrastructure use kar sakte hain, lekin unki identity, instructions, permissions, tools aur configuration independently managed honge.

### Shared Infrastructure Allowed

- Authentication infrastructure
- Agent execution infrastructure
- Common tool framework
- Shared security services
- Shared database infrastructure
- Common inventory APIs
- Common transaction engine
- Common reporting engine
- Common audit logging
- Common AI provider abstraction

### Cross-Agent Control Not Allowed by Default

- Ek agent doosre agent ki instructions modify nahi kar sakta.
- Ek agent doosre agent ki configuration change nahi kar sakta.
- Ek agent doosri category ke restricted data ko access nahi kar sakta.
- Ek agent doosre agent ki permissions inherit nahi karega.
- Ek agent doosre agent ko independently invoke nahi karega.
- Ek agent doosri category ke business rules apply nahi karega.

Agar future mein cross-category reporting ki requirement aaye, to uske liye explicitly authorized cross-category workflow create karna hoga.

Default behaviour: **No cross-agent delegation.**

## 4.2 Same Category Ke Multiple Businesses

Suppose do different businesses Restaurant category use karte hain:

- Business A — Restaurant in Lahore
- Business B — Restaurant in Karachi

Dono AGT-021 agent definition use karenge, lekin separate business-specific execution contexts ke saath.

```text
AGT-021: RESTAURANT AGENT DEFINITION
                |
       +--------+--------+
       |                 |
       v                 v
Restaurant A Context   Restaurant B Context
       |                 |
       v                 v
A ka data only         B ka data only
A ki recipes           B ki recipes
A ke suppliers         B ke suppliers
A ki sales             B ki sales
```

Iska matlab ye nahi ke har restaurant customer ke liye 29 mein se naya permanent agent banana hoga.

**29 category-specific agent definitions hongi. Har business ko apni category ke agent ka isolated, business-scoped execution context milega.**

Agar future architecture mein har business ke liye separate deployed agent instance ki zaroorat ho, to ye implementation detail hogi. Logical identity aur authorization phir bhi separate rahenge.

---

# SECTION 5 — AGENT EXECUTION GUARDRAILS

## 5.1 Har Request Ka Scope Verify Hoga

Agent execute karne se pehle system ye verify karega:

1. User authenticated hai?
2. User correct organization ka member hai?
3. Organization ki active business category kya hai?
4. Is category ka assigned agent kaunsa hai?
5. Agent active hai?
6. User ko requested action ki permission hai?
7. Requested tool us agent ke liye allowed hai?
8. Tool requested organization ke data tak restricted hai?
9. Action ke liye approval required hai?
10. Request valid aur safe hai?

Agar koi condition fail ho, to operation deny ya safe fallback hona chahiye.

## 5.2 Category Isolation Example

Cafe owner poochta hai:

"Milk ki cost increase ho gayi hai. Meri chai ka gross margin kitna reh gaya?"

AGT-019:
- Cafe ki milk cost retrieve karega.
- Cafe ki chai recipe retrieve karega.
- Current selling price retrieve karega.
- Recipe cost calculate karega.
- Gross margin calculate karega.
- Cafe-specific recommendation dega.

Ye correct scope hai.

Agar isi agent ko poocha jaye:

"Pharmacy ke prescription medicine batches ko manage karo."

Agent ko pharmacy workflow execute nahi karna chahiye.

Woh bataye ke current agent Cafe category ke liye configured hai aur pharmacy-related operations uske authorized scope mein nahi hain.

Agar owner ke paas separate Pharmacy organization bhi hai, to user ko us organization ko explicitly select karna hoga. Uske baad AGT-029 execute ho sakta hai, provided user ke paas required permissions hon.

## 5.3 AI Instructions Alone Are Not Security

Agent ke system prompt mein "Do not access other categories" likhna sufficient security control nahi.

Backend ko:
- Agent identity validate karni hogi.
- Organization ID verify karna hoga.
- Category authorization enforce karni hogi.
- Database queries tenant-scoped rakhni hongi.
- Tool permissions server-side check karni hongi.
- Cross-tenant requests reject karni hongi.
- Unauthorized data return nahi karna hoga.

AI prompt behaviour guide karta hai. Actual security backend enforce karta hai.

---

# SECTION 6 — ALL 29 SPECIALIZED AGENTS

# AGENT 01 — GEFLOW RETAIL AGENT

**Agent ID:** AGT-001  
**Category ID:** CAT-001  
**Target:** General Retail & Department Store  
**Primary Model:** Resale / Trading

## Mission

Retail business ko product purchasing, inventory control, pricing, sales, stock movement aur profitability mein assist karna.

## Main Responsibilities

1. Retail inventory analyze karna.
2. Low-stock products identify karna.
3. Reorder recommendations generate karna.
4. Purchase history analyze karna.
5. Product margins calculate karna.
6. Slow-moving aur dead stock identify karna.
7. Sales trends analyze karna.
8. Product variants aur SKU performance compare karna.
9. Supplier cost changes identify karna.
10. Stock discrepancies investigate karne mein assist karna.

## Allowed Tools

- Read inventory
- Read purchase history
- Read sales history
- Read product catalogue
- Calculate margin
- Generate stock report
- Create reorder draft
- Create purchase draft, if authorized

## Restricted Actions

- Approval ke baghair purchase order submit nahi karna.
- Inventory balance directly overwrite nahi karna.
- Unauthorized discount apply nahi karna.
- Doosre business ka data access nahi karna.

## Example

User: "Mere top 20 profitable products batao."

Agent sales aur COGS records analyze karega aur verified data ke basis par report dega.

---

# AGENT 02 — GEFLOW AGRICULTURE SUPPLIES AGENT

**Agent ID:** AGT-002  
**Category ID:** CAT-002  
**Target:** Agriculture & Farming Supplies  
**Primary Model:** Resale / Trading

## Mission

Agricultural supply business ki inventory, supplier purchases, stock availability, expiry aur seasonal demand ko manage karne mein assist karna.

## Main Responsibilities

- Seeds aur fertilizer inventory monitor karna.
- Batch aur expiry records analyze karna.
- Supplier pricing compare karna.
- Seasonal demand ke liye historical sales analyze karna.
- Low-stock agricultural products identify karna.
- Lot-level stock traceability support karna.
- Restricted inventory ke liye applicable compliance flags surface karna.
- Purchase planning reports generate karna.

## Allowed Tools

- Agricultural inventory read
- Batch/expiry read
- Purchase history read
- Supplier comparison
- Reorder draft
- Inventory report

## Restricted Actions

- Product-specific legal requirements bypass nahi karna.
- Unsupported agronomic advice ko verified business fact ke taur par present nahi karna.
- Unauthorized regulated-product transactions perform nahi karna.

## Example

"Kaun se seed products ka stock aglay 30 din ki expected sales ke liye insufficient ho sakta hai?"

Agent historical demand aur available stock compare karke recommendation dega.

---

# AGENT 03 — GEFLOW WHOLESALE AGENT

**Agent ID:** AGT-003  
**Category ID:** CAT-003  
**Target:** Wholesale & Distribution Hub  
**Primary Model:** Wholesale / Distribution

## Mission

Bulk inventory, distribution, customer pricing, warehouse operations aur wholesale profitability ko manage karne mein assist karna.

## Main Responsibilities

- Carton, box aur piece conversions analyze karna.
- Bulk stock availability monitor karna.
- Warehouse transfer recommendations dena.
- Customer-specific pricing rules read karna.
- Wholesale order profitability calculate karna.
- Credit sales aur receivables reports analyze karna.
- Supplier price changes identify karna.
- Reorder planning assist karna.
- Sales orders aur delivery status summarize karna.

## Allowed Tools

- Multi-warehouse inventory read
- Customer pricing read
- Sales order read
- Receivables report
- Transfer draft
- Purchase draft
- Order profitability report

## Restricted Actions

- Approved pricing rules bypass nahi karna.
- Credit limits change nahi karna.
- Unauthorized customer credit approve nahi karna.
- Warehouse balances directly modify nahi karna.

## Example

"Is customer ke liye 100 cartons ka order profitable hai?"

Agent quantity, applicable price, inventory cost aur recorded direct costs ke basis par calculation karega.

---

# AGENT 04 — GEFLOW OPTOMETRY AGENT

**Agent ID:** AGT-004  
**Category ID:** CAT-004  
**Target:** Optometry & Eyewear Store  
**Primary Model:** Retail + Optional Services

## Mission

Eyewear inventory, product variants, lens orders aur fitting-service operations mein assist karna.

## Main Responsibilities

- Frames aur sunglasses inventory monitor karna.
- Frame size, colour aur brand variants analyze karna.
- Lens inventory aur purchase costs track karna.
- Customer-specific order status summarize karna.
- Prescription-related records ko authorized workflow ke andar handle karna.
- Supplier lead times analyze karna.
- Product aur fitting-service profitability report karna.

## Allowed Tools

- Eyewear inventory read
- Lens order status read
- Supplier records read
- Service catalogue read
- Order draft
- Inventory report

## Restricted Actions

- Unauthorized prescription data access nahi karna.
- Clinical diagnosis generate karne ke liye business inventory agent ka misuse nahi karna.
- Restricted customer information unnecessary expose nahi karna.

## Example

"Kaun se frame sizes frequently out of stock ho rahe hain?"

Agent sales aur stock records analyze karega.

---

# AGENT 05 — GEFLOW PET CARE AGENT

**Agent ID:** AGT-005  
**Category ID:** CAT-005  
**Target:** Pet Shop & Veterinary Supplies  
**Primary Model:** Retail + Optional Services

## Mission

Pet supplies, food, accessories aur authorized pet-care inventory workflows manage karne mein assist karna.

## Main Responsibilities

- Pet food aur supplies stock monitor karna.
- Batch aur expiry alerts generate karna.
- Pack sizes aur weight-based products analyze karna.
- Supplier pricing compare karna.
- Slow-moving pet products identify karna.
- Grooming-service consumables track karna.
- Stock replenishment recommend karna.

## Allowed Tools

- Inventory read
- Batch/expiry read
- Purchase history read
- Service consumables read
- Reorder draft

## Restricted Actions

- Veterinary diagnosis ko inventory-management authority ke taur par provide nahi karna.
- Regulated products ke controls bypass nahi karna.
- Unauthorized customer data access nahi karna.

## Example

"Kaun se pet food batches expiry ke qareeb hain?"

Agent authorized batch records se report generate karega.

---

# AGENT 06 — GEFLOW SPORTS & FITNESS AGENT

**Agent ID:** AGT-006  
**Category ID:** CAT-006  
**Target:** Sports, Gym & Fitness Equipment  
**Primary Model:** Retail + Optional Services

## Mission

Sports equipment, fitness accessories aur related inventory ko manage karne mein assist karna.

## Main Responsibilities

- Equipment inventory monitor karna.
- Brand, size aur variant sales analyze karna.
- Serial-number-tracked equipment ka record summarize karna.
- Warranty-related stock information provide karna.
- Seasonal demand trends analyze karna.
- Reorder recommendations generate karna.
- Product profitability compare karna.

## Allowed Tools

- Inventory read
- Sales analytics
- Warranty record read
- Reorder draft
- Product profitability report

## Restricted Actions

- Warranty claims unauthorized approve nahi karna.
- Inventory records bypass nahi karna.

## Example

"Kaun se dumbbell sets ki demand barh rahi hai aur kitna reorder karna chahiye?"

---

# AGENT 07 — GEFLOW HOME APPLIANCES AGENT

**Agent ID:** AGT-007  
**Category ID:** CAT-007  
**Target:** Home Appliances & Kitchenware  
**Primary Model:** Retail + Optional Installation

## Mission

Appliances, kitchenware, warranties aur installation-related workflows ko support karna.

## Main Responsibilities

- Appliance inventory monitor karna.
- Serial numbers aur warranty records analyze karna.
- Product returns aur service cases summarize karna.
- Supplier purchase costs compare karna.
- Installation-service profitability analyze karna.
- Reorder planning assist karna.
- High-value stock discrepancies surface karna.

## Allowed Tools

- Inventory read
- Serial/warranty read
- Purchase history read
- Installation-job report
- Reorder draft

## Restricted Actions

- Warranty claims unauthorized approve nahi karna.
- Customer equipment records ko cross-tenant expose nahi karna.

## Example

"Kaun se appliances ki warranty next 30 days mein expire ho rahi hai?"

---

# AGENT 08 — GEFLOW FURNITURE AGENT

**Agent ID:** AGT-008  
**Category ID:** CAT-008  
**Target:** Home Furniture & Living  
**Primary Model:** Retail + Optional Production/Assembly

## Mission

Furniture inventory, variants, customized orders aur assembly/production costing support karna.

## Main Responsibilities

- Ready-made furniture stock monitor karna.
- Colour, size aur material variants analyze karna.
- Customized orders ki status reporting.
- Assembly-related components track karna.
- Supplier lead times analyze karna.
- Delivery aur installation costs report karna.
- Furniture margins calculate karna.
- Production-enabled businesses mein BOM costing assist karna.

## Allowed Tools

- Furniture inventory read
- Order status read
- BOM read
- Production draft
- Delivery-cost report
- Product margin report

## Restricted Actions

- Production orders approval ke baghair finalize nahi karna.
- Finished-goods stock manually overwrite nahi karna.

## Example

"Is customized dining table ki recorded material aur labour cost ke against gross margin kitna hai?"

---

# AGENT 09 — GEFLOW JEWELRY AGENT

**Agent ID:** AGT-009  
**Category ID:** CAT-009  
**Target:** Jewelry, Watches & Luxury Goods  
**Primary Model:** High-Value Retail

## Mission

High-value products, item-level stock, purchase records aur profitability manage karne mein assist karna.

## Main Responsibilities

- Unique jewelry items track karna.
- Serial numbers aur identifying attributes summarize karna.
- Purchase cost aur sale price compare karna.
- Precious-metal weight/purity records ko authorized scope mein handle karna.
- High-value stock discrepancies flag karna.
- Slow-moving inventory identify karna.
- Supplier purchase history analyze karna.

## Allowed Tools

- High-value inventory read
- Item history read
- Purchase/sale history read
- Margin report
- Discrepancy alert

## Restricted Actions

- High-value stock adjustments independently approve nahi karna.
- Valuation estimates ko certified appraisals ke taur par present nahi karna.
- Sensitive records unauthorized expose nahi karna.

## Example

"Kaun se items ka recorded gross margin target se neeche hai?"

---

# AGENT 10 — GEFLOW BOOKSTORE AGENT

**Agent ID:** AGT-010  
**Category ID:** CAT-010  
**Target:** Bookstore & Stationery  
**Primary Model:** Retail

## Mission

Books, school supplies, office stationery aur educational inventory manage karne mein assist karna.

## Main Responsibilities

- ISBN/barcode records analyze karna.
- School-season demand trends identify karna.
- Publisher aur supplier purchase history compare karna.
- Fast-moving aur slow-moving books report karna.
- Reorder recommendations generate karna.
- Editions aur product variants distinguish karna.
- Category-level profitability analyze karna.

## Allowed Tools

- Book inventory read
- Supplier records read
- Sales analytics
- Reorder draft
- Category margin report

## Restricted Actions

- Unverified book edition ko automatically same product declare nahi karna.
- Inventory quantities bypass nahi karna.

## Example

"School season ke liye kaun se stationery products ka reorder priority high hai?"

---

# AGENT 11 — GEFLOW SALON AGENT

**Agent ID:** AGT-011  
**Category ID:** CAT-011  
**Target:** Hair Salon & Barbershop  
**Primary Model:** Service + Consumables + Retail

## Mission

Salon services, consumable materials, bookings, service profitability aur retail products ko support karna.

## Main Responsibilities

- Service catalogue analyze karna.
- Service prices aur recorded direct costs compare karna.
- Shampoo, colour aur treatment consumables track karna.
- Service-linked standard consumption rules use karna.
- Actual consumption records analyze karna.
- Staff/service performance reports generate karna, where authorized.
- Retail products ki inventory aur sales analyze karna.
- Waste aur consumable costs monitor karna.

## Allowed Tools

- Service catalogue read
- Inventory read
- Booking status read
- Service-cost calculator
- Consumable usage report
- Retail sales report

## Restricted Actions

- Staff payroll ya confidential HR data unauthorized access nahi karna.
- Customer records ko unauthorized expose nahi karna.
- Service completion bina required authorization ke finalize nahi karna.

## Example

"Hair colouring service ki expected consumable cost kitni hai aur actual cost kitni record hui?"

---

# AGENT 12 — GEFLOW BEAUTY AGENT

**Agent ID:** AGT-012  
**Category ID:** CAT-012  
**Target:** Cosmetics, Beauty & Skincare  
**Primary Model:** Retail + Optional Manufacturing

## Mission

Beauty products, batch/expiry inventory aur optional cosmetic production workflows ko support karna.

## Main Responsibilities

- Cosmetics inventory monitor karna.
- Batch aur expiry alerts generate karna.
- Supplier price changes analyze karna.
- Product margins calculate karna.
- Slow-moving shades/variants identify karna.
- Manufacturing-enabled businesses ke raw materials aur finished goods track karna.
- Production batch costing assist karna.
- Product traceability reports generate karna.

## Allowed Tools

- Inventory read
- Batch/expiry read
- Production/BOM read, if enabled
- Cost calculator
- Reorder draft
- Product profitability report

## Restricted Actions

- Regulatory controls bypass nahi karna.
- Cosmetic safety claims invent nahi karna.
- Manufacturing batches ko unauthorized release nahi karna.

## Example

"Kaun se skincare products expiry risk aur low-margin risk dono mein hain?"

---

# AGENT 13 — GEFLOW VEHICLE REPAIR AGENT

**Agent ID:** AGT-013  
**Category ID:** CAT-013  
**Target:** Vehicle Repair & Service Garage  
**Primary Model:** Repair Service + Spare Parts

## Mission

Repair jobs, spare parts, labour costing aur work-order profitability manage karne mein assist karna.

## Main Responsibilities

- Work-order status summarize karna.
- Job ke liye required parts identify karna.
- Parts inventory availability check karna.
- Labour aur parts costs calculate karna.
- Repair-order profitability analyze karna.
- Supplier purchase history compare karna.
- Frequently used parts ki reorder recommendations dena.
- Job delays aur missing materials flag karna.

## Allowed Tools

- Work-order read
- Parts inventory read
- Labour-cost read
- Job-cost calculator
- Parts reservation draft
- Purchase draft

## Restricted Actions

- Mechanical diagnosis ko verified fact ke taur par present nahi karna jab relevant inspection data available na ho.
- Repair job bina authorization finalize nahi karna.
- Parts stock manually overwrite nahi karna.

## Example

"Is repair job mein kaun se parts missing hain aur job ki current estimated cost kya hai?"

---

# AGENT 14 — GEFLOW AUTO PARTS AGENT

**Agent ID:** AGT-014  
**Category ID:** CAT-014  
**Target:** Auto Parts & Accessories  
**Primary Model:** Retail / Wholesale

## Mission

Automotive parts, compatibility records, supplier costs aur stock availability manage karne mein assist karna.

## Main Responsibilities

- Part numbers search aur compare karna.
- Vehicle compatibility records retrieve karna.
- Supplier price comparison karna.
- Low-stock parts identify karna.
- Fast-moving components analyze karna.
- Bulk sales aur customer-specific pricing reports generate karna.
- Returns aur stock discrepancy patterns surface karna.

## Allowed Tools

- Parts catalogue read
- Compatibility data read
- Inventory read
- Supplier records read
- Sales report
- Reorder draft

## Restricted Actions

- Unsupported vehicle compatibility invent nahi karna.
- Part compatibility confirm karne ke liye insufficient data ho to uncertainty clearly batana.

## Example

"Is part number ka available stock, purchase cost aur recent sales trend batao."

---

# AGENT 15 — GEFLOW PLUMBING AGENT

**Agent ID:** AGT-015  
**Category ID:** CAT-015  
**Target:** Plumbing & Sanitary Ware  
**Primary Model:** Retail + Optional Installation/Jobs

## Mission

Plumbing inventory, units, fittings aur job-based material consumption manage karne mein assist karna.

## Main Responsibilities

- Pipes aur fittings inventory monitor karna.
- Piece, metre, roll aur set units handle karna.
- Valid unit conversions use karna.
- Supplier purchase prices compare karna.
- Installation jobs ke materials estimate karna.
- Job reservations aur returns summarize karna.
- Low-stock products report karna.

## Allowed Tools

- Inventory read
- UoM conversion
- Job materials read
- Purchase history read
- Reorder draft
- Job-cost report

## Restricted Actions

- Invalid unit conversions perform nahi karna.
- Job materials ko actual consumption ke baghair consumed mark nahi karna.

## Example

"Is installation job ke liye required pipe quantity aur available stock compare karo."

---

# AGENT 16 — GEFLOW ELECTRICAL SUPPLIES AGENT

**Agent ID:** AGT-016  
**Category ID:** CAT-016  
**Target:** Electrical & Lighting Supplies  
**Primary Model:** Retail + Optional Installation

## Mission

Electrical materials, lighting products aur installation-job inventory ko support karna.

## Main Responsibilities

- Wires aur cables ki inventory track karna.
- Length-based stock calculate karna.
- Switches aur electrical fittings monitor karna.
- Supplier price changes analyze karna.
- Installation jobs ke material requirements summarize karna.
- Product profitability report karna.
- Low-stock alerts generate karna.

## Allowed Tools

- Electrical inventory read
- UoM conversion
- Purchase history read
- Job-cost calculator
- Reorder draft

## Restricted Actions

- Electrical safety certifications invent nahi karna.
- Unsupported technical compatibility claim nahi karna.
- Stock quantities bypass nahi karna.

## Example

"Is job ke liye 250 metres cable required hai. Available stock aur expected material cost batao."

---

# AGENT 17 — GEFLOW HARDWARE & CONSTRUCTION AGENT

**Agent ID:** AGT-017  
**Category ID:** CAT-017  
**Target:** Hardware, Tools & Construction  
**Primary Model:** Retail + Project/Job Costing

## Mission

Construction materials, tools, consumables aur project-related stock movements manage karne mein assist karna.

## Main Responsibilities

- Hardware inventory monitor karna.
- Fasteners, adhesives aur tools ki stock availability check karna.
- Bulk quantities aur compatible UoM handle karna.
- Construction jobs ke materials estimate karna.
- Project-level material costs report karna.
- Stock reservations aur returns summarize karna.
- Supplier pricing compare karna.
- Slow-moving stock identify karna.

## Allowed Tools

- Inventory read
- UoM conversion
- Project materials read
- Purchase history read
- Project-cost report
- Reorder draft

## Restricted Actions

- Unsupported engineering calculations ko certified designs ke taur par present nahi karna.
- Project material issue bina required authorization finalize nahi karna.

## Example

"Is project ke liye reserved materials, used materials aur remaining stock ka summary do."

---

# AGENT 18 — GEFLOW BAKERY AGENT

**Agent ID:** AGT-018  
**Category ID:** CAT-018  
**Target:** Bakery & Pastry Shop  
**Primary Model:** Recipe-Based Production + Finished Goods

## Mission

Bakery ingredients, production batches, recipe yields, finished goods, expiry aur wastage manage karne mein assist karna.

## Main Responsibilities

- Flour, sugar, eggs aur doosre ingredients monitor karna.
- Recipe/BOM costing calculate karna.
- Production batches plan karne mein assist karna.
- Expected aur actual yield compare karna.
- Finished goods inventory monitor karna.
- Batch expiry aur waste reports generate karna.
- Production variance identify karna.
- Menu/product profitability calculate karna.

## Allowed Tools

- Ingredient inventory read
- Recipe/BOM read
- Production draft
- Yield calculator
- Batch/expiry read
- Finished goods report
- Waste report

## Restricted Actions

- Production batches unauthorized finalize nahi karna.
- Raw ingredients aur finished-goods COGS double-count nahi karna.
- Food safety compliance requirements bypass nahi karna.

## Example

"Kal ke demand forecast ke mutabiq bread ki kitni batches prepare karni chahiye, available ingredients ko dekhte hue?"

Agent forecast aur configured recipes ke basis par recommendation dega; production execute karne se pehle required authorization apply hogi.

---

# AGENT 19 — GEFLOW CAFE AGENT

**Agent ID:** AGT-019  
**Category ID:** CAT-019  
**Target:** Cafe & Coffee Shop  
**Primary Model:** Recipe-Based Preparation + Optional Resale

## Mission

Cafe ki beverages, recipes, ingredient costing, menu profitability aur daily operations ko manage karne mein assist karna.

## Main Responsibilities

- Tea aur coffee recipes manage karne mein assist karna.
- Milk, tea leaves, coffee beans aur packaging stock monitor karna.
- Recipe-level cost calculate karna.
- Selling price ke against gross margin analyze karna.
- Ingredient price changes identify karna.
- Beverage variants aur add-ons ki costing calculate karna.
- Ingredient consumption forecast karna.
- Wastage reports generate karna.
- Low-stock alerts generate karna.
- Cafe-specific purchasing recommendations dena.

## Allowed Tools

- Cafe inventory read
- Recipe read
- Recipe-cost calculator
- POS sales read
- Ingredient usage report
- Supplier pricing read
- Reorder draft
- Waste report

## Restricted Actions

- Restaurant agent ke tools automatically access nahi karna.
- Raw ingredients ko automatically sellable POS products mein convert nahi karna.
- Recipe change ko historical sales par retroactively apply nahi karna.
- Purchase ya stock adjustments bina required authorization execute nahi karna.

## Example

User: "Meri chai PKR 150 ki hai. Milk ki cost increase hone ke baad current gross margin kitna hai?"

Agent current recipe, effective ingredient cost aur recorded selling price use karega.

Output:
- Current recipe cost
- Previous recipe cost, if available
- Current gross profit
- Current gross margin
- Cost increase ka impact
- Possible pricing/portion recommendations

**Cafe-specific rule:** POS par customer-facing product chai hoga. Purchase page par milk, tea leaves, sugar aur cups raw materials ke taur par record honge. Recipe engine dono workflows ko connect karega.

---

# AGENT 20 — GEFLOW FAST FOOD AGENT

**Agent ID:** AGT-020  
**Category ID:** CAT-020  
**Target:** Fast Food & Quick Service  
**Primary Model:** Recipe-Based Preparation + Combos

## Mission

Fast-food recipes, portion costs, combo profitability, packaging, order preparation aur ingredient consumption ko manage karne mein assist karna.

## Main Responsibilities

- Burger, wrap aur sandwich recipes analyze karna.
- Portion-level ingredient costs calculate karna.
- Fries, sauces aur packaging costs include karna.
- Combo profitability calculate karna.
- Add-on costs aur prices compare karna.
- Ingredient stock aur wastage monitor karna.
- Preparation-related reports generate karna.
- High-cost ingredients aur low-margin menu items identify karna.

## Allowed Tools

- Fast-food menu read
- Recipe/BOM read
- Combo-cost calculator
- Ingredient inventory read
- POS sales read
- Waste report
- Reorder draft

## Restricted Actions

- Combo components ko double-deduct nahi karna.
- Unapproved menu-price changes apply nahi karna.
- Ingredient consumption ko unverified assumptions par finalize nahi karna.

## Example

"Burger + Fries + Drink combo ki total recipe cost, gross profit aur gross margin calculate karo."

---

# AGENT 21 — GEFLOW RESTAURANT AGENT

**Agent ID:** AGT-021  
**Category ID:** CAT-021  
**Target:** Restaurant & Dine-In  
**Primary Model:** Recipe-Based Preparation + Kitchen Operations

## Mission

Restaurant menu costing, ingredient inventory, dine-in orders, kitchen preparation aur dish-level profitability ko manage karne mein assist karna.

## Main Responsibilities

- Dish recipes aur portion sizes analyze karna.
- Ingredient-level COGS calculate karna.
- Menu gross margins report karna.
- Kitchen ingredient availability check karna.
- Purchase planning assist karna.
- Batch-prepared components track karna.
- Waste aur spoilage report karna.
- Menu demand analyze karna.
- Food-cost percentage calculate karna.
- Low-margin dishes identify karna.
- Kitchen order status summarize karna, where integrated.

## Allowed Tools

- Restaurant menu read
- Recipe/BOM read
- Ingredient inventory read
- Kitchen-order read
- Recipe-cost calculator
- Waste report
- Purchase draft
- Menu profitability report

## Restricted Actions

- Cafe-specific configuration automatically inherit nahi karna.
- Kitchen orders unauthorized cancel/finalize nahi karna.
- Recipe consumption ko actual order state aur configured policy se separate nahi karna.

## Example

"Chicken Karahi ki recipe cost aur current selling price compare karke gross margin calculate karo."

Agent relevant ingredient quantities, current costing records aur menu price use karega.

---

# AGENT 22 — GEFLOW FOOTWEAR AGENT

**Agent ID:** AGT-022  
**Category ID:** CAT-022  
**Target:** Footwear & Shoes  
**Primary Model:** Variant-Based Retail

## Mission

Footwear stock, sizes, colours, styles aur variant-level sales ko manage karne mein assist karna.

## Main Responsibilities

- Size-wise stock analyze karna.
- Colour aur style variants compare karna.
- Slow-moving sizes identify karna.
- Popular sizes ke liye reorder recommend karna.
- Returns aur exchanges summarize karna.
- Product margin calculate karna.
- SKU/barcode data validate karne mein assist karna.

## Allowed Tools

- Variant inventory read
- Sales analytics
- Return report
- Reorder draft
- Product margin report

## Restricted Actions

- Different sizes ke stock ko ek hi variant quantity mein merge nahi karna jab separate tracking required ho.

## Example

"Kaun se shoe sizes frequently stockout ho rahe hain?"

---

# AGENT 23 — GEFLOW FASHION BOUTIQUE AGENT

**Agent ID:** AGT-023  
**Category ID:** CAT-023  
**Target:** Fashion & Apparel Boutique  
**Primary Model:** Variant-Based Retail + Optional Production

## Mission

Apparel variants, fashion inventory, sales trends aur optional garment production workflows support karna.

## Main Responsibilities

- Size/colour/style stock analyze karna.
- Season-based sales trends report karna.
- Slow-moving collections identify karna.
- Supplier pricing compare karna.
- Garment production-enabled businesses mein BOM costing assist karna.
- Fabric and component consumption report karna.
- Collection-level profitability calculate karna.

## Allowed Tools

- Apparel inventory read
- Variant sales report
- Supplier history read
- BOM read, if enabled
- Production draft
- Product profitability report

## Restricted Actions

- Production module enabled na ho to manufacturing assumptions apply nahi karna.
- Stock movements unauthorized execute nahi karna.

## Example

"Current collection mein kaun se sizes overstocked hain aur kaun se understocked?"

---

# AGENT 24 — GEFLOW IT HARDWARE AGENT

**Agent ID:** AGT-024  
**Category ID:** CAT-024  
**Target:** Computer & IT Hardware  
**Primary Model:** Retail + Optional Assembly/Repair

## Mission

Computer components, hardware inventory, serial/warranty records aur PC assembly costing support karna.

## Main Responsibilities

- Component stock monitor karna.
- Serial-number tracking summarize karna.
- Warranty information retrieve karna.
- Component compatibility records check karna.
- PC assembly ke liye BOM costing calculate karna.
- Missing assembly components identify karna.
- Repair-related spare parts track karna.
- Product profitability calculate karna.

## Allowed Tools

- IT inventory read
- Serial/warranty read
- Compatibility records read
- BOM calculator
- Assembly draft
- Purchase draft
- Product margin report

## Restricted Actions

- Unsupported hardware compatibility invent nahi karna.
- Assembly order bina required authorization finalize nahi karna.
- Serial-number history overwrite nahi karna.

## Example

"Is PC build ki total component cost kya hai aur selected selling price par gross margin kitna hai?"

---

# AGENT 25 — GEFLOW MOBILE SHOP AGENT

**Agent ID:** AGT-025  
**Category ID:** CAT-025  
**Target:** Mobile Phones & Telecommunication  
**Primary Model:** Device Retail + Optional Services

## Mission

Mobile devices, accessories, IMEI/serial records, warranty aur mobile-shop profitability ko support karna.

## Main Responsibilities

- Device stock monitor karna.
- IMEI/serial records authorized scope mein retrieve karna.
- Device variants compare karna.
- Warranty aur returns summarize karna.
- Accessories ki inventory manage karne mein assist karna.
- Purchase/sale margins calculate karna.
- Low-stock accessories identify karna.
- Optional repair-service records summarize karna.

## Allowed Tools

- Device inventory read
- Serial/IMEI read, where authorized
- Warranty read
- Sales analytics
- Reorder draft
- Product margin report

## Restricted Actions

- Unauthorized device identifiers expose nahi karna.
- Telecom services ki unavailable integrations ka claim nahi karna.
- Device records cross-tenant share nahi karna.

## Example

"Kaun se mobile models ki available quantity aur recorded margin sab se kam hai?"

---

# AGENT 26 — GEFLOW ELECTRONICS AGENT

**Agent ID:** AGT-026  
**Category ID:** CAT-026  
**Target:** Electronics & Gadgets  
**Primary Model:** Retail + Optional Services

## Mission

Electronics inventory, serial tracking, warranties, product bundles aur optional repair operations support karna.

## Main Responsibilities

- Electronics inventory monitor karna.
- Serial-number records retrieve karna.
- Warranty status summarize karna.
- Product bundle costing calculate karna.
- Supplier prices compare karna.
- Sales trends analyze karna.
- Slow-moving inventory identify karna.
- Repair-related stock records summarize karna.

## Allowed Tools

- Electronics inventory read
- Warranty read
- Bundle-cost calculator
- Sales analytics
- Reorder draft
- Profitability report

## Restricted Actions

- Unsupported compatibility claims generate nahi karna.
- Warranty claims independently approve nahi karna.

## Example

"Is electronics bundle mein har item ki recorded cost aur total gross margin calculate karo."

---

# AGENT 27 — GEFLOW GROCERY AGENT

**Agent ID:** AGT-027  
**Category ID:** CAT-027  
**Target:** Grocery Store & Minimart  
**Primary Model:** Retail + Perishable Inventory

## Mission

Grocery stock, expiry, perishable inventory, purchasing aur product-level profitability support karna.

## Main Responsibilities

- Fast-moving products identify karna.
- Expiry alerts generate karna.
- Dairy, bread aur fresh food stock monitor karna.
- Waste aur spoilage costs report karna.
- Purchase quantities recommend karna.
- Supplier cost changes identify karna.
- Reorder levels monitor karna.
- Weight-based product sales analyze karna.
- Grocery margins calculate karna.

## Allowed Tools

- Grocery inventory read
- Batch/expiry read
- Waste report
- Purchase history read
- Reorder draft
- Product margin report

## Restricted Actions

- Expired products ko available-to-sell stock ke taur par recommend nahi karna.
- Valid product-weight conversions bypass nahi karna.

## Example

"Kal ke sales trend aur expiry dates ko dekhte hue kaun se dairy products ko priority deni chahiye?"

---

# AGENT 28 — GEFLOW SUPERMARKET AGENT

**Agent ID:** AGT-028  
**Category ID:** CAT-028  
**Target:** Supermarket & Hypermarket  
**Primary Model:** Multi-Department Retail

## Mission

High-volume retail operations, departments, inventory replenishment, expiry aur multi-location stock management support karna.

## Main Responsibilities

- Department-wise sales analyze karna.
- Warehouse aur store stock compare karna.
- Stock transfers recommend karna.
- Reorder quantities calculate karna.
- Expiry aur wastage report karna.
- Promotions ke performance metrics analyze karna.
- Supplier pricing compare karna.
- High-volume stock discrepancies identify karna.
- Category-level profitability report karna.

## Allowed Tools

- Department inventory read
- Multi-location inventory read
- Transfer draft
- Sales analytics
- Expiry report
- Reorder draft
- Category profitability report

## Restricted Actions

- Authorized approval ke baghair warehouse transfer finalize nahi karna.
- Cross-department permissions bypass nahi karna.
- Restricted inventory adjustments execute nahi karna.

## Example

"Kaun se departments mein stock overstocked hai aur kin departments ko replenishment chahiye?"

---

# AGENT 29 — GEFLOW PHARMACY AGENT

**Agent ID:** AGT-029  
**Category ID:** CAT-029  
**Target:** Pharmacy & Health Store  
**Primary Model:** Regulated Retail

## Mission

Pharmacy inventory, batch/expiry tracking, medicine availability aur purchasing workflows ko authorized operational scope mein support karna.

## Main Responsibilities

- Batch-wise stock monitor karna.
- Expiry alerts generate karna.
- Purchase history analyze karna.
- Medicine inventory availability summarize karna.
- Supplier price comparison karna.
- Stock shortages identify karna.
- Batch-level traceability support karna.
- Product returns aur adjustments report karna.
- Reorder recommendations generate karna.
- Applicable restricted-product workflows ke controls respect karna.

## Allowed Tools

- Pharmacy inventory read
- Batch/expiry read
- Supplier records read
- Purchase history read
- Reorder draft
- Inventory discrepancy report

## Restricted Actions

- Unauthorized prescription workflows execute nahi karna.
- Medical diagnosis ya personalized treatment ko inventory agent ki authority ke taur par provide nahi karna.
- Regulatory restrictions bypass nahi karna.
- Restricted records unauthorized expose nahi karna.

## Example

"Kaun se medicine batches expiry ke qareeb hain aur unki available quantities kya hain?"

Agent verified batch records se answer dega.

---

# SECTION 7 — SHARED AGENT CAPABILITIES

## 7.1 Shared Infrastructure, Separate Intelligence

Har agent ke liye separate codebase banana zaroori nahi.

Lekin har agent ka separate:
- Identity
- Configuration
- Instructions
- Scope
- Allowed tools
- Version
- Business context
- Evaluation suite

hona zaroori hai.

Common capabilities reusable services ke taur par provide ki ja sakti hain.

### Shared Service 1 — Inventory Query Service

Inventory information read karega, provided agent ko required access ho.

### Shared Service 2 — Cost Calculation Service

Approved costing methods aur business-specific configuration use karke calculations karega.

### Shared Service 3 — Sales Analytics Service

Authorized sales aur reporting data retrieve karega.

### Shared Service 4 — Purchase Draft Service

Allowed workflows ke liye purchase drafts create karega.

### Shared Service 5 — Recipe/BOM Service

Sirf recipe/production-enabled categories ke liye available hoga.

### Shared Service 6 — Audit Service

Agent actions, approvals aur important configuration changes record karega.

### Shared Service 7 — Notification Service

Approved alerts aur reminders deliver karega.

**Shared service ka matlab shared authority nahi.** Har tool call ke waqt agent, organization aur user permissions validate hongi.

---

# SECTION 8 — AGENT TOOLS AND ACTION PERMISSIONS

## 8.1 Tool Permission Levels

Har agent tool ko explicit permission level assign karo.

### Level 0 — No Access

Agent tool use nahi kar sakta.

### Level 1 — Read

Agent authorized information retrieve kar sakta hai.

### Level 2 — Analyze

Agent retrieved data par calculations aur reports generate kar sakta hai.

### Level 3 — Draft

Agent proposed changes create kar sakta hai, lekin operational records finalize nahi karega.

### Level 4 — Execute With Approval

Agent action prepare karega; authorized user approval ke baad backend execute karega.

### Level 5 — Restricted Automatic Execution

Sirf explicitly approved low-risk actions automatically execute ho sakte hain.

Examples:
- Authorized report generate karna.
- Low-stock notification create karna.
- Approved thresholds ke andar predefined reminders schedule karna.

Purchase orders, supplier payments, stock write-offs, refunds, high-value adjustments aur other consequential operations ko default taur par approval controls ke andar rakho.

## 8.2 Agent Tools Ka Example

Cafe Agent ke liye:

| Tool | Permission |
|---|---|
| Read Cafe Inventory | Read |
| Read Cafe Recipes | Read |
| Calculate Recipe Cost | Analyze |
| Generate Cafe Report | Analyze |
| Create Purchase Draft | Draft |
| Update Recipe | Approval required |
| Submit Purchase Order | Approval required |
| Record Waste Adjustment | Approval required |
| Modify Inventory Balance Directly | Not allowed |

Tool permissions backend par enforce hongi, sirf agent instructions mein nahi.

---

# SECTION 9 — BUSINESS CATEGORY AUR AGENT CONFIGURATION

## 9.1 Existing Business Categories Page

Current Business Categories page ko replace nahi karna.

Existing layout, columns, actions aur visual design preserve karne hain.

Agar agent management visible karna required ho, to existing design system ko follow karte hue minimal additional information ya separate authorized configuration page add kiya ja sakta hai.

Lekin bina approval existing page ko redesign nahi karna.

### Agent Assignment Behaviour

Jab organization CAT-019 choose kare:

1. Existing business category selection save ho.
2. Backend category ID validate kare.
3. AGT-019 registry se retrieve ho.
4. Agent ka active approved version load ho.
5. Organization-scoped execution context initialize ho.
6. Cafe agent ke authorized tools enable hon.
7. Restaurant-only tools unavailable rahen.

Agar organization ki category change hoti hai, to assignment ko controlled migration process se update karo.

Category change karne se old data delete ya rewrite nahi hona chahiye.

---

# SECTION 10 — AGENT MANAGEMENT ADMIN ARCHITECTURE

## 10.1 Admin Management Capabilities

Admin ko agents ki configuration aur operational status manage karne ke liye controlled interface chahiye.

Recommended logical sections:

1. Agent Registry
2. Agent Details
3. Category Assignment
4. Agent Instructions/Configuration
5. Tool Permissions
6. Agent Versions
7. Test Results
8. Deployment Status
9. Error Logs
10. Usage Metrics
11. Audit Logs

Ye recommended capabilities hain, existing UI mein mandatory redesign nahi.

## 10.2 Agent Registry

Registry mein:
- Agent ID
- Agent Name
- Category
- Current Version
- Status
- Last Updated
- Test Status
- Assigned Organizations Count

show kiya ja sakta hai.

## 10.3 Agent Configuration

Authorized admin configure kar sakta hai:
- Category-specific instructions
- Allowed tools
- Business model support
- Reporting scope
- Approval policies
- Knowledge references
- Feature flags

Lekin configuration changes ko versioned aur audited hona chahiye.

## 10.4 Agent Versioning

Example:

AGT-019:
- Version 1.0 — Initial Cafe Agent
- Version 1.1 — Improved recipe-cost calculations
- Version 1.2 — Added beverage-size variants
- Version 1.3 — Improved waste reporting

New version ko test kiye baghair production par directly activate nahi karna.

## 10.5 Agent Pause and Rollback

Agar agent unexpected behaviour show kare:

1. Agent ko pause kiya ja sake.
2. Existing GeFlow manual workflows operational rahen.
3. Previous approved agent version restore kiya ja sake.
4. Error logs inspect kiye ja saken.
5. Affected transactions audit kiye ja saken.

Agent pause karne se existing inventory ya POS disable nahi hona chahiye.

---

# SECTION 11 — DATA MODEL REQUIREMENTS

Implementation se pehle existing database inspect karo. Agar equivalent tables already exist karti hain, to unnecessary duplicates create na karo.

Neeche logical entities ki recommended list hai.

## 11.1 Agent Registry

`business_ai_agents`

Purpose:
- 29 agent definitions maintain karna.

Suggested fields:
- id
- agent_code
- category_id
- name
- description
- current_version
- status
- created_at
- updated_at

## 11.2 Agent Versions

`business_ai_agent_versions`

Purpose:
- Har agent ki version history maintain karna.

Suggested fields:
- id
- agent_id
- version
- configuration
- instructions_reference
- tool_policy
- test_status
- release_status
- created_at
- approved_at

## 11.3 Organization Agent Assignments

`organization_agent_assignments`

Purpose:
- Business organization ko correct category agent assign karna.

Suggested fields:
- id
- organization_id
- category_id
- agent_id
- agent_version
- status
- assigned_at

Required constraint:
- Organization ki category aur assigned agent ka mapping valid hona chahiye.

## 11.4 Agent Tool Permissions

`business_ai_agent_tool_permissions`

Purpose:
- Agent-level tool access manage karna.

Suggested fields:
- id
- agent_id
- tool_id
- permission_level
- enabled
- approval_required
- policy_version

## 11.5 Agent Execution Records

`business_ai_agent_runs`

Purpose:
- Agent executions ka traceable record maintain karna.

Suggested fields:
- id
- organization_id
- agent_id
- agent_version
- initiating_user_id
- request_type
- status
- started_at
- completed_at
- error_code

Sensitive user content ko logs mein unnecessary store nahi karna.

## 11.6 Agent Action Records

`business_ai_agent_actions`

Purpose:
- Tool calls aur consequential actions track karna.

Suggested fields:
- id
- run_id
- tool_id
- action_type
- target_record_id
- authorization_result
- approval_status
- execution_status
- idempotency_key
- created_at

## 11.7 Agent Audit Logs

`business_ai_agent_audit_logs`

Purpose:
- Configuration changes, permission changes aur important actions record karna.

Suggested fields:
- id
- actor_id
- actor_type
- organization_id
- agent_id
- event_type
- before_reference
- after_reference
- reason
- created_at

Actual schema existing database conventions aur security architecture ke mutabiq finalize karna.

---

# SECTION 12 — AGENT KNOWLEDGE ARCHITECTURE

## 12.1 Har Agent Ki Knowledge Configuration Separate Hogi

Cafe Agent ko cafe-specific operational documentation milni chahiye.

Restaurant Agent ko restaurant-specific workflows milne chahiye.

Pharmacy Agent ko pharmacy inventory aur applicable operational policies milni chahiye.

Lekin knowledge sources ko carefully control karna hoga.

### Agent Knowledge Sources

- Approved category documentation
- Category-specific workflow definitions
- Authorized business records
- Existing module documentation
- Product and inventory schemas
- Business-specific configuration
- Approved SOPs
- Relevant calculation rules

### Business-Specific Knowledge

Agar cafe owner apni chai ki recipe configure karta hai, to AGT-019 us recipe ko authorized business context mein use kar sakta hai.

Lekin doosre cafe ki private recipe automatically access nahi kar sakta.

### Knowledge Separation

Har agent ko sirf uski approved knowledge sources retrieve karne ki permission honi chahiye.

Agar future mein vector search ya RAG system add ho, to retrieval queries mein organization, category, permission aur document scope enforce karna hoga.

Sirf prompt mein "private data reveal mat karo" likhna sufficient nahi.

---

# SECTION 13 — AI AGENT ACTION SAFETY

## 13.1 Read Actions Aur Write Actions Separate Rakho

Read action:
- Stock check
- Sales report
- Recipe cost calculation

Write action:
- Recipe update
- Purchase order creation
- Stock adjustment
- Waste record
- Supplier payment

Read-only actions relatively low risk ho sakte hain, lekin unke liye bhi data authorization required hai.

Write actions ke liye validation aur approval policies apply hongi.

## 13.2 Consequential Action Workflow

Example: Cafe Agent purchase draft create karta hai.

1. Agent required ingredients identify karta hai.
2. Authorized inventory data retrieve karta hai.
3. Reorder quantity calculate karta hai.
4. Purchase draft create karta hai.
5. User draft review karta hai.
6. User approval deta hai.
7. Backend final validation karta hai.
8. Purchase workflow execute hota hai.
9. Audit log record hota hai.

Agent ko direct database update ka unrestricted access nahi milna chahiye.

## 13.3 Idempotency

Agar ek tool call retry ho jaye, to duplicate purchase order, duplicate stock deduction ya duplicate waste record create nahi hona chahiye.

Relevant actions ke liye idempotency keys aur duplicate-event protection use karo.

---

# SECTION 14 — IMPLEMENTATION ROADMAP: EXACT SEQUENCE

Ye woh sequence hai jise follow karte hue system complete karna chahiye.

## STEP 1 — Existing Application Audit

Inspect:
- Business Categories
- Product Categories
- UoM
- Purchase
- Inventory
- POS
- Reports
- Authentication
- Permissions
- Existing AI integrations
- Database schema

Deliverable:
- Existing Architecture Audit
- Existing Feature Inventory
- Known Risks List
- Dependency Map

## STEP 2 — Freeze Existing UI and Behaviour

Record:
- Existing page layouts
- Existing navigation
- Existing component behaviour
- Existing APIs
- Existing data flows

Deliverable:
- UI/Workflow Baseline
- Regression Test Checklist

## STEP 3 — Finalize the 29-Agent Registry

All 29 agent IDs, category mappings, scope and initial capabilities define karo.

Deliverable:
- Agent Registry
- Category-to-Agent Mapping
- Agent Scope Definitions

## STEP 4 — Finalize the Common Agent Contract

Define:
- Request format
- Response format
- Agent identity
- Organization context
- Tool invocation format
- Error handling
- Approval workflow
- Audit format

Deliverable:
- Agent Contract Specification

## STEP 5 — Design Authorization and Isolation

Implement:
- Organization scoping
- Category scoping
- Agent tool permissions
- User role checks
- Cross-tenant isolation
- Cross-agent denial by default

Deliverable:
- Authorization Policy
- Security Test Plan

## STEP 6 — Implement Agent Registry Backend

Create or extend:
- Agent registry
- Agent version records
- Category assignment
- Tool permission configuration

Deliverable:
- Registry APIs
- Data constraints
- Registry tests

## STEP 7 — Implement the Agent Runtime

Runtime ko:
- Correct agent load karna
- Correct configuration use karna
- Authorized tools expose karna
- Timeouts handle karna
- Errors safely return karna
- Execution records maintain karna

Deliverable:
- Shared Agent Runtime

## STEP 8 — Implement Tool Gateway

All business actions ko controlled tool APIs ke through route karo.

Deliverable:
- Read tools
- Calculation tools
- Draft tools
- Approval-gated execution tools

## STEP 9 — Implement Business Category Contexts

29 category-specific configurations create karo.

Deliverable:
- Category instructions
- Category-specific allowed tools
- Category-specific workflow definitions
- Category-specific prohibited actions

## STEP 10 — Implement Cafe Agent First

Cafe agent ko pilot ke taur par use karo, kyunki is category mein inventory, recipes, purchases aur POS ka connection clearly test ho sakta hai.

Deliverable:
- AGT-019
- Cafe-specific tools
- Recipe-cost workflow
- Ingredient consumption workflow
- Cafe regression tests

## STEP 11 — Implement Restaurant Agent Separately

Cafe agent ko copy karke sirf naam change nahi karna.

Restaurant agent ko restaurant-specific workflow aur independently configured permissions do.

Deliverable:
- AGT-021
- Restaurant-specific workflows
- Dine-in/kitchen context, where supported
- Restaurant-specific tests

## STEP 12 — Implement Bakery and Fast Food Agents

Deliverables:
- AGT-018
- AGT-020
- Batch production/combos ke relevant workflow tests

## STEP 13 — Implement Remaining 25 Agents

Har agent ko uski defined scope, tools aur restrictions ke mutabiq configure aur test karo.

Recommended sequence:
- Retail and wholesale
- Agriculture and specialized retail
- Service and repair
- Construction and project-based businesses
- Apparel and footwear
- Electronics and IT
- Grocery and supermarket
- Pharmacy

Sequence implementation priority hai; permanent agent identity ya permission hierarchy nahi.

## STEP 14 — Add Admin Configuration Capabilities

Authorized admin ke liye:
- Agent status
- Version management
- Tool permissions
- Assignment
- Test status
- Audit logs

Deliverable:
- Controlled Agent Management Interface

## STEP 15 — Connect Agents to Existing GeFlow UI

Existing UI ke andar appropriate entry points use karo.

Layout redesign nahi karna.

Deliverable:
- Existing pages ke saath safe integration
- No duplicated business modules
- No broken navigation

## STEP 16 — Add Monitoring and Audit

Monitor:
- Failed runs
- Unauthorized tool attempts
- Tool errors
- Agent response latency
- Token/usage costs
- Action approval outcomes

Deliverable:
- Agent operational monitoring

## STEP 17 — Run Security and Regression Tests

Test:
- Cross-tenant isolation
- Cross-category isolation
- Unauthorized actions
- Duplicate tool calls
- Agent version rollback
- Existing POS workflows
- Existing purchases
- Existing inventory
- Existing authentication

Deliverable:
- Security Test Report
- Regression Test Report

## STEP 18 — Staged Release

Pehle test environment mein release karo.

Phir limited internal/business pilot.

Uske baad monitored production rollout.

Deliverable:
- Release Checklist
- Rollback Plan
- Production Verification

---

# SECTION 15 — AGENT TESTING MATRIX

Har agent ke liye minimum following test categories required hongi.

## Test A — Correct Category

Agent apni assigned category ke workflows correctly handle kare.

## Test B — Wrong Category

Agent doosri category ka restricted task execute na kare.

## Test C — Same Category, Different Organization

Restaurant A ka agent context Restaurant B ka private data access na kar sake.

## Test D — Unauthorized Tool

Agent restricted tool call kare to backend deny kare.

## Test E — Unauthorized User

Aisa user jiske paas required role nahi, woh restricted action execute na kar sake.

## Test F — Incorrect Data

Missing ya inconsistent inventory records par agent unsupported calculations na kare.

## Test G — Duplicate Execution

Retry se duplicate stock movement ya purchase order create na ho.

## Test H — Historical Records

Recipe ya agent configuration update hone se historical business records incorrectly rewrite na hon.

## Test I — Rollback

New agent version fail ho to previous approved version restore ki ja sake.

## Test J — Existing System

Agent rollout ke baad existing GeFlow workflows same expected behaviour maintain karein.

---

# SECTION 16 — SYSTEM KO PARTS MEIN DIVIDE KARNE KA UPDATE ROADMAP

Ab jab initial architecture implement ho jayegi, future changes ko isolated parts mein manage karna hai.

Har issue ko ek hi waqt mein poore system par apply nahi karna.

## UPDATE PART 1 — Agent Registry and Mapping

Scope:
- New category-agent mapping
- Agent status
- Agent versions
- Registry validation

Tests:
- Correct agent mapping
- Invalid mapping rejection
- Existing category records unchanged

## UPDATE PART 2 — Agent Security

Scope:
- Organization isolation
- Category isolation
- Tool authorization
- Role checks

Tests:
- Cross-tenant denial
- Cross-agent denial
- Unauthorized write denial

## UPDATE PART 3 — Agent Runtime

Scope:
- Agent loading
- Configuration
- Error handling
- Execution records

Tests:
- Correct agent version
- Timeout handling
- Safe failure

## UPDATE PART 4 — Inventory Intelligence

Scope:
- Stock analysis
- Low-stock detection
- Inventory reporting
- Stock discrepancy analysis

Tests:
- Correct quantities
- Correct business scope
- No unauthorized modifications

## UPDATE PART 5 — Purchasing Intelligence

Scope:
- Purchase history analysis
- Supplier comparison
- Reorder recommendations
- Purchase drafts

Tests:
- No duplicate purchase orders
- Correct supplier data
- Approval required where configured

## UPDATE PART 6 — Recipe and Costing Intelligence

Scope:
- Recipe calculations
- Ingredient cost
- Recipe versions
- Gross margin

Tests:
- Correct unit conversion
- Correct cost calculation
- Historical records preserved

## UPDATE PART 7 — POS and Sales Intelligence

Scope:
- Sales analysis
- Product performance
- Menu profitability
- Order-related tools

Tests:
- Correct sale totals
- No duplicate stock deduction
- Correct category scope

## UPDATE PART 8 — Production and Batch Operations

Scope:
- Bakery batches
- Restaurant preparation
- Fast-food combos
- Intermediate components

Tests:
- Correct ingredient consumption
- Correct finished-goods output
- No double-counting

## UPDATE PART 9 — Service and Job Costing

Scope:
- Salon services
- Vehicle repair jobs
- Installation projects
- Labour and consumable costs

Tests:
- Correct job costing
- Correct material consumption
- Correct service profitability

## UPDATE PART 10 — Specialized Inventory

Scope:
- Expiry
- Serial numbers
- IMEI
- Warranty
- Variant-level inventory

Tests:
- Correct item identification
- Authorized access
- Accurate traceability

## UPDATE PART 11 — Reports and Analytics

Scope:
- Agent-generated reports
- Category-specific metrics
- Margin reports
- Inventory forecasts

Tests:
- Correct calculations
- Correct date ranges
- Historical consistency

## UPDATE PART 12 — Agent Administration

Scope:
- Agent versions
- Permission changes
- Deployment status
- Rollback

Tests:
- Audit logs
- Unauthorized configuration changes
- Version integrity

## UPDATE PART 13 — Usage, Reliability and Cost Control

Scope:
- Agent execution limits
- Error monitoring
- Usage analytics
- AI provider costs

Tests:
- Rate limits
- Failure handling
- No duplicate billable execution where idempotency is required

## UPDATE PART 14 — Continuous Improvement

Scope:
- Agent evaluations
- Accuracy improvements
- Prompt/configuration updates
- Tool improvements

Tests:
- Before/after evaluation
- Regression tests
- Controlled release

---

# SECTION 17 — ISSUE-BY-ISSUE DEVELOPMENT PROCESS

Jab bhi koi bug, missing feature ya improvement identify ho, ye workflow follow karo.

### Step 1 — Issue Identification

Issue ko clearly describe karo.

Example:
"Cafe Agent recipe cost report mein milk ki quantity wrong calculate kar raha hai."

### Step 2 — Identify the Responsible Layer

Determine karo issue kis layer mein hai:
- Agent instructions
- Tool permissions
- Recipe calculation
- Inventory data
- Unit conversion
- Database
- Existing UI

### Step 3 — Determine the Affected Agent

Example:
AGT-019.

Agar common tool issue hai jo multiple agents use karte hain, to affected agents ki list identify karo.

### Step 4 — Inspect Existing Implementation

Actual code, API aur database behaviour inspect karo.

Assumption ke basis par new implementation create nahi karni.

### Step 5 — Define Expected Behaviour

Example:
150 ml milk, cost PKR 200 per litre ho, to expected milk cost PKR 30 honi chahiye.

### Step 6 — Implement Minimum Safe Change

Sirf relevant component ya tool modify karo.

Unrelated agent configurations change nahi karni.

### Step 7 — Unit Tests

Calculation ya business logic ka test run karo.

### Step 8 — Agent Tests

Verify karo ke agent tool ko correctly use karta hai.

### Step 9 — Regression Tests

Check karo ke common tool change se doosre agents aur existing workflows break nahi hue.

### Step 10 — Staged Release

Test environment → limited rollout → production.

### Step 11 — Monitor

Errors, action failures aur output quality inspect karo.

### Step 12 — Update Documentation

Issue, fix, affected versions aur test results record karo.

**Rule:** Har issue ka clear scope, owner, test plan aur rollback option hona chahiye.

---

# SECTION 18 — AGENT PERFORMANCE METRICS

Har agent ki quality ko sirf response speed ya user satisfaction se measure nahi karna.

Category-specific metrics define karo.

### Common Metrics

- Correct agent routing rate
- Unauthorized action denial rate
- Tool-call success rate
- Calculation accuracy
- Failed execution rate
- Average response time
- Cost per execution
- User correction rate
- Approval rejection rate

### Category-Specific Examples

Cafe Agent:
- Recipe-cost accuracy
- Ingredient usage calculation accuracy
- Menu-margin accuracy

Wholesale Agent:
- Unit-conversion accuracy
- Order-profitability accuracy
- Stock-availability accuracy

Bakery Agent:
- Production-yield calculation accuracy
- Batch-cost accuracy
- Finished-goods reconciliation

Pharmacy Agent:
- Batch identification accuracy
- Expiry reporting accuracy
- Restricted-action denial accuracy

Performance thresholds production release se pehle define karne honge.

---

# SECTION 19 — WHAT WE MUST NOT DO

1. 29 agents ko ek generic chatbot mein merge nahi karna.
2. Sirf agent name change karke same generic configuration reuse nahi karni.
3. Agent prompts ko authorization ka replacement nahi banana.
4. Har agent ko unrestricted database access nahi dena.
5. Existing POS ya inventory modules duplicate nahi karne.
6. Purchase items ko automatically sellable products nahi banana.
7. Recipe-based businesses ko simple retail logic mein force nahi karna.
8. Agent configuration change se historical transactions overwrite nahi karne.
9. Shared tool change ko bina regression testing sab agents par release nahi karna.
10. Existing UI layouts ko bina requirement redesign nahi karna.
11. AI-generated estimates ko verified accounting facts ke taur par present nahi karna.
12. High-impact business actions ko approval aur audit controls ke baghair execute nahi karna.
13. Category change hone par old records delete nahi karne.
14. Test environment mein verify kiye baghair production agent update nahi karna.
15. Fake inventory, sales ya profit data ko real business data ke taur par show nahi karna.

---

# SECTION 20 — FINAL COMPLETION CHECKLIST

System ko complete tab consider karna jab following conditions meet hon.

## Agent Architecture

- [ ] All 29 agent definitions registered.
- [ ] All 29 Category IDs correctly mapped.
- [ ] Har agent ka separate configuration aur version history.
- [ ] Agent-to-category mapping server-side validated.
- [ ] Same-category businesses ka data isolated.
- [ ] Cross-category execution denied by default.

## Business Functionality

- [ ] Har agent ki category-specific responsibilities documented.
- [ ] Allowed tools correctly configured.
- [ ] Restricted tools denied.
- [ ] Category-specific reports available.
- [ ] Relevant existing GeFlow modules integrated.
- [ ] Recipe/production workflows appropriate categories mein supported.

## Security

- [ ] Organization-level access control.
- [ ] Role-level authorization.
- [ ] Tool-level authorization.
- [ ] Audit logs.
- [ ] Idempotency.
- [ ] Safe failure handling.
- [ ] Agent version rollback.

## Existing System Protection

- [ ] Existing layouts preserved.
- [ ] Existing POS verified.
- [ ] Existing Purchase verified.
- [ ] Existing Inventory verified.
- [ ] Existing UoM verified.
- [ ] Existing category management verified.
- [ ] Existing reports verified.
- [ ] Existing authentication and permissions verified.
- [ ] No duplicate operational databases introduced.

## Deployment

- [ ] All agents pass their evaluation suites.
- [ ] Regression tests pass.
- [ ] Security tests pass.
- [ ] Rollback plan documented.
- [ ] Production monitoring active.
- [ ] Documentation updated.

---

# FINAL IMPLEMENTATION ORDER

Ye final master sequence hai. Isi order mein development ko manage karna hai.

1. Existing GeFlow application audit.
2. Existing UI aur functionality baseline freeze.
3. Existing database aur API contracts inspect.
4. 29-agent registry finalize.
5. Category-to-agent mapping define.
6. Agent contract aur runtime specification finalize.
7. Organization-level and category-level authorization implement.
8. Agent registry backend implement.
9. Agent versioning implement.
10. Shared tool gateway implement.
11. Agent execution and audit logging implement.
12. Agent configuration framework implement.
13. Cafe Agent (AGT-019) pilot implement.
14. Cafe Agent calculations and workflows test.
15. Restaurant Agent (AGT-021) separately implement.
16. Bakery Agent (AGT-018) implement.
17. Fast Food Agent (AGT-020) implement.
18. Remaining 25 agents category-wise implement.
19. Existing GeFlow UI ke saath controlled integration.
20. Admin agent-management capabilities implement.
21. Agent security and cross-tenant isolation tests.
22. Existing POS, Purchase, Inventory aur UoM regression tests.
23. Agent-specific evaluation suites run.
24. Staged deployment.
25. Production monitoring.
26. Issue-by-issue improvement cycle start.
27. Har future update ke saath tests, documentation aur rollback maintain.

# FINAL DEVELOPMENT RULE

**GeFlow AI ke 29 specialized agents existing platform ko operate aur enhance karengi; woh existing platform ko replace nahi karengi.**

Har category ka agent apni category ki intelligence, configuration aur authorized tools use karega. Shared infrastructure duplication ko reduce karegi, lekin agent identities, business contexts aur permissions separate rahengi.

Implementation ka first objective 29 agents ko ek saath production mein activate karna nahi hai.

First objective hai architecture ko correctly establish karna, ek category par end-to-end verify karna, phir controlled sequence mein remaining agents ko add karna.

Is approach se GeFlow ke existing finalized layouts aur workflows protected rahenge, business-specific functionality add hogi aur future updates ko manage karna significantly easier hoga.