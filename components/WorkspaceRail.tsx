"use client";

import { useRouter } from "next/navigation";

type RailKey = "fire" | "accounts" | "next" | "insights" | "week";

const ITEMS: Array<{
  key: RailKey;
  label: string;
  icon: string;
  href: string;
}> = [
  { key: "fire", label: "Fire Queue", icon: "✦", href: "/today" },
  { key: "accounts", label: "Accounts", icon: "⌗", href: "/accounts" },
  { key: "next", label: "Next", icon: "→", href: "/today" },
  { key: "insights", label: "Insights", icon: "◔", href: "/today" },
  { key: "week", label: "Week", icon: "☰", href: "/weekly" },
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
