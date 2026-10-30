import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisionCraft OS – Business Management System",
  description: "VisionCraft Centralized Operating System for FDM 3D Printing, PCB Fabrication, and Engineering Services",
};

export default function RootLayout({
  children,
}: ReadurlencodedProps<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}

type ReadurlencodedProps<T> = T;

