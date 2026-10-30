"use client";

import { Bell, Search, ShieldCheck } from "lucide-react";

interface HeaderProps {
  currentPartner: string;
  onPartnerChange: (partner: string) => void;
}

export function Header({ currentPartner, onPartnerChange }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-4">
        <div className="relative w-64 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search quotations, CAD models, stock, ledger..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>
        <div className="hidden md:flex items-center space-x-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Double-Entry Balance: STRICT ACID</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Partner Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Active Partner:
          </span>
          <select
            value={currentPartner}
            onChange={(e) => onPartnerChange(e.target.value)}
            className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="Janitha">Janitha (Founder)</option>
            <option value="Lalitha">Lalitha (Founder)</option>
            <option value="Thakshila">Thakshila (Founder)</option>
            <option value="Melanka">Melanka (Founder)</option>
            <option value="Super Administrator">Super Admin</option>
          </select>
        </div>

        <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
          {currentPartner.charAt(0)}
        </div>
      </div>
    </header>
  );
}

