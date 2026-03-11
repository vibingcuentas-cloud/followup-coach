"use client";

import { useRouter } from "next/navigation";

type FlowStep = "setup" | "execute" | "review";

const STEPS: Array<{ key: FlowStep; label: string; href: string }> = [
  { key: "setup", label: "1. Setup", href: "/accounts" },
  { key: "execute", label: "2. Execute", href: "/today" },
  { key: "review", label: "3. Review", href: "/weekly" },
];

export default function FlowCycleNav({ active }: { active: FlowStep }) {
  const router = useRouter();

  return (
    <div className="opsFlowRow">
      <div className="opsFlowHint">Workflow</div>
      <nav className="opsFlowNav" aria-label="Product workflow">
        {STEPS.map((step) => (
          <button
            key={step.key}
            className={`opsFlowStep ${active === step.key ? "active" : ""}`}
            aria-current={active === step.key ? "page" : undefined}
            onClick={() => router.push(step.href)}
          >
            {step.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
