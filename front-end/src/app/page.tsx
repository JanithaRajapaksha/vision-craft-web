"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getStoredUser, clearAuthSession, AuthUser, isFounder } from "@/lib/auth";
import {
  Layers,
  Cpu,
  Box,
  Compass,
  Palette,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Truck,
  Menu,
  X,
  User,
  LogOut,
  ChevronRight,
  Sparkles,
  Wrench,
} from "lucide-react";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    window.location.reload();
  };

  const services = [
    {
      title: "3D Printing Services",
      image: "/images/3d_printing_services.png",
      tag: "FDM Manufacturing",
      description:
        "High-precision FDM 3D printing for functional prototypes, mechanical replacement parts, and low-volume production batches. Printed in PLA+, PETG, ABS, and TPU flexible filaments.",
      link: "/3d-printing",
      cta: "Launch 3D Slicer",
      bullets: [
        "Rapid prototyping for engineering & student projects",
        "Durable, load-bearing functional parts with 0.1-0.3mm layer height",
        "Multi-material capability: PLA+, PETG, ABS, and TPU",
      ],
    },
    {
      title: "PCB Design & CNC Fabrication",
      image: "/images/pcb_services.png",
      tag: "Hardware Prototyping",
      description:
        "Professional PCB schematic capture, circuit layout optimization, and precision CNC isolation milling for rapid electronics prototyping without waiting weeks for overseas fabrication.",
      link: "/engineering",
      cta: "PCB Gerber Viewer",
      bullets: [
        "Vector RS-274X Gerber & Excellon drill inspection",
        "Sub-millimeter CNC circuit isolation milling",
        "Fast 24-48h turnaround for local electronics testing",
      ],
    },
    {
      title: "Custom Enclosures & Casings",
      image: "/images/custom_enclosures.png",
      tag: "Product Packaging",
      description:
        "Precision-fitted custom enclosures designed specifically for your PCBs, sensors, relays, IoT nodes, and mechanical assemblies with screw mounts, snap-fits, and cable grommets.",
      link: "/portal",
      cta: "Request Enclosure Quote",
      bullets: [
        "Perfect tolerance fit for custom circuit boards & displays",
        "Weather-resistant & durable materials for field devices",
        "Custom cutouts for USB, DC jacks, switches, and heat vents",
      ],
    },
    {
      title: "Electronic Projects & Prototyping",
      image: "/images/electronic_projects.jpg",
      tag: "Embedded Systems",
      description:
        "End-to-end engineering support for student and industrial electronics projects. From circuit design and component selection to embedded firmware and full system integration.",
      link: "/portal",
      cta: "Consult Engineers",
      bullets: [
        "Hardware circuit design & breadboard validation",
        "Sensor integration, microcontroller firmware & IoT telemetry",
        "Troubleshooting, debugging, and final prototype assembly",
      ],
    },
    {
      title: "3D CAD Modelling & Design Assistance",
      image: "/images/design_assistance.png",
      tag: "CAD Engineering",
      description:
        "Parametric CAD modeling, reverse engineering from physical components, STL polygon mesh fixing, and Design for Additive Manufacturing (DFAM) optimization.",
      link: "/portal",
      cta: "Submit CAD Inquiry",
      bullets: [
        "Parametric 3D solid modeling from sketches or dimensions",
        "STL mesh repair, wall thickness check & slicing optimization",
        "Design modifications to optimize print strength and reduce cost",
      ],
    },
    {
      title: "Crafts, Architectural & Decorative Prints",
      image: "/images/crafts_decorative_prints.png",
      tag: "Custom Fabrication",
      description:
        "Precision architectural scale models, artistic creations, customized company nameplates, trophies, and intricate decorative prints manufactured with immaculate surface finish.",
      link: "/portal",
      cta: "Custom Fabrication Quote",
      bullets: [
        "Architectural elevation & site scale models",
        "Personalized corporate awards, logos, and branded items",
        "High-detail aesthetic prints in metallic and vibrant finishes",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Floating WhatsApp Action Button */}
      <a
        href="https://wa.me/94754339117?text=Hi%20VisionCraft!%20I'm%20interested%20in%20your%203D%20printing%20and%20engineering%20services."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 border-2 border-emerald-400/40 group"
        title="Chat with VisionCraft on WhatsApp"
      >
        <div className="relative w-7 h-7 flex items-center justify-center">
          <Image
            src="/images/whatsapp.png"
            alt="WhatsApp"
            width={28}
            height={28}
            className="object-contain filter brightness-0 invert"
          />
        </div>
        <span className="hidden sm:inline font-bold text-xs tracking-wide">
          Quick WhatsApp Chat
        </span>
      </a>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg group-hover:border-blue-500 transition-colors">
              <Image
                src="/logo.jpg"
                alt="VisionCraft Logo"
                width={36}
                height={36}
                className="rounded-lg object-contain"
              />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block leading-none">
                Vision<span className="text-blue-500">Craft</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium block mt-1">
                Engineering & FDM Sri Lanka
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#services" className="hover:text-blue-400 transition-colors">
              Services
            </a>
            <a href="#capabilities" className="hover:text-blue-400 transition-colors">
              Capabilities
            </a>
            <a href="#showcase" className="hover:text-blue-400 transition-colors">
              Showcase
            </a>
            <a href="#locations" className="hover:text-blue-400 transition-colors">
              Locations
            </a>
            <Link
              href="/3d-printing"
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
            >
              <Layers className="w-4 h-4" />
              <span>3D Slicer</span>
            </Link>
            <Link
              href="/engineering"
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center space-x-1"
            >
              <Cpu className="w-4 h-4" />
              <span>PCB Viewer</span>
            </Link>
          </nav>

          {/* Authentication & Portal Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-2">
                {isFounder(currentUser) ? (
                  <Link
                    href="/admin"
                    className="px-3.5 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Founder Admin Hub
                  </Link>
                ) : (
                  <Link
                    href="/portal"
                    className="px-3.5 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>My Portal</span>
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition shadow-blue-600/20"
                >
                  Register Account
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-4">
            <a
              href="#services"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-200 py-2 border-b border-slate-800"
            >
              Services
            </a>
            <a
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-200 py-2 border-b border-slate-800"
            >
              Capabilities & Equipment
            </a>
            <a
              href="#showcase"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-200 py-2 border-b border-slate-800"
            >
              Gallery & Showcase
            </a>
            <a
              href="#locations"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-200 py-2 border-b border-slate-800"
            >
              Locations & Contact
            </a>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href="/3d-printing"
                className="p-2.5 bg-blue-950/60 border border-blue-800/60 rounded-lg text-xs font-semibold text-blue-300 flex items-center space-x-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>3D Slicer Tool</span>
              </Link>
              <Link
                href="/engineering"
                className="p-2.5 bg-emerald-950/60 border border-emerald-800/60 rounded-lg text-xs font-semibold text-emerald-300 flex items-center space-x-1.5"
              >
                <Cpu className="w-4 h-4" />
                <span>PCB Gerber Tool</span>
              </Link>
            </div>
            <div className="pt-2 flex items-center space-x-2">
              {currentUser ? (
                <div className="flex w-full space-x-2">
                  <Link
                    href={isFounder(currentUser) ? "/admin" : "/portal"}
                    className="flex-1 text-center py-2 bg-blue-600 rounded-lg text-xs font-semibold text-white"
                  >
                    Open {isFounder(currentUser) ? "Founder Hub" : "Customer Portal"}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 bg-slate-800 rounded-lg text-rose-400"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Link
                    href="/login"
                    className="text-center py-2 bg-slate-800 rounded-lg text-xs font-semibold text-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-center py-2 bg-blue-600 rounded-lg text-xs font-semibold text-white"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        {/* Background ambient lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-blue-600/20 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Sri Lanka's Premier Rapid Prototyping & Engineering Hub</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Engineering-Grade <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400">3D Printing</span> & Electronics Fabrication
          </h1>

          {/* Tagline */}
          <p className="mt-4 text-base sm:text-lg font-medium text-slate-300 max-w-2xl mx-auto">
            Custom 3D Printing, Enclosures, Precision CNC PCB Prototyping & Embedded Hardware in Sri Lanka.
          </p>

          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            From single concept prototypes to small-batch production runs. Fast 24-48h turnaround with strict dimensional tolerances and island-wide delivery.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-3">
            <Link
              href="/3d-printing"
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center space-x-2"
            >
              <Layers className="w-4 h-4" />
              <span>Instant 3D Slicer & Quoting</span>
            </Link>

            <Link
              href="/engineering"
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 transition flex items-center space-x-2"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>PCB Gerber & Drill Viewer</span>
            </Link>

            <Link
              href="/register"
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 transition flex items-center space-x-2"
            >
              <User className="w-4 h-4 text-blue-400" />
              <span>Customer Portal Sign Up</span>
            </Link>
          </div>

          {/* Key Engineering Trust Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <span className="text-2xl font-black text-white block">3 Hubs</span>
              <span className="text-xs text-slate-400 block mt-0.5">Rathmalana • Galle • Wadduwa</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <span className="text-2xl font-black text-blue-400 block">0.1 - 0.3mm</span>
              <span className="text-xs text-slate-400 block mt-0.5">Precision Layer Height</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <span className="text-2xl font-black text-emerald-400 block">24 - 48h</span>
              <span className="text-xs text-slate-400 block mt-0.5">Rapid Prototype Turnaround</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <span className="text-2xl font-black text-indigo-400 block">100%</span>
              <span className="text-xs text-slate-400 block mt-0.5">Island-Wide Courier Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-slate-900/50 border-t border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-2">
              Engineering Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Our Professional Services
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Complete additive manufacturing and electronics prototyping solutions under one roof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((svc) => (
              <div
                key={svc.title}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/60 hover:shadow-xl hover:shadow-blue-600/10 transition-all duration-300 flex flex-col group"
              >
                {/* Image Preview */}
                <div className="relative h-52 w-full overflow-hidden bg-slate-950 border-b border-slate-800">
                  <Image
                    src={svc.image}
                    alt={svc.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-blue-400 border border-slate-700">
                    {svc.tag}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                      {svc.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      {svc.description}
                    </p>

                    <div className="space-y-1.5 mb-6">
                      {svc.bullets.map((b, idx) => (
                        <div key={idx} className="flex items-start space-x-2 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={svc.link}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5"
                  >
                    <span>{svc.cta}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities & Engineering Materials Section */}
      <section id="capabilities" className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-2">
                Workshop & Laboratory
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                Advanced Workshop Equipment & Materials
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                Unlike consumer hobbyists, VisionCraft maintains an industrial-grade additive manufacturing farm and electronics lab. We specialize in selecting the exact thermopolymer and layout density required for your mechanical stress, temperature, or UV exposure constraints.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs mb-1">
                    <Layers className="w-4 h-4" />
                    <span>Thermopolymers</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PLA+ for aesthetics, PETG for chemical & UV resistance, ABS/ASA for thermal stability, and TPU (95A) for gaskets & flex joints.
                  </p>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs mb-1">
                    <Cpu className="w-4 h-4" />
                    <span>CNC PCB Milling</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    High-RPM spindle isolation routing for copper FR4 clad boards with Excellon drill hole punching for immediate through-hole soldering.
                  </p>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs mb-1">
                    <Wrench className="w-4 h-4" />
                    <span>Hardware Integration</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Brass threaded heat-set inserts (M2, M3, M4) embedded into 3D prints for strong, reusable machine-screw fastening.
                  </p>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs mb-1">
                    <Truck className="w-4 h-4" />
                    <span>Courier Logistics</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Secure foam-padded packaging with same-day dispatch via domestic express couriers across all 25 districts in Sri Lanka.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Material Spectrum Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
              <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <span>Supported Engineering Materials</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-slate-200 mb-1">
                    <span>PLA+ (High-Impact Polylactic Acid)</span>
                    <span className="text-blue-400">General Prototypes</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[85%]" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Excellent surface finish, sharp corners, stiff mechanical response.</span>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-200 mb-1">
                    <span>PETG (Polyethylene Terephthalate Glycol)</span>
                    <span className="text-emerald-400">Outdoor & Chemical</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[90%]" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Superior layer adhesion, weather-resistant, non-brittle, semi-flexible.</span>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-200 mb-1">
                    <span>ABS / ASA (UV & Heat Resilient)</span>
                    <span className="text-indigo-400">Thermal Durability</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full w-[80%]" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Heat resistance up to 95°C, high impact resistance for vehicle & industrial use.</span>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-200 mb-1">
                    <span>TPU (Thermoplastic Polyurethane 95A)</span>
                    <span className="text-amber-400">Flexible Shock Absorption</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full w-[95%]" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">High abrasion resistance, rubber-like flexibility, impact bumpers and seals.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Gallery */}
      <section id="showcase" className="py-20 bg-slate-900/60 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-2">
              Portfolio
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Manufactured Works Showcase
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              A sample of actual client parts, electronics enclosures, and custom prototypes manufactured by VisionCraft.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Custom Sensor Housing & Box",
                category: "Custom Enclosure",
                image: "/images/custom_enclosures.png",
              },
              {
                title: "Electronic Hardware Development",
                category: "Electronics",
                image: "/images/electronic_projects.jpg",
              },
              {
                title: "Precision PCB Prototyping",
                category: "PCB Engineering",
                image: "/images/pcb_services.png",
              },
              {
                title: "Additive Functional Prototype",
                category: "3D Printing",
                image: "/images/3d_printing_services.png",
              },
              {
                title: "CAD Mesh Optimization & Design",
                category: "Design Assistance",
                image: "/images/design_assistance.png",
              },
              {
                title: "Architectural & Creative Model",
                category: "Crafts & Models",
                image: "/images/crafts_decorative_prints.png",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="group relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md hover:border-slate-700 transition"
              >
                <div className="relative h-64 w-full">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 inline-block mb-1">
                      {item.category}
                    </span>
                    <h4 className="text-sm font-bold text-white block">{item.title}</h4>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section id="locations" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-2">
              Physical Presence
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Our Locations Across Sri Lanka
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Pick up prototypes in person or contact our regional representatives directly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Rathmalana Main Office */}
            <div className="bg-slate-900 border-2 border-blue-600/60 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>Main Office & Primary Farm</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Rathmalana</h3>
                <p className="text-xs text-slate-300 mb-4">
                  47/2, Kandawala Rd, Rathmalana, Western Province.
                </p>

                <div className="h-44 w-full rounded-xl overflow-hidden mb-4 border border-slate-700">
                  <iframe
                    title="VisionCraft Rathmalana Location Map"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.2686447895744!2d79.88621607475849!3d6.855878893150684!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae25a4e8e0e8e8f%3A0x0!2zNsKwNTEnMjEuMiJOIDc5wrA1MyczMy4xIkU!5e0!3m2!1sen!2slk!4v1234567890"
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              </div>

              <a
                href="https://wa.me/94754339117?text=Hi!%20I'd%20like%20to%20visit%20your%20Rathmalana%20office"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>+94 75 433 9117 (WhatsApp)</span>
              </a>
            </div>

            {/* Galle Branch */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>Southern Province Hub</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Galle</h3>
                <p className="text-xs text-slate-300 mb-6">
                  384, 185 Wakwella Rd, Galle, Southern Province.
                </p>

                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-6 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>Mon - Sun: 9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Southern express courier collection</span>
                  </div>
                </div>
              </div>

              <a
                href="https://wa.me/94752585027?text=Hi!%20I'd%20like%20to%20contact%20your%20Galle%20location"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>+94 75 258 5027 (WhatsApp)</span>
              </a>
            </div>

            {/* Wadduwa Hub */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>Kalutara District Workshop</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Wadduwa</h3>
                <p className="text-xs text-slate-300 mb-6">
                  Thilina, Pothupitiya North, Palawatta Road, Wadduwa.
                </p>

                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-6 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>Mon - Sun: 9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Local pickup & island-wide drop-off</span>
                  </div>
                </div>
              </div>

              <a
                href="https://wa.me/94754339117?text=Hi!%20I'd%20like%20to%20visit%20your%20Wadduwa%20location"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>+94 75 433 9117 (WhatsApp)</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & CTA Section */}
      <section id="contact" className="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to Build Your Engineering Prototype?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto mb-8">
            Upload your STL models for instant pricing, test your PCB drill hits with our RS-274X viewer, or message our engineers directly.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-center">
              <Mail className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-white block">Email Direct</span>
              <a href="mailto:vcgraphicsofficial@gmail.com" className="text-xs text-blue-400 hover:underline">
                vcgraphicsofficial@gmail.com
              </a>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-center">
              <Phone className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-white block">WhatsApp Hotline</span>
              <span className="text-xs text-emerald-400 font-mono">+94 75 433 9117</span>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-center">
              <ExternalLink className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-white block">Facebook Community</span>
              <a
                href="https://www.facebook.com/profile.php?id=61568434089038"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline"
              >
                VisionCraft Page
              </a>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-3">
            <Link
              href="/register"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/25 transition"
            >
              Register Customer Account
            </Link>
            <a
              href="https://wa.me/94754339117?text=Hi%20VisionCraft!%20I'd%20like%20to%20discuss%20a%20new%20project."
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center space-x-2"
            >
              <Image
                src="/images/whatsapp.png"
                alt=""
                width={18}
                height={18}
                className="brightness-0 invert object-contain"
              />
              <span>Chat Directly on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="VisionCraft Logo"
                  width={28}
                  height={28}
                  className="rounded object-contain"
                />
              </div>
              <div>
                <span className="font-bold text-sm text-white block">VisionCraft</span>
                <span className="text-[11px] text-slate-500">
                  Custom 3D Printing, Designing & Electronic Projects in Sri Lanka
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <Link href="/3d-printing" className="hover:text-white transition">
                3D Slicer & Quoting
              </Link>
              <Link href="/engineering" className="hover:text-white transition">
                PCB Gerber Engine
              </Link>
              <Link href="/portal" className="hover:text-white transition">
                Customer Portal
              </Link>
              <Link href="/login" className="hover:text-white transition">
                Management Login
              </Link>
            </div>

            <p className="text-slate-500 text-[11px] text-center md:text-right">
              &copy; {new Date().getFullYear()} VisionCraft. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
