"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTopbar } from "@/components/workspace-topbar";
import { findCardById } from "@/lib/card-registry";
import { riskLabels } from "@/lib/constants";
import { buildFallbackReportSnapshot, buildReportHtmlDocument } from "@/lib/report";
import { loadStoredDesign, loadStoredReport, loadStoredSimulation } from "@/lib/storage";
import type { OrchestrationCard } from "@/types/lesson";
import type { SimulationReportSnapshot } from "@/types/report";


const PDF_MARGIN_MM = 12;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}

function sanitizeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "lesson-report"
  );
}

function findCardTitles(ids: string[], customCards: OrchestrationCard[]) {
  return ids.map((id) => findCardById(id, customCards)?.title ?? id);
}

function downloadHtml(report: SimulationReportSnapshot) {
  const html = buildReportHtmlDocument(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFilename(report.design.meta.topic || report.reportTitle)}-report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(report: SimulationReportSnapshot, rootElement: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  if ("fonts" in document) {
    await document.fonts.ready;
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - PDF_MARGIN_MM * 2;
  const printableHeight = pageHeight - PDF_MARGIN_MM * 2;
  const sections = [rootElement];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: Math.max(document.documentElement.clientWidth, section.scrollWidth),
    });

    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    const renderedHeight = (canvas.height * printableWidth) / canvas.width;
    let remainingHeight = renderedHeight;

    if (index > 0) {
      pdf.addPage();
    }

    pdf.addImage(imageData, "JPEG", PDF_MARGIN_MM, PDF_MARGIN_MM, printableWidth, renderedHeight, undefined, "FAST");
    remainingHeight -= printableHeight;

    while (remainingHeight > 0) {
      pdf.addPage();
      const offsetY = PDF_MARGIN_MM - (renderedHeight - remainingHeight);
      pdf.addImage(imageData, "JPEG", PDF_MARGIN_MM, offsetY, printableWidth, renderedHeight, undefined, "FAST");
      remainingHeight -= printableHeight;
    }
  }

  pdf.save(`${sanitizeFilename(report.design.meta.topic || report.reportTitle)}-report.pdf`);
}

const SEVERITY_LABEL: Record<string, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export function ReportViewer() {
  const [report, setReport] = useState<SimulationReportSnapshot | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const reportDocumentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedReport = loadStoredReport();
    if (storedReport) {
      setReport(storedReport);
      return;
    }

    const design = loadStoredDesign();
    const simulation = loadStoredSimulation();
    if (design && simulation) {
      setReport(buildFallbackReportSnapshot({ design, simulation }));
    }
  }, []);

  const activityCards = useMemo(() => {
    if (!report) {
      return new Map<string, { teacher: string[]; ai: string[] }>();
    }

    return new Map(
      report.design.activities.map((activity) => [
        activity.id,
        {
          teacher: findCardTitles(activity.humanCardIds, report.design.customCards),
          ai: findCardTitles(activity.aiCardIds, report.design.customCards),
        },
      ]),
    );
  }, [report]);

  const highRisks = useMemo(() => report?.risks.filter((r) => r.severity === "high") ?? [], [report]);
  const mediumRisks = useMemo(() => report?.risks.filter((r) => r.severity === "medium") ?? [], [report]);
  const lowRisks = useMemo(() => report?.risks.filter((r) => r.severity === "low") ?? [], [report]);

  async function handleDownloadPdf() {
    if (!report || !reportDocumentRef.current || isDownloadingPdf) {
      return;
    }

    setIsDownloadingPdf(true);

    try {
      await downloadPdf(report, reportDocumentRef.current);
    } catch (error) {
      console.error("Failed to generate PDF report", error);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (!report) {
    return (
      <main className="appShell reportPage">
        <section className="panel reportEmptyState">
          <h1>저장된 보고서가 없습니다.</h1>
          <p className="emptyPanelText">먼저 모의 수업 실행 및 성찰 화면에서 `리포트 저장하기`를 눌러 주세요.</p>
          <div className="heroActions">
            <Link href="/simulation" className="primaryButton">
              모의 수업으로 이동
            </Link>
            <Link href="/" className="ghostButton">
              수업 설계로 이동
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="reportShell reportPage reportWithToc">
      <section className="heroPanel printHidden">
        <div className="heroPanelStack">
          <WorkspaceTopbar
            active="report"
            sectionStatus={{ design: "done", simulation: "done", report: "idle" }}
            actions={
              <>
                <button type="button" className="primaryButton" onClick={() => void handleDownloadPdf()} disabled={isDownloadingPdf}>
                  {isDownloadingPdf ? "PDF 생성 중..." : "PDF로 저장"}
                </button>
                <button type="button" className="secondaryButton" onClick={() => downloadHtml(report)}>
                  HTML 다운로드
                </button>
              </>
            }
          />
          <div className="heroPanelMain">
            <div>
              <h1>{report.reportTitle}</h1>
              <p className="heroCopy">생성 시각: {formatDateTime(report.generatedAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <div ref={reportDocumentRef} className="reportDocument">

        {/* ① 수업 설계 내용 */}
        <section id="section-design" className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <h2><span className="reportSectionCircle">①</span>수업 설계 내용</h2>
            </div>
          </div>
          <div className="reportGrid reportGridTwo">
            <article className="reportCard">
              <h3>학습 목표</h3>
              <ul>
                {report.design.learningGoals.length ? (
                  report.design.learningGoals.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>없음</li>
                )}
              </ul>
            </article>
            <article className="reportCard">
              <h3>수업 정보</h3>
              <ul className="reportInfoList">
                <li><span className="reportInfoLabel">교과</span>{report.design.meta.subject || "-"}</li>
                <li><span className="reportInfoLabel">대상</span>{report.design.meta.target || "-"}</li>
              </ul>
            </article>
          </div>
          <div className="reportTableWrap">
            <table className="lessonTable reportTable">
              <thead>
                <tr>
                  <th>기능</th>
                  <th>교과</th>
                  <th>학습활동</th>
                  <th>AI도구</th>
                  <th>평가 방법</th>
                  <th>교사 질문·행동</th>
                  <th>AI 질문·행동</th>
                </tr>
              </thead>
              <tbody>
                {report.design.activities.map((activity) => {
                  const cards = activityCards.get(activity.id) ?? { teacher: [], ai: [] };
                  return (
                    <tr key={activity.id}>
                      <td>{activity.functionLabel || `활동 ${activity.order}`}</td>
                      <td>{activity.subjectLabel || report.design.meta.subject || "-"}</td>
                      <td>{activity.learningActivity || activity.title || "-"}</td>
                      <td>
                        <div className="reportChipWrap">
                          {activity.tools.length ? (
                            activity.tools.map((item) => (
                              <span key={`${activity.id}-tool-${item}`} className="reportChip">{item}</span>
                            ))
                          ) : (
                            <span className="reportChip reportChipMuted">없음</span>
                          )}
                        </div>
                      </td>
                      <td>{activity.assessmentMethod || "-"}</td>
                      <td>
                        <div className="reportChipWrap">
                          {cards.teacher.length ? (
                            cards.teacher.map((item) => (
                              <span key={`${activity.id}-${item}`} className="reportChip">{item}</span>
                            ))
                          ) : (
                            <span className="reportChip reportChipMuted">없음</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="reportChipWrap">
                          {cards.ai.length ? (
                            cards.ai.map((item) => (
                              <span key={`${activity.id}-${item}`} className="reportChip">{item}</span>
                            ))
                          ) : (
                            <span className="reportChip reportChipMuted">없음</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ② 활동별 수업 장면 */}
        <section id="section-simulation" className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <h2><span className="reportSectionCircle">②</span>활동별 수업 장면</h2>
            </div>
          </div>

          {report.turns.length ? (
            <div className="reportStack">
              {report.turns.map((turn) => {
                const cards = activityCards.get(turn.activityId) ?? { teacher: [], ai: [] };
                const topSignal = (turn.activityRiskSignals ?? [])[0];

                return (
                  <article key={turn.id} className="reportSceneCard">
                    <div className="reportSceneHead">
                      <span className="reportSceneIndex">활동 {turn.turnIndex}</span>
                      <h3 className="reportSceneTitle">{turn.activityTitle}</h3>
                    </div>
                    <div className="reportSceneBody">
                      <div className="reportSceneCol">
                        <p className="reportBlockLabel">교사 · AI 역할 분담</p>
                        <div className="reportRoleBlock">
                          <div className="reportRoleRow">
                            <span className="reportRoleBadge reportRoleBadge-teacher">교사</span>
                            <p>{turn.teacherAction}</p>
                          </div>
                          <div className="reportRoleRow">
                            <span className="reportRoleBadge reportRoleBadge-ai">AI</span>
                            <p>{turn.aiAction}</p>
                          </div>
                        </div>
                        {(cards.teacher.length > 0 || cards.ai.length > 0) && (
                          <div className="reportCardChips">
                            {cards.teacher.map((c) => (
                              <span key={c} className="reportChip reportChip-teacher">{c}</span>
                            ))}
                            {cards.ai.map((c) => (
                              <span key={c} className="reportChip reportChip-ai">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="reportSceneCol">
                        <p className="reportBlockLabel">핵심 관찰 포인트</p>
                        <p className="reportObserverNote">{turn.observerNote}</p>
                        {topSignal && (
                          <div className="reportSignalChip">
                            <span className="reportSignalIcon">⚠</span>
                            {topSignal}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="emptyPanelText">저장된 실행 로그가 없습니다.</p>
          )}
        </section>

        {/* ③ 위험 신호 */}
        <section id="section-risks" className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <h2><span className="reportSectionCircle">③</span>위험 신호</h2>
            </div>
          </div>

          {report.risks.length ? (
            <div className="reportStack">
              {[
                { label: "HIGH", items: highRisks, cls: "high" },
                { label: "MEDIUM", items: mediumRisks, cls: "medium" },
                { label: "LOW", items: lowRisks, cls: "low" },
              ]
                .filter(({ items }) => items.length > 0)
                .map(({ label, items, cls }) => (
                  <div key={label} className={`reportRiskGroup reportRiskGroup-${cls}`}>
                    <p className={`reportRiskGroupLabel reportRiskGroupLabel-${cls}`}>{SEVERITY_LABEL[cls] ?? label}</p>
                    {items.map((risk) => (
                      <div key={risk.id} className="reportRiskRow">
                        <strong className="reportRiskType">{riskLabels[risk.riskType]}</strong>
                        <p className="reportRiskIntervention">→ {risk.recommendedIntervention}</p>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          ) : (
            <p className="emptyPanelText">주요 위험이 없습니다.</p>
          )}
        </section>

        {/* ④ 교사 성찰 */}
        <section id="section-reflection" className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <h2><span className="reportSectionCircle">④</span>교사 성찰</h2>
            </div>
          </div>

          {report.summary ? (
            <div className="reportReflectionCard">
              <p className="reportBlockLabel">수업 총평</p>
              <p className="reportReflectionText">{report.summary}</p>
            </div>
          ) : null}

          {report.questions.length ? (
            <div className="reportStack">
              {report.questions
                .filter((q) => report.answers[q.id])
                .map((question) => (
                  <div key={question.id} className="reportReflectionQA">
                    <p className="reportReflectionQ">{question.prompt}</p>
                    <div className="reportAnswerBlock">{report.answers[question.id]}</div>
                  </div>
                ))}
              {report.questions.every((q) => !report.answers[q.id]) && (
                <p className="emptyPanelText">작성된 성찰 답변이 없습니다.</p>
              )}
            </div>
          ) : (
            <p className="emptyPanelText">생성된 성찰 질문이 없습니다.</p>
          )}

          {report.nextRevisionNotes?.length ? (
            <div className="reportReflectionCard" style={{ marginTop: 16 }}>
              <p className="reportBlockLabel">다음 수업에서 바꿀 것</p>
              <ul className="reportRevisionList">
                {report.nextRevisionNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

      </div>
    </main>
  );
}
