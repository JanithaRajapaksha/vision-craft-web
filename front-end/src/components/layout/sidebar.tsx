"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Cpu,
  Users,
  FileText,
  Briefcase,
  Layers,
  BookOpen,
  DollarSign,
  PlusCircle,
  Activity,
  ShoppingBag,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Executive Dashboard", href: "/", icon: Activity },
  { name: "3D Printing (FDM)", href: "/3d-printing", icon: Layers },
  { name: "Orders & Queue", href: "/orders", icon: ShoppingBag },
  { name: "PCB & Engineering", href: "/engineering", icon: Cpu },
  { name: "Customer CRM", href: "/customers", icon: Users },
  { name: "Quotations", href: "/quotations", icon: FileText },
  { name: "Projects & Production", href: "/projects", icon: Briefcase },
  { name: "Inventory & Stock", href: "/inventory", icon: Boxes },
  { name: "Double-Entry Ledger", href: "/accounting", icon: BookOpen },
  { name: "4 Partners Hub", href: "/founders", icon: DollarSign },
  { name: "System & Resources", href: "/system", icon: Server },
];

interface SidebarProps {
  onOpenQuickExpense: () => void;
}

export function Sidebar({ onOpenQuickExpense }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-extrabold text-white shadow-md text-base tracking-wider">
              V
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">
                VisionCraft
              </span>
              <span className="text-[11px] text-blue-400 font-medium block mt-1">
                Engineering & FDM
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="p-4">
          <button
            onClick={onOpenQuickExpense}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-3 rounded-md text-sm shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-slate-800 text-blue-400 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Partners Footer Card */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/80 rounded-lg p-3 text-xs">
          <span className="font-semibold text-slate-200 block mb-1">
            4 Co-Founders
          </span>
          <div className="grid grid-cols-2 gap-1 text-slate-400 font-medium">
            <span>• Janitha</span>
            <span>• Lalitha</span>
            <span>• Thakshila</span>
            <span>• Melanka</span>
          </div>
          <div className="mt-2 text-[10px] text-blue-400 uppercase tracking-wider font-bold">
            Currency: LKR (Rs.)
          </div>
        </div>
      </div>
    </aside>
  );
}

