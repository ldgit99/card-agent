import Link from "next/link";
import type { ReactNode } from "react";

export type WorkspaceSection = "design" | "simulation" | "report";

const workspaceLinks: Array<{
  id: WorkspaceSection;
  href: string;
  label: string;
  step: string;
  meta: string;
}> = [
  { id: "design", href: "/", label: "수업 설계", step: "01", meta: "주제, 목표, 활동과 질문·행동 설계" },
  {
    id: "simulation",
    href: "/simulation",
    label: "모의 수업 실행 및 성찰",
    step: "02",
    meta: "수업 이야기, agency 문제점, 활동별 성찰",
  },
  {
    id: "report",
    href: "/report",
    label: "보고서 출력",
    step: "03",
    meta: "설계와 실행 결과를 정리한 공유용 보고서",
  },
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
  const activeLink = workspaceLinks.find((item) => item.id === active) ?? workspaceLinks[0];

  return (
    <div className="workspaceChrome">
      <div className="workspaceCoursebar">
        <div className="workspaceCourseIdentity">
          <span className="workspaceMenuButton" aria-hidden="true">
            ≡
          </span>
          <div className="workspaceCourseCopy">
            <strong>AI 오케스트레이션 수업 설계 스튜디오</strong>
            <span>{activeLink.label}</span>
          </div>
        </div>
        <div className="workspaceTopbarActions">{actions}</div>
      </div>

      <aside className="workspaceTopbar" aria-label="주요 단계">
        <div className="workspaceSidebarHeading">
          <p className="workspaceSidebarEyebrow">목차</p>
          <p className="workspaceSidebarHint">{activeLink.meta}</p>
        </div>
        <nav className="workspaceNav" aria-label="주요 화면">
          {workspaceLinks.map((item) => {
            const className = `workspaceNavLink ${item.id === active ? "workspaceNavLink-active" : ""}`;
            const handler = navigationHandlers?.[item.id];
            const isDisabled = disabledSection === item.id;

            const content = (
              <>
                <span className="workspaceNavStep">{item.step}</span>
                <span className="workspaceNavCopy">
                  <span className="workspaceNavText">{item.label}</span>
                  <span className="workspaceNavMeta">{item.meta}</span>
                </span>
              </>
            );

            if (handler && item.id !== active) {
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
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
