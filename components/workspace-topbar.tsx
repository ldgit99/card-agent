import Link from "next/link";
import type { ReactNode } from "react";

export type WorkspaceSection = "design" | "simulation" | "report";

export type SectionStatus = "idle" | "done" | "locked";

const workspaceLinks: Array<{
  id: WorkspaceSection;
  href: string;
  step: string;
  label: string;
}> = [
  { id: "design", href: "/", step: "1단계", label: "수업 설계" },
  { id: "simulation", href: "/simulation", step: "2단계", label: "모의 수업 실행 및 성찰" },
  { id: "report", href: "/report", step: "3단계", label: "보고서 출력" },
];

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return (
      <span className="workspaceNavStatusIcon workspaceNavStatusIcon-done" aria-label="완료">
        ✓
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="workspaceNavStatusIcon workspaceNavStatusIcon-locked" aria-label="잠금">
        🔒
      </span>
    );
  }
  return null;
}

export function WorkspaceTopbar({
  active,
  actions,
  navigationHandlers,
  disabledSection,
  sectionStatus,
}: {
  active: WorkspaceSection;
  actions?: ReactNode;
  navigationHandlers?: Partial<Record<WorkspaceSection, () => void | Promise<void>>>;
  disabledSection?: WorkspaceSection | null;
  sectionStatus?: Partial<Record<WorkspaceSection, SectionStatus>>;
}) {
  return (
    <div className="workspaceTopbar">
      <nav className="workspaceNav" aria-label="주요 화면">
        {workspaceLinks.map((item) => {
          const status = sectionStatus?.[item.id] ?? "idle";
          const isActive = item.id === active;
          const isLocked = status === "locked";
          const className = [
            "workspaceNavLink",
            isActive ? "workspaceNavLink-active" : "",
            status === "done" && !isActive ? "workspaceNavLink-done" : "",
            isLocked ? "workspaceNavLink-locked" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const handler = navigationHandlers?.[item.id];
          const isDisabled = disabledSection === item.id || isLocked;

          const content = (
            <>
              <span className="workspaceNavStep">{item.step}</span>
              <span className="workspaceNavText">{item.label}</span>
              <StatusIcon status={status} />
            </>
          );

          if (handler && !isActive) {
            return (
              <button
                key={item.id}
                type="button"
                className={className}
                onClick={() => void handler()}
                disabled={isDisabled}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={className}
              aria-disabled={isDisabled ? true : undefined}
              tabIndex={isDisabled ? -1 : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>
      <div className="workspaceTopbarActions">{actions}</div>
    </div>
  );
}
