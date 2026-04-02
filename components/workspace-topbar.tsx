import Link from "next/link";
import type { ReactNode } from "react";

type WorkspaceSection = "design" | "simulation" | "report";

const workspaceLinks: Array<{ id: WorkspaceSection; href: string; label: string }> = [
  { id: "design", href: "/", label: "수업 설계" },
  { id: "simulation", href: "/simulation", label: "모의 수업 실행 및 성찰" },
  { id: "report", href: "/report", label: "보고서 출력" },
];

export function WorkspaceTopbar({
  active,
  actions,
}: {
  active: WorkspaceSection;
  actions?: ReactNode;
}) {
  return (
    <div className="workspaceTopbar">
      <nav className="workspaceNav" aria-label="주요 화면">
        {workspaceLinks.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`workspaceNavLink ${item.id === active ? "workspaceNavLink-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="workspaceTopbarActions">{actions}</div>
    </div>
  );
}
