# STEP 14 — CAFE AGENT (AGT-019) CALCULATIONS & WORKFLOWS TESTING
## GeFlow AI — Specialized Agent Pilot Validation

**Agent:** AGT-019 — Cafe & Coffee Shop Agent  
**Category:** CAT-019 — Cafe & Coffee Shop  
**Project:** GeFlow AI  
**Testing Type:** Functional, Calculation, Integration, Security and Workflow Testing  
**Objective:** Verify the mathematical accuracy, business-data correctness, workflow execution, authorization, and reliability of the Cafe Agent implemented in Step 13.

---

# 1. CRITICAL TESTING INSTRUCTIONS

You are working on the existing GeFlow AI application.

This step is strictly for testing and validation of AGT-019.

Before testing, inspect the actual implementation of:

- AGT-019 registration and activation.
- Cafe-specific configuration.
- Agent configuration schema.
- Active agent configuration version.
- Agent execution engine.
- Shared Tool Gateway.
- Execution and audit logging.
- Organization and category authorization.
- Existing product and variant management.
- UoM system.
- Recipe/BOM functionality, if available.
- Inventory and stock management.
- Purchasing and supplier management.
- POS and billing.
- Sales reporting.
- Existing automated tests.

Do not assume Step 13 was successfully implemented.

Obtain and inspect its actual completion report, code changes, migrations, and test results where available.

### Dependency rule

If AGT-019 is not implemented or its required infrastructure is missing:

1. Report the exact blocker.
2. Do not invent test results.
3. Do not create mock implementations that pretend to be production functionality.
4. Do not silently implement missing features.
5. Request authorization before expanding the scope.

**Testing must evaluate the actual implemented GeFlow application, not an imagined version of it.**

---

# 2. TESTING OBJECTIVES

Verify the following:

1. Menu and product calculations.
2. Product variant calculations.
3. Recipe ingredient calculations.
4. Ingredient unit conversions.
5. Recipe cost calculations.
6. Selling price and gross profit calculations.
7. Gross margin calculations.
8. Inventory consumption calculations.
9. Stock availability calculations.
10. Sales and revenue calculations.
11. Purchase cost calculations.
12. Supplier price comparisons, where supported.
13. Waste and wastage calculations, where supported.
14. Multi-product and multi-variant calculations.
15. Date-range reporting.
16. Workflow execution through the Shared Tool Gateway.
17. Organization and category isolation.
18. Approval and write-operation controls.
19. Execution history and audit records.
20. Error handling and calculation consistency.

All results must be compared with independently calculated expected values.

---

# 3. TEST DATA REQUIREMENTS

Use an isolated test organization or approved development environment.

Do not create test records inside real customer organizations.

Use deterministic test fixtures with known values.

If an existing test-data framework is available, use it.

If test records must be created, clearly identify them as test records and ensure they cannot affect real business reports.

### Sample cafe test dataset

Use the following controlled dataset only if equivalent test records do not already exist.

#### A. Menu products

| Product | Variant | Selling Price |
|---|---|---:|
| Cappuccino | Small | $3.00 |
| Cappuccino | Medium | $4.00 |
| Cappuccino | Large | $5.00 |
| Latte | Small | $3.50 |
| Latte | Medium | $4.50 |
| Latte | Large | $5.50 |
| Americano | Regular | $2.50 |
| Iced Coffee | Regular | $4.00 |

Currency is illustrative. Use the actual currency and precision supported by the test organization.

#### B. Ingredient costs

| Ingredient | Unit | Cost per Unit |
|---|---|---:|
| Coffee Beans | kg | $20.00 |
| Milk | litre | $2.00 |
| Sugar | kg | $1.50 |
| Chocolate Powder | kg | $12.00 |
| Water | litre | $0.50 |

These are controlled test inputs, not actual GeFlow customer prices.

#### C. Sample Cappuccino Medium recipe

| Ingredient | Quantity | Unit |
|---|---:|---|
| Coffee Beans | 0.018 | kg |
| Milk | 0.150 | litre |
| Sugar | 0.010 | kg |
| Chocolate Powder | 0.005 | kg |

Expected ingredient cost:

- Coffee Beans: 0.018 × $20 = $0.36
- Milk: 0.150 × $2 = $0.30
- Sugar: 0.010 × $1.50 = $0.015
- Chocolate Powder: 0.005 × $12 = $0.06

**Expected total recipe cost = $0.735**

Apply the application's defined monetary rounding rules. For a two-decimal currency representation, the expected displayed cost is $0.74.

Do not round individual ingredient costs prematurely unless the existing costing policy explicitly requires it.

---

# 4. CALCULATION TESTING

## 4.1 Recipe Ingredient Cost

Verify:

Formula:

Ingredient Cost = Ingredient Quantity × Ingredient Unit Cost

Total Recipe Cost = Sum of All Ingredient Costs

Test:

- Single ingredient recipe.
- Multiple ingredient recipe.
- Decimal ingredient quantities.
- Zero quantity.
- Missing ingredient cost.
- Missing ingredient quantity.
- Invalid unit.
- Incompatible units.
- Ingredient cost changes.
- Different recipe sizes.

Expected behavior:

- Correct multiplication.
- Correct total.
- Correct precision.
- Missing data must be reported.
- Invalid inputs must not produce fabricated costs.

## 4.2 Gross Profit

Formula:

Gross Profit = Selling Price − Recipe Cost

Using Cappuccino Medium:

- Selling Price = $4.00
- Recipe Cost = $0.735

Expected Gross Profit = $3.265

For two-decimal presentation, expected display = $3.27.

Verify both raw calculation precision and displayed monetary precision according to GeFlow's existing rounding rules.

## 4.3 Gross Margin

Formula:

Gross Margin (%) = (Gross Profit ÷ Selling Price) × 100

Using Cappuccino Medium:

- Gross Profit = $3.265
- Selling Price = $4.00

Expected Gross Margin = 81.625%

For two-decimal presentation, expected display = 81.63%.

Test:

- Normal positive margin.
- Zero selling price.
- Selling price lower than recipe cost.
- Missing recipe cost.
- Negative or invalid input.
- Zero-cost product.

Do not divide by zero.

Do not confuse gross margin with markup.

## 4.4 Markup

Formula:

Markup (%) = (Gross Profit ÷ Recipe Cost) × 100

For Cappuccino Medium:

- Gross Profit = $3.265
- Recipe Cost = $0.735

Expected Markup ≈ 444.22%.

Ensure the agent does not confuse markup and gross margin.

## 4.5 Selling Price Recommendation

If a user requests a selling price based on a target gross margin:

Formula:

Recommended Selling Price = Recipe Cost ÷ (1 − Target Margin)

Example:

- Recipe Cost = $0.735
- Target Gross Margin = 60%

Expected price:

$0.735 ÷ 0.40 = $1.8375

Expected displayed price = $1.84 under conventional two-decimal rounding.

Test:

- 30% target margin.
- 50% target margin.
- 60% target margin.
- 75% target margin.
- Invalid target margin.
- 100% target margin.
- Above 100% target margin.

A target margin of 100% or greater is mathematically invalid for this formula. The agent must explain the issue rather than return an infinite or fabricated price.

This calculation excludes overhead and other non-recipe costs unless those costs are explicitly included in the input.

---

# 5. UOM & UNIT CONVERSION TESTING

Verify all calculations involving different measurement units.

Test conversions such as:

- kg to grams.
- grams to kg.
- litre to millilitres.
- millilitres to litre.
- Compatible units supported by the existing UoM system.

Example:

0.018 kg = 18 grams.

0.150 litre = 150 millilitres.

Requirements:

- Use actual GeFlow UoM conversion definitions.
- Respect base and parent UoM relationships.
- Validate conversion direction.
- Reject incompatible units.
- Avoid double conversion.
- Avoid precision loss.
- Never assume that two units are compatible just because their names look similar.

If the existing UoM system does not support a conversion, report it as unsupported.

Do not create a separate conversion engine for this testing step.

---

# 6. INVENTORY & RECIPE CONSUMPTION TESTING

Verify recipe-based ingredient consumption only where existing GeFlow functionality supports it.

Example:

A Cappuccino Medium requires:

- Coffee Beans: 0.018 kg
- Milk: 0.150 litre
- Sugar: 0.010 kg
- Chocolate Powder: 0.005 kg

If 10 Cappuccino Medium drinks are sold, expected ingredient consumption is:

| Ingredient | Per Drink | For 10 Drinks |
|---|---:|---:|
| Coffee Beans | 0.018 kg | 0.180 kg |
| Milk | 0.150 L | 1.500 L |
| Sugar | 0.010 kg | 0.100 kg |
| Chocolate Powder | 0.005 kg | 0.050 kg |

Verify:

- Correct recipe selection.
- Correct variant selection.
- Correct multiplication.
- Correct UoM conversion.
- Correct inventory deduction.
- Correct inventory ledger entry.
- Correct handling of cancelled sales.
- Correct handling of refunds and returns according to existing policies.
- No duplicate stock deduction.
- No duplicate inventory transaction during retries.

Do not deduct inventory simply because the agent calculates an expected consumption quantity.

Actual stock changes must happen through the existing authorized business workflow.

---

# 7. STOCK AVAILABILITY & PRODUCTION CAPACITY

Test how the agent calculates the number of products that can be produced from available ingredients.

Example:

Available inventory:

- Coffee Beans: 1 kg
- Milk: 5 litres
- Sugar: 1 kg
- Chocolate Powder: 0.5 kg

Cappuccino Medium recipe:

- Coffee Beans: 0.018 kg
- Milk: 0.150 litre
- Sugar: 0.010 kg
- Chocolate Powder: 0.005 kg

Theoretical production capacity per ingredient:

- Coffee Beans: floor(1 ÷ 0.018) = 55
- Milk: floor(5 ÷ 0.150) = 33
- Sugar: floor(1 ÷ 0.010) = 100
- Chocolate Powder: floor(0.5 ÷ 0.005) = 100

**Expected maximum production = 33 Cappuccino Medium drinks**, with milk as the limiting ingredient.

Test:

- One limiting ingredient.
- Multiple limiting ingredients.
- Zero available stock.
- Negative inventory, if existing policy allows it.
- Reserved stock.
- Damaged or unavailable stock.
- Different recipes.
- Different product sizes.
- Decimal stock quantities.

Use actual available-to-use stock definitions from GeFlow.

Do not assume on-hand stock equals available stock if reservations or other stock commitments exist.

Clearly label the result as theoretical production capacity, not a guarantee of actual production.

---

# 8. SALES & REVENUE CALCULATION TESTING

Use isolated test sales records.

Example:

| Product | Quantity | Unit Price |
|---|---:|---:|
| Cappuccino Medium | 10 | $4.00 |
| Latte Medium | 5 | $4.50 |
| Americano Regular | 8 | $2.50 |
| Iced Coffee Regular | 7 | $4.00 |

Expected revenue:

- Cappuccino: $40.00
- Latte: $22.50
- Americano: $20.00
- Iced Coffee: $28.00

**Expected total gross sales = $110.50**

Test:

- Product-wise sales.
- Variant-wise sales.
- Total quantity sold.
- Gross sales.
- Discounts.
- Net sales.
- Taxes.
- Refunds.
- Cancelled transactions.
- Date filters.
- Time-zone boundaries.
- Duplicate transaction protection.

Use GeFlow's actual definitions of gross sales, net sales, taxes and refunds.

Do not add taxes or discounts twice.

Do not assume a cancelled transaction is a completed sale.

Do not confuse revenue with profit.

---

# 9. PURCHASE & SUPPLIER WORKFLOW TESTING

Where existing GeFlow functionality supports these workflows, test:

- Supplier retrieval.
- Purchase history retrieval.
- Ingredient purchase cost.
- Purchase quantity.
- Purchase UoM.
- Supplier price comparison.
- Purchase status.
- Stock impact of completed purchases.

Example test:

| Supplier | Coffee Beans | Quantity |
|---|---:|---:|
| Supplier A | $20/kg | 5 kg |
| Supplier B | $22/kg | 5 kg |
| Supplier C | $19/kg | 5 kg |

Expected comparison:

- Lowest unit price: Supplier C.
- Highest unit price: Supplier B.
- Price difference between B and C: $3/kg.
- Difference for 5 kg: $15.

Ensure the agent compares equivalent units, currency and purchase conditions.

Do not recommend a supplier based only on price when relevant delivery, quality or other conditions are unavailable.

Do not automatically place or submit a purchase order during testing.

---

# 10. WASTAGE & INVENTORY VARIANCE TESTING

Test these calculations only if the existing GeFlow system records the required data.

### A. Wastage quantity

Wastage Quantity = Recorded Wasted Quantity

### B. Wastage cost

Wastage Cost = Wasted Quantity × Applicable Unit Cost

### C. Inventory variance

Inventory Variance = Actual Stock − Expected Stock

### D. Variance percentage

Variance (%) = (Actual Stock − Expected Stock) ÷ Expected Stock × 100

Test:

- Positive variance.
- Negative variance.
- Zero variance.
- Zero expected stock.
- Missing cost data.
- Different units.
- Damaged goods.
- Recorded wastage.

Do not calculate a variance percentage when expected stock is zero. Report it as undefined or not applicable.

Distinguish recorded wastage from estimated wastage.

Do not assume that all stock variance represents wastage.

---

# 11. MULTI-PRODUCT & MULTI-VARIANT TESTING

Verify that AGT-019 handles multiple products and sizes correctly.

Test scenarios:

1. Same product, multiple sizes.
2. Same product, different recipes.
3. Different products sharing ingredients.
4. Different product prices.
5. Different ingredient quantities.
6. Mixed units.
7. Bulk sales.
8. Multiple transactions.
9. Different tax and discount treatments.
10. Recipe updates between transactions.

The agent must use the correct product and variant references.

It must not apply a Small recipe to a Large drink.

It must not apply a product's selling price to another variant.

It must not mix recipe costs across unrelated products.

---

# 12. CAFE BUSINESS WORKFLOW TESTING

Execute end-to-end scenarios using actual supported GeFlow services.

### Workflow 1 — Menu Inquiry

User asks:

"Show me my complete cafe menu with prices."

Verify:

- Actual products are retrieved.
- Correct variants are shown.
- Correct prices are shown.
- Inactive products are handled according to existing business rules.
- No fabricated products are returned.

### Workflow 2 — Recipe Cost Analysis

User asks:

"Calculate the ingredient cost of my Cappuccino Medium."

Verify:

- Correct recipe is retrieved.
- Correct ingredient quantities are used.
- Correct UoM conversion is applied.
- Correct ingredient costs are retrieved.
- Total is mathematically accurate.
- Missing information is disclosed.

### Workflow 3 — Profitability Analysis

User asks:

"Which cafe products have the highest gross margin?"

Verify:

- Selling prices are correct.
- Recipe costs are correct.
- Gross profit is calculated correctly.
- Gross margin is calculated correctly.
- Products with incomplete cost data are identified.
- Ranking is accurate.

Do not label gross margin as net profit.

### Workflow 4 — Stock Availability

User asks:

"How many Cappuccino Medium drinks can I make with my current ingredients?"

Verify:

- Actual available inventory is retrieved.
- Correct recipe is selected.
- Units are converted correctly.
- Limiting ingredient is identified.
- Theoretical capacity is calculated correctly.
- No inventory is modified.

### Workflow 5 — POS Sales Analysis

User asks:

"Show me my best-selling drinks this month."

Verify:

- Correct date range.
- Correct completed transactions.
- Correct product and variant grouping.
- Correct quantity aggregation.
- Correct sorting.
- Refund and cancellation handling.

### Workflow 6 — Purchase Comparison

User asks:

"Compare my coffee bean suppliers based on purchase prices."

Verify:

- Actual supplier records are retrieved.
- Purchase prices are compared.
- Units and currencies are normalized where supported.
- Comparison uses relevant purchase records.
- Missing conditions are disclosed.

### Workflow 7 — Replenishment Recommendation

User asks:

"Which ingredients should I consider replenishing?"

Verify:

- Current stock is retrieved.
- Relevant stock thresholds or existing policies are used.
- Purchase and consumption history is considered only where supported.
- Recommendations are clearly separated from actual purchase actions.
- No purchase order is submitted without authorization.

### Workflow 8 — Recipe Change Impact

User asks:

"What happens to my Cappuccino Medium cost if milk price increases by 10%?"

Verify:

- Existing recipe is retrieved.
- Existing milk cost is identified.
- Price adjustment is calculated.
- Revised recipe cost is calculated.
- Gross profit and margin are recalculated if selling price is known.
- Actual product recipe and ingredient cost remain unchanged.

This is a simulation unless the user separately authorizes a real business-data update.

---

# 13. CONCURRENT EXECUTION & DATA CONSISTENCY

Test whether multiple authorized requests can run without producing inconsistent results.

Test:

- Two simultaneous read requests.
- Multiple calculation requests.
- Concurrent sales retrieval.
- Configuration update during an existing execution.
- Inventory change during stock analysis.
- Retry after a network interruption.
- Duplicate idempotency key.

Requirements:

- An execution must retain its original configuration snapshot.
- Data freshness must be clear.
- Do not mix inconsistent inventory snapshots without identifying the limitation.
- Prevent duplicate business transactions.
- Use existing transaction and concurrency controls.
- Do not introduce new concurrency architecture unless required and separately approved.

---

# 14. FAILURE & EDGE-CASE TESTING

Test:

- Missing recipe.
- Missing ingredient.
- Missing purchase cost.
- Invalid quantity.
- Negative quantity.
- Zero selling price.
- Zero expected stock.
- Incompatible UoM.
- Missing product variant.
- Inactive product.
- Unauthorized organization.
- Unauthorized category.
- Unauthorized tool.
- Invalid approval.
- Gateway timeout.
- Backend service failure.
- Partial execution failure.
- Duplicate execution request.
- Cancelled execution.
- Outdated data.
- Missing date range.

Expected behavior:

- Clear error messages.
- No fabricated values.
- No silent calculation defaults.
- No unauthorized writes.
- No duplicate business transactions.
- Complete execution and audit traceability.

---

# 15. SECURITY & PERMISSION TESTING

Verify that AGT-019 cannot:

1. Read another organization's menu.
2. Read another organization's recipe.
3. Read another organization's inventory.
4. Read another organization's sales.
5. Read unauthorized supplier information.
6. Modify products without permission.
7. Modify recipes without permission.
8. Modify inventory without permission.
9. Create purchases without authorization.
10. Bypass approval requirements.
11. Change its own permissions.
12. Access another agent's private execution context.

Test backend enforcement directly.

Frontend visibility alone is not proof of authorization.

---

# 16. INDEPENDENT CALCULATION VERIFICATION

Every mathematical calculation must be independently verified.

Do not rely on the agent's own output to determine whether its output is correct.

For each calculation test, record:

- Test ID.
- Input values.
- Formula.
- Independently calculated expected result.
- Agent result.
- Difference.
- Rounding behavior.
- Pass/fail status.

Use deterministic fixtures.

Where floating-point precision is relevant, use the existing decimal or fixed-precision monetary handling.

Do not compare floating-point outputs using exact equality where a defined tolerance is required.

For financial values, follow the application's actual currency precision and rounding policy.

---

# 17. TEST RESULTS & ACCEPTANCE CRITERIA

Use the following statuses:

| Status | Meaning |
|---|---|
| PASS | Tested and verified successfully |
| FAIL | Tested and produced an incorrect or unsafe result |
| BLOCKED | Required functionality or dependency is missing |
| UNSUPPORTED | Functionality is not implemented in GeFlow |
| NOT TESTED | Test was not executed |

A test must not be marked PASS merely because the agent returned a response.

It must pass independent verification.

### Pilot acceptance requirements

- Recipe calculations are independently verified.
- Gross profit and gross margin are accurate.
- UoM conversions are correct.
- Inventory consumption is consistent with actual business workflows.
- Stock capacity calculations identify the correct limiting ingredient.
- Sales calculations use correct transaction data.
- Supplier comparisons use comparable values.
- No unauthorized organization access is possible.
- No duplicate inventory or purchase transactions occur.
- Audit records are complete.
- Existing GeFlow functionality remains operational.

A feature that is not implemented must be reported as BLOCKED or UNSUPPORTED, not PASS.

---

# 18. STRICTLY OUT OF SCOPE

Do not implement:

1. New cafe features.
2. New recipe or BOM system.
3. New inventory system.
4. New POS functionality.
5. New purchasing system.
6. New supplier management.
7. New UoM architecture.
8. New AI models.
9. Agent-to-agent communication.
10. Central AI orchestrator.
11. Other 28 agents.
12. New billing or subscription functionality.
13. New dashboard or UI redesign.
14. Unapproved business-data modifications.
15. Production rollout.
16. New business policies.
17. Fake test results or fabricated customer records.

If testing exposes a bug, document the defect and its severity. Do not silently expand this testing step into a feature implementation project.

---

# 19. IMPLEMENTATION ORDER

Follow this exact order:

**Phase 1 — Pilot Verification**
- Inspect Step 13 implementation.
- Verify dependencies.
- Confirm AGT-019 is available in the authorized test environment.

**Phase 2 — Test Environment Preparation**
- Identify existing isolated test organization.
- Prepare deterministic test fixtures.
- Record expected results independently.

**Phase 3 — Calculation Testing**
- Recipe costs.
- Gross profit.
- Gross margin.
- Markup.
- Selling price recommendations.
- UoM conversions.
- Inventory consumption.
- Stock capacity.

**Phase 4 — Business Data Testing**
- Menu.
- Product variants.
- Sales.
- Purchases.
- Suppliers.
- Wastage and stock variance where supported.

**Phase 5 — End-to-End Workflow Testing**
- Menu inquiry.
- Recipe costing.
- Profitability analysis.
- Stock availability.
- Sales analysis.
- Supplier comparison.
- Replenishment recommendation.
- Recipe change simulation.

**Phase 6 — Reliability & Security Testing**
- Concurrency.
- Data consistency.
- Retry behavior.
- Error handling.
- Organization isolation.
- Permission enforcement.
- Audit verification.

**Phase 7 — Regression & Reporting**
- Run existing GeFlow regression tests.
- Document failures and blockers.
- Prepare the full test report.

---

# 20. COMPLETION REPORT — MANDATORY

After testing, provide:

1. Step 13 implementation verification.
2. Test environment details.
3. Test fixture details.
4. Total test cases executed.
5. Total passed.
6. Total failed.
7. Total blocked.
8. Total unsupported.
9. Total not tested.
10. Recipe calculation results.
11. Gross profit and margin results.
12. UoM conversion results.
13. Inventory consumption results.
14. Stock capacity results.
15. Sales calculation results.
16. Purchase comparison results.
17. Workflow test results.
18. Security and isolation results.
19. Audit logging verification.
20. Regression test results.
21. Bugs discovered.
22. Bug severity.
23. Exact files or modules affected, if known.
24. Recommended fixes.
25. Remaining limitations.

Include a test evidence table with:

| Test ID | Scenario | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|

Clearly distinguish actual test results from theoretical expected values.

Do not fabricate test executions, screenshots, database records or successful outcomes.

---

# 21. FINAL EXECUTION RULES

- Test AGT-019 only.
- Do not implement other agents.
- Do not assume Step 13 succeeded.
- Use isolated test data.
- Do not modify real customer business data.
- Independently verify all calculations.
- Respect existing business logic.
- Do not bypass the Shared Tool Gateway.
- Do not bypass authorization.
- Do not invent unsupported capabilities.
- Do not implement newly discovered features without approval.
- Preserve existing GeFlow functionality.

**STOP CONDITION:**

After completing the testing and submitting the full report, STOP.

Wait for explicit authorization before fixing bugs, expanding capabilities, activating production access or proceeding to another roadmap step.

**FINAL OBJECTIVE:**

Establish objective evidence that AGT-019 can accurately perform supported cafe calculations and workflows, safely access GeFlow business data, enforce authorization, and produce traceable execution results.