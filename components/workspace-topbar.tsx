import Link from "next/link";
import type { ReactNode } from "react";

export type WorkspaceSection = "design" | "simulation" | "report";

const workspaceLinks: Array<{ id: WorkspaceSection; href: string; label: string; step: string }> = [
  { id: "design", href: "/", label: "수업 설계", step: "1단계" },
  { id: "simulation", href: "/simulation", label: "모의 수업 실행 및 성찰", step: "2단계" },
  { id: "report", href: "/report", label: "보고서 출력", step: "3단계" },
];

export function WorkspaceTopbar({
  active,
  actions,
  navigationHandlers,
  disabledSection,
}: {
  active: WorkspaceSection;
  actions?: ReactNode;
  navigationHandlers?: Partial<Record<WorkspaceSection, () => void | Promise<void>>>;
  disabledSection?: WorkspaceSection | null;
}) {
  return (
    <div className="workspaceTopbar">
      <nav className="workspaceNav" aria-label="주요 화면">
        {workspaceLinks.map((item) => {
          const className = `workspaceNavLink ${item.id === active ? "workspaceNavLink-active" : ""}`;
          const handler = navigationHandlers?.[item.id];
          const isDisabled = disabledSection === item.id;

          if (handler && item.id !== active) {
            return (
              <button
                key={item.id}
                type="button"
                className={className}
                onClick={() => void handler()}
                disabled={isDisabled}
              >
                <span className="workspaceNavStep">{item.step}</span>
                <span className="workspaceNavText">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={className}
              aria-disabled={isDisabled ? true : undefined}
            >
              <span className="workspaceNavStep">{item.step}</span>
              <span className="workspaceNavText">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="workspaceTopbarActions">{actions}</div>
    </div>
  );
}
