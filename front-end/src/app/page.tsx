"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { formatLKR } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";

interface FounderSummary {
  id: string;
  user_id: string;
  display_name: string;
  ownership_percentage: string;
  profit_share_percentage: string;
  capital_balance: string;
  drawings_balance: string;
  amount_due_reimbursement: string;
}

interface AccountItem {
  id: string;
  code: string;
  name: string;
  classification: string;
  current_balance: string;
}

interface JournalLine {
  id: string;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  memo?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: string;
  source_document?: string;
  lines: JournalLine[];
  created_at: string;
}

export default function DashboardPage() {
  const [currentPartner, setCurrentPartner] = useState("Janitha");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [founders, setFounders] = useState<FounderSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State for Quick Expense
  const [expenseType, setExpenseType] = useState<"company" | "partner">("company");
  const [selectedPartnerName, setSelectedPartnerName] = useState("Janitha");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState("6010"); // Rent & Utilities
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState("1011"); // Bank

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Authenticate as active partner to load data
      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${selectedPartnerName.toLowerCase()}@workshop-os.local`,
          password: "Password123!",
        }),
      });

      if (!loginRes.ok) {
        // Fallback to janitha if selected user login fails
        const fallback = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "janitha@workshop-os.local", password: "Password123!" }),
        });
        const tokenData = await fallback.json();
        localStorage.setItem("token", tokenData.access_token);
      } else {
        const tokenData = await loginRes.json();
        localStorage.setItem("token", tokenData.access_token);
      }

      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Founders
      const foundersRes = await fetch("/api/v1/founders", { headers });
      if (foundersRes.ok) {
        const fData = await foundersRes.json();
        setFounders(fData);
      }

      // 2. Fetch Accounts
      const accountsRes = await fetch("/api/v1/accounting/accounts", { headers });
      if (accountsRes.ok) {
        const aData = await accountsRes.json();
        setAccounts(aData);
      }

      // 3. Fetch Journal Entries
      const journalRes = await fetch("/api/v1/accounting/journal?limit=20", { headers });
      if (journalRes.ok) {
        const jData = await journalRes.json();
        setJournalEntries(jData);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPartnerName]);

  // Handle Quick Expense Submission
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMessage(null);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const expenseAcc = accounts.find((a) => a.code === selectedExpenseAccount);
      const paymentAcc = accounts.find((a) => a.code === selectedPaymentAccount);

      if (!expenseAcc || !paymentAcc) {
        throw new Error("Selected accounts could not be verified in the Chart of Accounts.");
      }

      if (expenseType === "company") {
        // Direct Company Expense
        const res = await fetch("/api/v1/accounting/expenses/quick", {
          method: "POST",
          headers,
          body: JSON.stringify({
            expense_account_id: expenseAcc.id,
            payment_account_id: paymentAcc.id,
            amount: parseFloat(amount),
            vendor,
            description,
            receipt_reference: "Direct-Receipt",
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to record expense");
        }

        setFeedbackMessage({
          type: "success",
          text: `Successfully recorded LKR ${parseFloat(amount).toLocaleString()} expense to ${vendor}!`,
        });
      } else {
        // Partner Personal Out-of-Pocket Claim
        const res = await fetch("/api/v1/founders/expenses", {
          method: "POST",
          headers,
          body: JSON.stringify({
            vendor,
            category_account_id: expenseAcc.id,
            amount: parseFloat(amount),
            description: `${description} (Paid personal by ${selectedPartnerName})`,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to submit partner claim");
        }

        const claim = await res.json();
        // Automatically approve for demonstration
        await fetch(`/api/v1/founders/expenses/${claim.id}/approve`, {
          method: "POST",
          headers,
        });

        setFeedbackMessage({
          type: "success",
          text: `Recorded out-of-pocket expense for ${selectedPartnerName}. Liability 'Due to ${selectedPartnerName}' updated!`,
        });
      }

      // Reset Form & Refresh
      setVendor("");
      setAmount("");
      setDescription("");
      setIsExpenseModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setSubmitting(false);
    }
  };

  // Reversal handler
  const handleReverseEntry = async (entryId: string, entryNumber: string) => {
    if (!confirm(`Are you sure you want to create an audited compensatory reversal for ${entryNumber}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/accounting/journal/${entryId}/reverse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Audited manual reversal request from dashboard" }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to reverse: ${err.detail || "Error"}`);
        return;
      }

      setFeedbackMessage({
        type: "success",
        text: `Successfully posted compensatory reversal for ${entryNumber}!`,
      });
      await fetchData();
    } catch (err) {
      alert("Failed to reverse entry");
    }
  };

  // Calculate high-level financial metrics from Chart of Accounts
  const bankAcc = accounts.find((a) => a.code === "1011");
  const cashAcc = accounts.find((a) => a.code === "1010");
  const arAcc = accounts.find((a) => a.code === "1020");
  const filamentStockAcc = accounts.find((a) => a.code === "1050");
  const electronicsStockAcc = accounts.find((a) => a.code === "1060");

  const totalLiquidCash =
    (parseFloat(bankAcc?.current_balance || "0") + parseFloat(cashAcc?.current_balance || "0")).toFixed(2);
  const totalStockValue =
    (parseFloat(filamentStockAcc?.current_balance || "0") + parseFloat(electronicsStockAcc?.current_balance || "0")).toFixed(2);
  const totalAR = parseFloat(arAcc?.current_balance || "0").toFixed(2);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar onOpenQuickExpense={() => setIsExpenseModalOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={(name) => {
            setCurrentPartner(name);
            setSelectedPartnerName(name);
          }}
        />

        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Welcome & Feedback Banner */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Workshop Operations & Financial Overview
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                FDM 3D Printing • PCB Assembly • Engineering Services • Operating Currency: Sri Lankan Rupees (LKR)
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchData}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Ledger</span>
              </button>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Expense As You Go</span>
              </button>
            </div>
          </div>

          {feedbackMessage && (
            <div
              className={`p-3.5 rounded-lg text-xs font-medium flex items-center space-x-2 ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* 4 Partners Hub: Janitha, Lalitha, Thakshila, Melanka */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span>The 4 Co-Founders Financial Status</span>
              </h2>
              <span className="text-xs text-slate-500">
                Equal Equity (25% each) • Starting Balance: 0.00 LKR
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {founders.map((founder) => (
                <div
                  key={founder.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {founder.display_name}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {founder.ownership_percentage}% Share
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Capital Account:</span>
                      <span className="font-semibold text-slate-900">
                        {formatLKR(founder.capital_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Drawings / Withdrawn:</span>
                      <span className="font-medium text-slate-500">
                        {formatLKR(founder.drawings_balance)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-slate-700 font-medium">Reimbursement Owed:</span>
                      <span
                        className={`font-bold ${
                          parseFloat(founder.amount_due_reimbursement) > 0
                            ? "text-amber-600"
                            : "text-slate-500"
                        }`}
                      >
                        {formatLKR(founder.amount_due_reimbursement)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Core Operational Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Available Liquid Cash (Bank + Cash)</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatLKR(totalLiquidCash)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Commercial Bank 1011 & Petty Cash 1010
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Accounts Receivable (Customer Dues)</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatLKR(totalAR)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Pending invoice settlements
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Inventory Valuation (FDM Filaments + PCBs)</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatLKR(totalStockValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Raw materials & electronic components
              </div>
            </div>
          </div>

          {/* General Journal Audit Table: Double-Entry Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>Real-Time General Journal (Immutable Double-Entry Ledger)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All transactions enforce strict debit = credit balance and full audit trail
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium">
                {journalEntries.length} Posted Entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Entry #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Account Breakdown (Debit / Credit)</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No transactions recorded yet. Starting balance is 0.00 LKR. Click "Record Expense As You Go" to log the first transaction.
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {entry.entry_number}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{entry.entry_date}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium max-w-xs">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {entry.lines.map((line) => (
                              <div
                                key={line.id}
                                className="flex justify-between items-center text-[11px] font-mono"
                              >
                                <span className="text-slate-700">
                                  {line.account_code} - {line.account_name}
                                </span>
                                <div className="space-x-3">
                                  {parseFloat(line.debit) > 0 && (
                                    <span className="text-emerald-700 font-medium">
                                      DR {formatLKR(line.debit)}
                                    </span>
                                  )}
                                  {parseFloat(line.credit) > 0 && (
                                    <span className="text-blue-700 font-medium">
                                      CR {formatLKR(line.credit)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              entry.status === "POSTED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {entry.status === "POSTED" && (
                            <button
                              onClick={() => handleReverseEntry(entry.id, entry.entry_number)}
                              className="text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline"
                            >
                              Create Reversal
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Record Expense As You Go Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Record Expense As You Go</h3>
                <p className="text-[11px] text-slate-300">
                  Instantly logs to the double-entry general ledger
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="p-5 space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expense Payer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseType("company")}
                    className={`py-2 text-center rounded-md border font-medium ${
                      expenseType === "company"
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Direct Company Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType("partner")}
                    className={`py-2 text-center rounded-md border font-medium ${
                      expenseType === "partner"
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Partner Out-of-Pocket
                  </button>
                </div>
              </div>

              {expenseType === "partner" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Which Partner Paid?
                  </label>
                  <select
                    value={selectedPartnerName}
                    onChange={(e) => setSelectedPartnerName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800"
                  >
                    <option value="Janitha">Janitha</option>
                    <option value="Lalitha">Lalitha</option>
                    <option value="Thakshila">Thakshila</option>
                    <option value="Melanka">Melanka</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor / Supplier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ceylon Electricity Board, Filament Store, Digikey"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Amount in LKR (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="e.g. 14500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expense Category (Debit Account)
                </label>
                <select
                  value={selectedExpenseAccount}
                  onChange={(e) => setSelectedExpenseAccount(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800"
                >
                  <option value="6010">6010 - Workshop Rent & Utilities</option>
                  <option value="6020">6020 - Tools, Consumables & Small Hardware</option>
                  <option value="5010">5010 - FDM 3D Filaments Consumed (COGS)</option>
                  <option value="5020">5020 - Electronic Components Consumed (COGS)</option>
                  <option value="5040">5040 - Direct Workshop Electricity Allocation</option>
                  <option value="6040">6040 - Office & Logistics Expenses</option>
                </select>
              </div>

              {expenseType === "company" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Method (Credit Account)
                  </label>
                  <select
                    value={selectedPaymentAccount}
                    onChange={(e) => setSelectedPaymentAccount(e.target.value)}
                    className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800"
                  >
                    <option value="1011">1011 - Commercial Bank Operating Account</option>
                    <option value="1010">1010 - Petty Cash on Hand</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Monthly electricity bill for 3D printer fleet"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Posting to Ledger..." : "Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
