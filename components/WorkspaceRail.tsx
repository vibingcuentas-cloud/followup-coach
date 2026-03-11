"use client";

import { useRouter } from "next/navigation";

type RailKey = "fire" | "accounts" | "week";

const ITEMS: Array<{
  key: RailKey;
  label: string;
  icon: string;
  href: string;
}> = [
  { key: "accounts", label: "Setup", icon: "⌗", href: "/accounts" },
  { key: "fire", label: "Execute", icon: "✦", href: "/today" },
  { key: "week", label: "Review", icon: "☰", href: "/weekly" },
];

export default function WorkspaceRail({ active }: { active: RailKey }) {
  const router = useRouter();

  return (
    <aside className="opsRail desktopOnly">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          className={`opsRailItem ${active === item.key ? "active" : ""}`}
          onClick={() => router.push(item.href)}
          aria-current={active === item.key ? "page" : undefined}
        >
          <span className="opsRailIcon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="opsRailLabel">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
