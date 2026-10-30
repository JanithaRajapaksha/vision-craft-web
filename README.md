# Workshop OS – Complete Business Management System

A production-grade, modular business management platform and centralized operating system built for engineering and manufacturing operations (FDM 3D printing, PCB design, PCB fabrication & assembly, electronics prototyping, and custom engineering projects). Operated by 4 co-founders with accounting in Sri Lankan Rupees (LKR).

---

## 1. System Features

- **Executive & Financial Dashboard:** Real-time revenue, expenses, net profit, accounts receivable aging, production job queues, inventory alerts, and founder capital balances.
- **3D Printing Management:**
  - CAD model ingestion (`.stl`, `.3mf`, `.obj`) with WebGL 3D preview.
  - Multi-printer hardware and nozzle profile management.
  - Asynchronous slicing execution via **PrusaSlicer** / **OrcaSlicer** headless CLI.
  - Automated telemetry extraction (filament mass in grams, print duration in seconds, layer counts).
  - Configurable multi-factor price estimation engine (filament cost, machine hourly depreciation, electricity tariffs, technician labor, risk contingency factor, target margins, and minimum order floors).
- **PCB & Engineering Services:**
  - Technical specification builder for PCB design, fabrication, assembly (SMT/THT pin counts, copper weight, layer counts).
  - Configurable hourly rates, fixed-price services, and custom quotation items.
- **Customer CRM:** Comprehensive customer directory (individual & business), previous quotes, invoices, payment history, and credit limit tracking.
- **Quotation & Revision Engine:** Multi-service quotations, sequential numbering (`QT-2026-0001`), versioned revisions, professional PDF generation, and one-click conversion to projects.
- **Project & Job Tracking:** Project management (`PRJ-2026-0001`) with production jobs (`JOB-2026-0001`), technician time logs, material consumption records, and QA sign-off.
- **Invoicing & Payments:** Sequential invoicing (`INV-2026-0001`), advance deposit handling, partial payments, payment receipts (`REC-2026-0001`), and Accounts Receivable aging.
- **Dual Inventory Management:**
  - 3D Printing: Filaments (by brand, type, color, weight), resins, nozzles, spare parts.
  - Electronics: ICs, microcontrollers, passive components, connectors, PCB blanks.
  - Weighted average cost valuation, stock movements, and automatic consumption journal postings.
- **Double-Entry Accounting Ledger:**
  - Standard Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, OPEX).
  - Strict balance enforcement ($\sum \text{Debit} = \sum \text{Credit}$).
  - Immutable journal entries (strict prohibition of silent edits; compensatory reversal entries only).
  - Fixed asset register and automated monthly depreciation schedules.
  - Financial statements: Profit & Loss (P&L), Balance Sheet, Cash Flow, Trial Balance.
- **Four-Founder Financial Management:**
  - Independent tracking of Legal Equity Ownership vs. Profit-Sharing Ratios.
  - Founder Capital Accounts (Equity).
  - Founder Personal Out-of-Pocket Expense Claims & Tax-Free Reimbursements (Liabilities).
  - Liquidity-gated, reserve-protected profit distribution runs with 4-way multi-signature approval.
- **Role-Based Access Control (RBAC):** Super Admin, Founder, Accountant, Technician, Employee with complete audit logging.

---

## 2. Technology Stack

| Tier | Technologies |
| :--- | :--- |
| **Frontend** | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, Recharts, Three.js |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2, Alembic |
| **Database** | PostgreSQL 16+ (Strict ACID, NUMERIC 15,2 precision) |
| **Background Jobs** | Redis, Celery (Slicing workers, PDF rendering, Depreciation beat) |
| **Storage** | Pluggable Storage Abstraction (Local Disk for dev $\rightarrow$ AWS S3 / MinIO for prod) |
| **Slicer Engine** | PrusaSlicer & OrcaSlicer Headless CLI |
| **Testing** | Pytest (Backend API, Ledger rules, Cost engine) |

---

## 3. Architecture Documentation

Detailed architectural blueprints are available in the repository:
- [System Architecture Specification](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Database Schema & Entity Relationship Design](docs/architecture/DATABASE_SCHEMA.md)
- [Double-Entry Accounting & Four-Founder Rules](docs/architecture/ACCOUNTING_AND_FOUNDER_RULES.md)
- [3D Slicer Integration & Cost Estimation Math](docs/architecture/SLICER_INTEGRATION_AND_ESTIMATION.md)

---

## 4. Getting Started (Development Setup)

### Prerequisites
- Python 3.10+
- Node.js 20+ LTS & npm
- PostgreSQL 14+
- Redis Server
- PrusaSlicer / OrcaSlicer (Optional for headless local slicing)

### Backend Setup
```bash
cd back-end
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your local PostgreSQL and Redis credentials
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Celery Background Worker Setup
```bash
cd back-end
source venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info -Q slicing,pdf,default
```

### Frontend Setup
```bash
cd front-end
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

---

## 5. Phased Implementation Roadmap

1. **Phase 1: Foundation, DB, Storage & RBAC**
2. **Phase 2: Accounting Engine & Four-Founder Module**
3. **Phase 3: Inventory Management & Sourcing**
4. **Phase 4: 3D Printing Management & Slicer Integration**
5. **Phase 5: PCB & Engineering Services**
6. **Phase 6: CRM & Quotation Management**
7. **Phase 7: Project & Production Job Management**
8. **Phase 8: Invoicing & Payment Processing**
9. **Phase 9: Dashboards & Financial Reports**
10. **Phase 10: Testing, Hardening & Docker Deployment**

