import Link from "next/link";
import { Fragment } from "react";
import type { ReactNode } from "react";

export type WorkspaceSection = "design" | "simulation" | "report";

export type SectionStatus = "idle" | "done" | "locked";

const workspaceLinks: Array<{
  id: WorkspaceSection;
  href: string;
  label: string;
}> = [
  { id: "design", href: "/", label: "수업 설계" },
  { id: "simulation", href: "/simulation", label: "모의 수업 실행 및 성찰" },
  { id: "report", href: "/report", label: "보고서 출력" },
];

function LockIcon() {
  return (
    <svg
      className="workspaceNavLockIcon"
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-label="잠금"
    >
      <rect x="1.5" y="5.5" width="10" height="6.5" rx="1.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.75 5.5V3.75a2.75 2.75 0 0 1 5.5 0V5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return null;
  }
  if (status === "locked") {
    return (
      <span className="workspaceNavStatusIcon workspaceNavStatusIcon-locked">
        <LockIcon />
      </span>
    );
  }
  return null;
}

function NavConnector({ done }: { done: boolean }) {
  return (
    <div className={`workspaceNavConnector${done ? " workspaceNavConnector-done" : ""}`} aria-hidden="true">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M1 5h12M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
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
        {workspaceLinks.map((item, index) => {
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
              <span className="workspaceNavStepCircle">{index + 1}</span>
              <span className="workspaceNavText">{item.label}</span>
              <StatusIcon status={status} />
            </>
          );

          const node = handler && !isActive ? (
            <button
              type="button"
              className={className}
              onClick={() => void handler()}
              disabled={isDisabled}
            >
              {content}
            </button>
          ) : (
            <Link
              href={item.href}
              className={className}
              aria-disabled={isDisabled ? true : undefined}
              tabIndex={isDisabled ? -1 : undefined}
            >
              {content}
            </Link>
          );

          return (
            <Fragment key={item.id}>
              {node}
              {index < workspaceLinks.length - 1 && (
                <NavConnector done={status === "done"} />
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="workspaceTopbarActions">{actions}</div>
    </div>
  );
}
