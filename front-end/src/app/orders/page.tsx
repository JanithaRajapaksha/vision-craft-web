"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { formatLKR } from "@/lib/utils";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Layers,
  Cpu,
  Phone,
  User as UserIcon,
  Search,
  PackageCheck,
  Truck,
  Check,
  X,
  CreditCard,
} from "lucide-react";

interface OrderItem {
  id: string;
  order_id: string;
  slicing_job_id?: string;
  title: string;
  description?: string;
  material: string;
  layer_height_mm: string;
  filament_grams: string;
  estimated_hours: string;
  quantity: number;
  unit_price_lkr: string;
  total_price_lkr: string;
}

interface Order {
  id: string;
  order_number: string;
  quotation_id?: string;
  client_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  status: string;
  payment_status: string;
  paid_amount_lkr: string;
  payment_method?: string;
  payment_collected_by?: string;
  paid_at?: string;
  total_amount_lkr: string;
  notes?: string;
  assigned_partner: string;
  created_at: string;
  items: OrderItem[];
}

const PARTNERS = ["Janitha", "Melanka", "Lalitha", "Thakshila"];

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: any }
> = {
  QUEUED: {
    label: "Queued to Print",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  COMPLETED: {
    label: "Done Printing",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  DELIVERED: {
    label: "Delivered to Client",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    icon: Truck,
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    icon: AlertCircle,
  },
};

export default function OrdersPage() {
  const [currentPartner, setCurrentPartner] = useState("Janitha");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPayment, setFilterPayment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment Collection Modal State
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [selectedCollector, setSelectedCollector] = useState<string>("Janitha");
  const [selectedMethod, setSelectedMethod] = useState<string>("Commercial Bank Transfer");

  // Authenticate helper with automatic recovery from stale/switched tokens
  const getAuthToken = async (forceRefresh: boolean = false): Promise<string> => {
    let token = typeof window !== "undefined" && !forceRefresh ? localStorage.getItem("token") : null;
    if (!token) {
      try {
        const loginRes = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "janitha@visioncraft.lk", password: "Password123!" }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          token = data.access_token as string;
          if (typeof window !== "undefined") {
            localStorage.setItem("token", token);
          }
        }
      } catch (err) {
        console.warn("Auth fetch failed:", err);
      }
    }
    return token || "";
  };

  // Fetch Orders
  const fetchOrders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let token = await getAuthToken();
      let res = await fetch("/api/v1/commercial/orders?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/commercial/orders?limit=100", {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) {
        throw new Error("Failed to load orders from database.");
      }

      const data: Order[] = await res.json();
      setOrders(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not retrieve production orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Update Production Status (Directly from QUEUED -> COMPLETED -> DELIVERED)
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      let token = await getAuthToken();
      let res = await fetch(`/api/v1/commercial/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch(`/api/v1/commercial/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to update status.");
      }

      const updated: Order = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      alert(err.message || "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Submit Payment Collection
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;
    setUpdatingId(paymentModalOrder.id);
    try {
      let token = await getAuthToken();
      let res = await fetch(`/api/v1/commercial/orders/${paymentModalOrder.id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_status: "PAID",
          payment_method: selectedMethod,
          payment_collected_by: selectedCollector,
        }),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch(`/api/v1/commercial/orders/${paymentModalOrder.id}/payment`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_status: "PAID",
            payment_method: selectedMethod,
            payment_collected_by: selectedCollector,
          }),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to update payment.");
      }

      const updated: Order = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === paymentModalOrder.id ? updated : o)));
      setPaymentModalOrder(null);
    } catch (err: any) {
      alert(err.message || "Could not record payment.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Revert Payment back to UNPAID
  const handleRevertPayment = async (orderId: string) => {
    if (!confirm("Are you sure you want to mark this order as Unpaid?")) return;
    setUpdatingId(orderId);
    try {
      let token = await getAuthToken();
      let res = await fetch(`/api/v1/commercial/orders/${orderId}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_status: "UNPAID",
        }),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch(`/api/v1/commercial/orders/${orderId}/payment`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_status: "UNPAID",
          }),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to revert payment.");
      }

      const updated: Order = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      alert(err.message || "Could not revert payment.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === "ALL" || o.status === filterStatus;
    const matchesPayment =
      filterPayment === "ALL" ||
      (filterPayment === "PAID" && o.payment_status === "PAID") ||
      (filterPayment === "UNPAID" && o.payment_status !== "PAID");

    const matchesSearch =
      searchQuery === "" ||
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer_phone && o.customer_phone.includes(searchQuery)) ||
      o.items.some((it) => it.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesPayment && matchesSearch;
  });

  // Calculate Metrics
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.status !== "CANCELLED" ? parseFloat(o.total_amount_lkr) : 0),
    0
  );
  const paidRevenue = orders.reduce(
    (sum, o) => sum + (o.payment_status === "PAID" ? parseFloat(o.total_amount_lkr) : 0),
    0
  );
  const pendingPayment = orders.reduce(
    (sum, o) =>
      sum + (o.payment_status !== "PAID" && o.status !== "CANCELLED" ? parseFloat(o.total_amount_lkr) : 0),
    0
  );
  const queuedCount = orders.filter((o) => o.status === "QUEUED").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED" || o.status === "DELIVERED").length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar onOpenQuickExpense={() => {}} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={setCurrentPartner}
        />

        {/* Studio Subheader Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-sm">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                3D Printing Orders & Production Queue
              </h1>
              <p className="text-xs text-slate-500">
                Workshop manufacturing jobs, partner payment tracking, and print completion
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Queue</span>
            </button>
            <Link
              href="/3d-printing"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>New 3D Print / Slice</span>
            </Link>
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="px-6 py-3.5 grid grid-cols-4 gap-4 shrink-0 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Order Revenue
            </span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {formatLKR(totalRevenue.toFixed(2))}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Payment Received (Paid)
            </span>
            <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
              {formatLKR(paidRevenue.toFixed(2))}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Payment Pending (Unpaid)
            </span>
            <div className="text-lg font-black text-rose-800 font-mono mt-0.5">
              {formatLKR(pendingPayment.toFixed(2))}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
              Production Queue
            </span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {queuedCount} Queued • {completedCount} Done
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Tabs - Simple Pipeline: All, Queued, Done Printing, Delivered */}
            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-medium">
              {[
                { id: "ALL", label: "All Orders", count: orders.length },
                { id: "QUEUED", label: "Queued to Print", count: queuedCount },
                { id: "COMPLETED", label: "Done Printing", count: orders.filter((o) => o.status === "COMPLETED").length },
                { id: "DELIVERED", label: "Delivered", count: orders.filter((o) => o.status === "DELIVERED").length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    filterStatus === tab.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Payment Filter */}
            <div className="flex items-center space-x-1.5 text-xs font-medium">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Payment:</span>
              {[
                { id: "ALL", label: "All" },
                { id: "PAID", label: "Paid" },
                { id: "UNPAID", label: "Unpaid" },
              ].map((pTab) => (
                <button
                  key={pTab.id}
                  type="button"
                  onClick={() => setFilterPayment(pTab.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    filterPayment === pTab.id
                      ? pTab.id === "PAID"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : pTab.id === "UNPAID"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {pTab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by order #, client, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Main Orders Table View */}
        <main className="flex-1 overflow-y-auto p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RotateCw className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="text-xs font-bold text-slate-600">Loading VisionCraft Orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-8 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <ShoppingBag className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">No Orders Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {orders.length === 0
                  ? "You haven't queued any production orders yet. Slice an STL model in 3D Printing or upload a Gerber PCB to click 'Add to Order'."
                  : "No orders match your active filter."}
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <Link
                  href="/3d-printing"
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>3D Printing Studio</span>
                </Link>
                <Link
                  href="/engineering"
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span>PCB Studio</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Model & Spec</th>
                      <th className="py-3 px-4 text-center">Qty</th>
                      <th className="py-3 px-4 text-right">Order Value (LKR)</th>
                      <th className="py-3 px-4 text-center">Payment Status</th>
                      <th className="py-3 px-4 text-center">Production Status</th>
                      <th className="py-3 px-4 text-right">Production Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const item = order.items && order.items[0];
                      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.QUEUED;
                      const Icon = cfg.icon;
                      const isPaid = order.payment_status === "PAID";

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Order Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">
                              {order.order_number}
                            </span>
                            <div className="text-[10px] text-slate-400 font-normal mt-1">
                              {new Date(order.created_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.customer_name}</span>
                            </div>
                            {order.customer_phone && (
                              <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <a
                                  href={`tel:${order.customer_phone}`}
                                  className="hover:text-blue-600 hover:underline"
                                >
                                  {order.customer_phone}
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Model Specs */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <span className="font-semibold text-slate-900 block truncate">
                              {item ? item.title : "3D Print Job"}
                            </span>
                            {item && (
                              <div className="text-[10px] text-slate-500 font-medium space-x-1.5 mt-0.5">
                                <span>{item.material}</span>
                                <span>•</span>
                                <span>{item.layer_height_mm}mm layers</span>
                                <span>•</span>
                                <span className="font-mono">{item.filament_grams}g</span>
                              </div>
                            )}
                            {order.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                                Note: {order.notes}
                              </div>
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                            {item ? item.quantity : 1} pcs
                          </td>

                          {/* Total LKR */}
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                            {formatLKR(order.total_amount_lkr)}
                          </td>

                          {/* Payment Status Column (With Partner Collection Tracking) */}
                          <td className="py-3.5 px-4 text-center">
                            {isPaid ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Paid in Full</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                  Collected by: <strong>{order.payment_collected_by || order.assigned_partner || "Janitha"}</strong>
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium">
                                  {order.payment_method || "Bank Transfer"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRevertPayment(order.id)}
                                  className="text-[9px] text-slate-400 hover:text-rose-600 underline mt-0.5 cursor-pointer"
                                >
                                  Mark Unpaid
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center space-y-1">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  <span>Payment Pending</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCollector(currentPartner || "Janitha");
                                    setSelectedMethod("Commercial Bank Transfer");
                                    setPaymentModalOrder(order);
                                  }}
                                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-xs"
                                >
                                  + Record Payment
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Production Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.badge}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{cfg.label}</span>
                            </span>
                          </td>

                          {/* Direct Production Action: Done Printing or Deliver */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {/* If Queued: Single Click -> Done Printing */}
                              {order.status === "QUEUED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                                  disabled={updatingId === order.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Done Printing</span>
                                </button>
                              )}

                              {/* If Completed: Single Click -> Deliver */}
                              {order.status === "COMPLETED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                                  disabled={updatingId === order.id}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                                >
                                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Deliver</span>
                                </button>
                              )}

                              {order.status === "DELIVERED" && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                  Archived
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* Modal: Record Partner Payment */}
      {/* ========================================================================= */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight">Record Payment Received</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{paymentModalOrder.order_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4 text-xs">
              {/* Order Amount Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block">
                  Amount to Collect
                </span>
                <div className="text-xl font-extrabold text-emerald-900 font-mono mt-0.5">
                  {formatLKR(paymentModalOrder.total_amount_lkr)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Customer: <strong>{paymentModalOrder.customer_name}</strong>
                </div>
              </div>

              {/* Partner Selection: Janitha, Melanka, Lalitha, Thakshila */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Who took the payment? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PARTNERS.map((partner) => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => setSelectedCollector(partner)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        selectedCollector === partner
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{partner}</span>
                      {selectedCollector === partner && (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Commercial Bank Transfer">Commercial Bank Transfer</option>
                  <option value="Cash on Hand">Cash on Hand</option>
                  <option value="Online / Card Payment">Online / Card Payment</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="flex-1 py-2 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === paymentModalOrder.id}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Received</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
