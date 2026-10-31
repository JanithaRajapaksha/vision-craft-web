"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getStoredUser, getStoredToken, clearAuthSession, AuthUser } from "@/lib/auth";
import { formatLKR } from "@/lib/utils";
import {
  FileText,
  ShoppingBag,
  PlusCircle,
  Cpu,
  Layers,
  LogOut,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Phone,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";

interface QuotationItem {
  id: string;
  title: string;
  material: string;
  quantity: number;
  unit_price_lkr: string;
  total_price_lkr: string;
}

interface CustomerQuotation {
  id: string;
  quotation_number: string;
  status: string;
  total_amount_lkr: string;
  valid_until: string;
  notes?: string;
  created_at: string;
  items: QuotationItem[];
}

interface OrderItem {
  id: string;
  title: string;
  material: string;
  quantity: number;
  unit_price_lkr: string;
  total_price_lkr: string;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  paid_amount_lkr: string;
  total_amount_lkr: string;
  created_at: string;
  items: OrderItem[];
}

export default function CustomerPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"quotations" | "orders" | "profile">("quotations");

  const [quotations, setQuotations] = useState<CustomerQuotation[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceType, setServiceType] = useState("3D_PRINTING");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestNotes, setRequestNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    const token = getStoredToken();

    if (!currentUser || !token) {
      router.push("/login?redirect=/portal");
      return;
    }

    setUser(currentUser);
    fetchCustomerData(token);
  }, [router]);

  const fetchCustomerData = async (token: string) => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Customer Quotations
      const quotesRes = await fetch("/api/v1/commercial/my-quotations", { headers });
      if (quotesRes.ok) {
        const qData = await quotesRes.json();
        setQuotations(qData);
      }

      // 2. Fetch Customer Orders
      const ordersRes = await fetch("/api/v1/commercial/my-orders", { headers });
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData);
      }
    } catch (err) {
      console.error("Failed to load customer records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitFeedback(null);

    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch("/api/v1/commercial/customer-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service_type: serviceType,
          title: requestTitle.trim(),
          description: requestDescription.trim(),
          quantity: requestQuantity,
          notes: requestNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to submit request.");
      }

      setSubmitFeedback({
        type: "success",
        text: "Your request has been submitted successfully! Our engineering team will review it and update your quotation.",
      });

      // Clear form & refresh
      setRequestTitle("");
      setRequestDescription("");
      setRequestQuantity(1);
      setRequestNotes("");
      await fetchCustomerData(token);

      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitFeedback(null);
      }, 2000);
    } catch (err: any) {
      setSubmitFeedback({
        type: "error",
        text: err.message || "Failed to submit inquiry. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    router.push("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 p-1 flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="VisionCraft Logo"
                  width={28}
                  height={28}
                  className="rounded object-contain"
                />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  Vision<span className="text-blue-500">Craft</span>
                </span>
                <span className="text-[10px] text-blue-400 font-medium block">Customer Portal</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-1 pl-6 border-l border-slate-800">
              <Link
                href="/3d-printing"
                className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>3D Slicer & Calculator</span>
              </Link>
              <Link
                href="/engineering"
                className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition flex items-center space-x-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>PCB Gerber Viewer</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user.role === "FOUNDER" || user.role === "SUPER_ADMIN" ? (
              <Link
                href="/admin"
                className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full hover:bg-amber-500/30 transition"
              >
                Executive Admin &rarr;
              </Link>
            ) : null}

            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
                {user.full_name.charAt(0)}
              </div>
              <span className="text-slate-200 font-medium hidden sm:inline">{user.full_name}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-lg mb-8 border border-blue-800/40 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-medium text-blue-300 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Customer Portal</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome back, {user.full_name}
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-xl">
                Submit 3D models for automated slicing, track your custom enclosures and PCB prototyping jobs, or request engineering consultations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Request Custom Quote</span>
              </button>
              <Link
                href="/3d-printing"
                className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-2"
              >
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Upload 3D STL Model</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-6 space-x-8">
          <button
            onClick={() => setActiveTab("quotations")}
            className={`pb-4 text-sm font-semibold flex items-center space-x-2 transition border-b-2 ${
              activeTab === "quotations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Quotations & Inquiries ({quotations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-4 text-sm font-semibold flex items-center space-x-2 transition border-b-2 ${
              activeTab === "orders"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>My Production Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-4 text-sm font-semibold flex items-center space-x-2 transition border-b-2 ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Account Profile</span>
          </button>
        </div>

        {/* Tab 1: Quotations */}
        {activeTab === "quotations" && (
          <div>
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                <span className="text-xs">Loading your quotations...</span>
              </div>
            ) : quotations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Quotations Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                  You haven't requested any quotations yet. You can upload an STL model for instant slicing or request a custom quote for PCB and engineering projects.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Submit a Quotation Request
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {quote.quotation_number}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            quote.status === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-700"
                              : quote.status === "SENT"
                              ? "bg-blue-100 text-blue-700"
                              : quote.status === "REJECTED"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {quote.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        {quote.items.map((item) => (
                          <div key={item.id} className="text-xs">
                            <span className="font-semibold text-slate-800 block">{item.title}</span>
                            <div className="text-slate-500 text-[11px] flex items-center gap-3 mt-0.5">
                              <span>Qty: {item.quantity}</span>
                              <span>•</span>
                              <span>Material/Type: {item.material}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {quote.notes && (
                        <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4">
                          <strong className="text-slate-700">Notes:</strong> {quote.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Estimate / Total</span>
                        <span className="font-mono text-sm font-bold text-slate-800">
                          {formatLKR(quote.total_amount_lkr)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === "orders" && (
          <div>
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                <span className="text-xs">Loading active orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Production Orders</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                  You do not have any active or previous manufacturing orders. Once your quotation is confirmed, it will appear here for live production and delivery tracking.
                </p>
                <Link
                  href="/3d-printing"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-block"
                >
                  Configure a 3D Print Job
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm font-bold text-slate-800">
                          {order.order_number}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            order.status === "COMPLETED" || order.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-800 animate-pulse"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          Status: {order.status}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            order.payment_status === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          Payment: {order.payment_status}
                        </span>
                      </div>
                    </div>

                    <div className="py-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs text-slate-700 flex justify-between py-1">
                          <span className="font-medium">
                            {item.title} (x{item.quantity})
                          </span>
                          <span className="font-mono font-semibold">{formatLKR(item.total_price_lkr)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>Island-wide courier delivery directly to your doorstep</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Total Amount</span>
                        <span className="font-mono text-base font-bold text-slate-900">
                          {formatLKR(order.total_amount_lkr)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Customer Profile */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Customer Profile Information</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-sm pb-3 border-b border-slate-100">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-400 block">Full Name</span>
                  <span className="font-semibold text-slate-800">{user.full_name}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-sm pb-3 border-b border-slate-100">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-400 block">Email Address</span>
                  <span className="font-semibold text-slate-800">{user.email}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-sm pb-3 border-b border-slate-100">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-400 block">Phone / WhatsApp</span>
                  <span className="font-semibold text-slate-800">{user.phone || "Not specified"}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-sm pb-3 border-b border-slate-100">
                <ShieldCheck className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-400 block">Account Role</span>
                  <span className="font-semibold text-slate-800">{user.role}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Need Immediate Support?</h4>
              <p className="text-xs text-slate-500 mb-4">
                You can directly chat with our engineering workshop team on WhatsApp for project updates, customized quotes, or urgent prototype rush orders.
              </p>
              <a
                href="https://wa.me/94754339117?text=Hi%20VisionCraft!%20I%20have%20an%20inquiry%20regarding%20my%20account"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact Engineering Team on WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Request Custom Quote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Request a Custom Quotation</h3>
            <p className="text-xs text-slate-500 mb-5">
              Submit your engineering or 3D manufacturing project details. Our engineers will review specs and provide an exact cost quotation.
            </p>

            {submitFeedback && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-start space-x-2 ${
                  submitFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {submitFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{submitFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Category
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="3D_PRINTING">3D Printing Services (FDM Prototyping & Production)</option>
                  <option value="PCB_DESIGN">PCB Design & Precision CNC Prototyping</option>
                  <option value="CUSTOM_ENCLOSURE">Custom Electronics Enclosure / Box</option>
                  <option value="ELECTRONICS">Electronic Project & Embedded Systems</option>
                  <option value="CAD_MODEL">3D CAD Modelling & STL Optimization</option>
                  <option value="CRAFTS_DECOR">Crafts, Architectural & Decorative Model</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  placeholder="e.g. Weatherproof IoT Sensor Enclosure"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Required Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={requestQuantity}
                    onChange={(e) => setRequestQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    defaultValue={user.phone || ""}
                    disabled
                    className="w-full text-xs bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Technical Specifications & Description
                </label>
                <textarea
                  rows={3}
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Describe dimensions, material preferences (PLA+, PETG, ABS, TPU), infill, or assembly needs..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Inquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

