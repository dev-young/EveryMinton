"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "일정" },
  { href: "/members", label: "모임원" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex bg-white border-b border-[var(--color-border)]">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-colors ${
              isActive
                ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] border-transparent"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
