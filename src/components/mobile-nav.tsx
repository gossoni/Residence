"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type NavLink = { href: string; label: string; icon: string };

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-full z-50 border-b border-slate-200 bg-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
                aria-label="Fermer le menu"
              >
                ✕
              </button>
            </div>
            <nav className="mt-5 flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <span>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
