# Workshop OS – Double-Entry Accounting & Four-Founder Financial Engine

This document provides the exact double-entry ledger specifications, the Standard Chart of Accounts, and the four-founder equity, expense reimbursement, and profit distribution workflows.

---

## 1. Standard Chart of Accounts (COA)

Workshop OS initializes with an engineering-tailored Chart of Accounts. All monetary figures are in **Sri Lankan Rupees (LKR)** using `Decimal` (`NUMERIC(15, 2)`).

```
1000 - ASSETS
  1010 - Cash on Hand
  1011 - Commercial Bank - Primary Operating Account
  1012 - Commercial Bank - Tax & Reserve Escrow Account
  1020 - Accounts Receivable (Customer Invoices)
  1050 - Inventory Asset - 3D Printing Materials (Filaments & Resins)
  1060 - Inventory Asset - Electronic Components & PCBs
  1070 - Inventory Asset - Consumables & Spare Parts
  1510 - Fixed Assets - 3D Printers & Equipment
  1519 - Accumulated Depreciation - 3D Printers & Equipment
  1520 - Fixed Assets - Electronics Testing & Lab Instruments
  1529 - Accumulated Depreciation - Lab Instruments

2000 - LIABILITIES
  2010 - Accounts Payable (Suppliers & Vendors)
  2020 - Sales Tax / VAT Payable
  2030 - Customer Advance Deposits (Unearned Revenue)
  2050 - Due to Founders (Reimbursement Clearing)
    2051 - Due to Founder 1 (Personal Out-of-Pocket Claims)
    2052 - Due to Founder 2
    2053 - Due to Founder 3
    2054 - Due to Founder 4
  2060 - Founder Profit Distributions Payable
    2061 - Profit Payable - Founder 1
    2062 - Profit Payable - Founder 2
    2063 - Profit Payable - Founder 3
    2064 - Profit Payable - Founder 4

3000 - EQUITY
  3010 - Founder Capital Accounts (Invested Equity)
    3011 - Capital - Founder 1
    3012 - Capital - Founder 2
    3013 - Capital - Founder 3
    3014 - Capital - Founder 4
  3020 - Retained Earnings
  3030 - Founder Drawings
    3031 - Drawings - Founder 1
    3032 - Drawings - Founder 2
    3033 - Drawings - Founder 3
    3034 - Drawings - Founder 4

4000 - REVENUE
  4010 - 3D Printing Manufacturing Services
  4020 - PCB Design & Prototyping Services
  4030 - Electronics Assembly & Fabrication
  4040 - Engineering Consultation & Custom Development
  4090 - Miscellaneous Revenue

5000 - DIRECT COSTS (COGS)
  5010 - COGS - 3D Filaments & Resins Consumed
  5020 - COGS - Electronic Components & Solder Consumed
  5030 - COGS - Subcontracted PCB Fabrication & Stencils
  5040 - Direct Workshop Electricity Allocation
  5050 - Machine Wear & Maintenance Allocation

6000 - OPERATING EXPENSES (OPEX)
  6010 - Workshop Rent & Utilities
  6020 - Tools, Consumables & Small Hardware
  6030 - Software Licenses & Subscriptions (CAD, Cloud, Slicers)
  6040 - Office & Logistics Expenses
  6050 - Equipment Depreciation Expense
  6090 - Bank Fees & Charges
```

---

## 2. Double-Entry Posting Rules by Business Event

### Event 1: Initial Founder Capital Injections
*Founders contribute LKR 250,000 each into the corporate bank account.*
- **DR** 1011 Commercial Bank Account: `1,000,000.00`
- **CR** 3011 Capital - Founder 1: `250,000.00`
- **CR** 3012 Capital - Founder 2: `250,000.00`
- **CR** 3013 Capital - Founder 3: `250,000.00`
- **CR** 3014 Capital - Founder 4: `250,000.00`

---

### Event 2: Purchasing Inventory on Credit
*Purchase LKR 180,000 worth of PLA/PETG filaments from a local distributor.*
- **DR** 1050 Inventory Asset - 3D Printing Materials: `180,000.00`
- **CR** 2010 Accounts Payable: `180,000.00`

---

### Event 3: Quotation Acceptance & Customer Advance Deposit
*Customer accepts Quote QT-2026-0001 (Total LKR 80,000) and pays a 50% advance deposit (LKR 40,000).*
- **DR** 1011 Commercial Bank Account: `40,000.00`
- **CR** 2030 Customer Advance Deposits (Liability): `40,000.00`
*(Revenue is NOT recognized yet because the engineering work has not been performed).*

---

### Event 4: Production Job Material Consumption
*Technician completes a 3D print and PCB prototype batch. Consumed 450g PLA (LKR 3,600) and electronic components (LKR 6,200).*
- **DR** 5010 COGS - 3D Filaments: `3,600.00`
- **DR** 5020 COGS - Electronic Components: `6,200.00`
- **CR** 1050 Inventory Asset - 3D Printing Materials: `3,600.00`
- **CR** 1060 Inventory Asset - Electronic Components: `6,200.00`

---

### Event 5: Invoice Issuance
*Engineering work completed and inspected. Invoice INV-2026-0001 issued for LKR 80,000. The LKR 40,000 advance deposit is applied against the invoice.*
- **DR** 1020 Accounts Receivable: `40,000.00` (Remaining balance due)
- **DR** 2030 Customer Advance Deposits: `40,000.00` (Clearing deposit liability)
- **CR** 4010 3D Printing Manufacturing: `45,000.00`
- **CR** 4020 PCB Design & Prototyping: `35,000.00`
*(Total Debits = LKR 80,000; Total Credits = LKR 80,000).*

---

### Event 6: Final Customer Payment Settlement
*Customer transfers the remaining LKR 40,000 to the bank account.*
- **DR** 1011 Commercial Bank Account: `40,000.00`
- **CR** 1020 Accounts Receivable: `40,000.00`
*(Invoice balance becomes 0.00 - marked PAID).*

---

### Event 7: Founder Out-of-Pocket Expense Claim
*Founder 3 purchases specialized ICs from an electronics market for LKR 14,500 using personal cash.*
1. **Claim Submission & Approval:**
   - **DR** 1060 Inventory Asset - Electronic Components: `14,500.00`
   - **CR** 2053 Due to Founder 3 (Current Liability): `14,500.00`
2. **Reimbursement Payout via Bank Transfer:**
   - **DR** 2053 Due to Founder 3: `14,500.00`
   - **CR** 1011 Commercial Bank Account: `14,500.00`
*(Zero impact on founder equity; this is a pure liability reimbursement).*

---

### Event 8: Monthly Machine Depreciation
*3D printers depreciate by LKR 24,000 based on monthly operating hours.*
- **DR** 6050 Equipment Depreciation Expense: `24,000.00`
- **CR** 1519 Accumulated Depreciation - 3D Printers: `24,000.00`

---

## 3. Four-Founder Profit Distribution Workflow & Reserve Rules

### 3.1 The Liquidity Rule
Workshop OS **never** allows paper profit to be distributed without cash backing:
$$\text{Audited Net Profit} = \sum \text{Revenues} - \sum \text{COGS} - \sum \text{OPEX} - \text{Depreciation}$$

$$\text{Mandatory Retained Reserves} = \text{Audited Net Profit} \times (\text{Working Capital \%} + \text{Tax Reserve \%})$$

$$\text{Theoretical Distributable Pool} = \text{Audited Net Profit} - \text{Mandatory Retained Reserves}$$

$$\text{Liquid Cash Safeguard} = \text{Cash in Bank} - \text{Accounts Payable} - \text{Customer Deposits} - \text{Outstanding Founder Claims}$$

$$\text{Actual Distributable Pool} = \min(\text{Theoretical Distributable Pool}, \max(0, \text{Liquid Cash Safeguard}))$$

### 3.2 Four-Way Multi-Signature Sign-Off
1. An automated distribution run proposal (`PDR-2026-XX`) is generated showing the net profit, reserve deductions, safe liquid cap, and each founder's exact share.
2. The proposal is locked.
3. Each of the 4 co-founders must review the figures and click **Sign and Approve**.
4. The system logs their User ID, timestamp, and IP address into `signatures_collected`.
5. Only when all 4 approvals are present does the system allow the distribution to be posted to the general ledger:
   - **DR** 3020 Retained Earnings: `[Total Distributable Pool]`
   - **CR** 2061 Profit Payable - Founder 1: `[Founder 1 Share]`
   - **CR** 2062 Profit Payable - Founder 2: `[Founder 2 Share]`
   - **CR** 2063 Profit Payable - Founder 3: `[Founder 3 Share]`
   - **CR** 2064 Profit Payable - Founder 4: `[Founder 4 Share]`
6. When the physical bank payments are dispatched:
   - **DR** 2061..2064 Profit Payable - Founders: `[Amount]`
   - **CR** 1011 Commercial Bank Account: `[Amount]`

---

## 4. Reversal Mechanics & Audit Integrity

- **Prohibition of Silent Edits:** Once a journal entry is marked `POSTED`, its `lines` table rows cannot be updated or deleted. Database-level foreign key constraints enforce `ON DELETE RESTRICT`.
- **Compensatory Reversals:** If a transaction must be cancelled or corrected, the user triggers the "Create Reversal" action. The system creates a new journal entry with opposite debits and credits:
  - Original: DR Account A $X$, CR Account B $X$.
  - Reversal: DR Account B $X$, CR Account A $X$.
  - `reversal_of_id` points to the original entry, and the original entry is marked `REVERSED`.
- Every ledger mutation logs an entry in `audit_logs`.
