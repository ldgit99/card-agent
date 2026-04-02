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
  const captureTargets = Array.from(rootElement.querySelectorAll<HTMLElement>("[data-report-section]"));
  const sections = captureTargets.length ? captureTargets : [rootElement];

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
      <main className="appShell">
        <section className="panel reportEmptyState">
          <p className="sectionTag">Report</p>
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
    <main className="reportShell">
      <section className="heroPanel printHidden">
        <div className="heroPanelStack">
          <WorkspaceTopbar
            active="report"
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
              <p className="eyebrow">Teacher Agent Report</p>
              <h1>{report.reportTitle}</h1>
              <p className="heroCopy">생성 시각: {formatDateTime(report.generatedAt)}</p>
            </div>
            <div className="heroStatRack">
              <article className="heroStatCard">
                <span>주제</span>
                <strong>{report.design.meta.topic || "미입력"}</strong>
              </article>
              <article className="heroStatCard">
                <span>교과</span>
                <strong>{report.design.meta.subject || "미입력"}</strong>
              </article>
              <article className="heroStatCard">
                <span>대상</span>
                <strong>{report.design.meta.target || "미입력"}</strong>
              </article>
              <article className="heroStatCard">
                <span>활동 수</span>
                <strong>{report.design.activities.length}개</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <div ref={reportDocumentRef} className="reportDocument">
        <section className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <p className="sectionTag">Lesson Design</p>
              <h2>수업 설계 내용</h2>
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
              <h3>설계 정보</h3>
              <ul>
                <li>버전 {report.design.version}</li>
                <li>생성 {formatDateTime(report.design.createdAt)}</li>
                <li>수정 {formatDateTime(report.design.updatedAt)}</li>
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
                              <span key={`${activity.id}-tool-${item}`} className="reportChip">
                                {item}
                              </span>
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
                              <span key={`${activity.id}-${item}`} className="reportChip">
                                {item}
                              </span>
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
                              <span key={`${activity.id}-${item}`} className="reportChip">
                                {item}
                              </span>
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

        <section className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <p className="sectionTag">Simulation Results</p>
              <h2>모의 수업 실행 결과</h2>
            </div>
          </div>
          {report.turns.length ? (
            <div className="reportStack">
              {report.turns.map((turn) => {
                const cards = activityCards.get(turn.activityId) ?? { teacher: [], ai: [] };

                return (
                <article key={turn.id} className="reportCard">
                  <div className="reportEpisodeHead">
                    <span className="reportChip">{turn.turnIndex}차 활동</span>
                    <span className="reportChip">{turn.engine}</span>
                  </div>
                  <h3>{turn.activityTitle}</h3>
                  <ul className="reportDetailList">
                    <li>
                      <strong>교사 행동</strong>
                      <span>{turn.teacherAction}</span>
                    </li>
                    <li>
                      <strong>AI 행동</strong>
                      <span>{turn.aiAction}</span>
                    </li>
                    <li>
                      <strong>예상 학생 반응</strong>
                      <span>{turn.expectedStudentResponse}</span>
                    </li>
                    <li>
                      <strong>관찰 메모</strong>
                      <span>{turn.observerNote}</span>
                    </li>
                    <li>
                      <strong>놓치기 쉬운 지점</strong>
                      <span>{turn.missedOpportunities.length ? turn.missedOpportunities.join(" / ") : "없음"}</span>
                    </li>
                    <li>
                      <strong>연결된 질문·행동</strong>
                      <span>{findCardTitles(turn.linkedCardIds, report.design.customCards).join(" / ") || "없음"}</span>
                    </li>
                    <li>
                      <strong>설계된 교사 질문·행동</strong>
                      <span>{cards.teacher.join(" / ") || "없음"}</span>
                    </li>
                    <li>
                      <strong>설계된 AI 질문·행동</strong>
                      <span>{cards.ai.join(" / ") || "없음"}</span>
                    </li>
                    <li>
                      <strong>활동별 위험 신호</strong>
                      <span>{(turn.activityRiskSignals ?? []).join(" / ") || "없음"}</span>
                    </li>
                  </ul>
                  <div className="reportGrid reportGridTwo reportScenarioDetailGrid">
                    <div className="reportMiniBlock">
                      <strong>학생 페르소나 반응</strong>
                      <ul>
                        {(turn.studentPersonaResponses ?? []).map((item) => (
                          <li key={`${turn.id}-${item.personaId}`}>
                            {item.personaName}: {item.response}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>학생 산출물 예시</strong>
                      <ul>
                        {(turn.sampleArtifacts ?? []).map((artifact) => (
                          <li key={artifact.id}>
                            {artifact.title}: {artifact.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>교사 개입 추천</strong>
                      <ul>
                        {(turn.teacherInterventions ?? []).map((item) => (
                          <li key={item.id}>
                            {item.title}: {item.move}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>질문·행동과 결과 연결</strong>
                      <ul>
                        {(turn.cardOutcomeLinks ?? []).map((item) => (
                          <li key={`${turn.id}-${item.cardId}`}>
                            {item.cardTitle}: {item.resultingChange}
                          </li>
                        ))}
                      </ul>
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

        <section className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <p className="sectionTag">Risk Observer</p>
              <h2>활동별 위험 관찰</h2>
            </div>
          </div>
          {report.risks.length ? (
            <div className="reportStack">
              {report.risks.map((risk) => (
                <article key={risk.id} className={`reportCard reportRiskCard reportRiskCard-${risk.severity}`}>
                  <div className="reportEpisodeHead">
                    <span className="reportChip">{riskLabels[risk.riskType]}</span>
                    <span className="reportChip">{risk.severity}</span>
                  </div>
                  <p>{risk.rationale}</p>
                  <div className="reportGrid reportGridTwo reportScenarioDetailGrid">
                    <div className="reportMiniBlock">
                      <strong>활동/초점</strong>
                      <p>{`${risk.activityTitle || "공통 위험"} · ${risk.focusArea}`}</p>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>학생 영향</strong>
                      <p>{risk.studentImpact}</p>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>관찰 신호</strong>
                      <p>{(risk.watchSignals ?? []).join(" / ") || "없음"}</p>
                    </div>
                    <div className="reportMiniBlock">
                      <strong>권장 개입</strong>
                      <p>{risk.recommendedIntervention}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="emptyPanelText">주요 위험이 없습니다.</p>
          )}
        </section>

        <section className="reportSection" data-report-section>
          <div className="panelHeader">
            <div>
              <p className="sectionTag">Reflection Journal</p>
              <h2>성찰 일지</h2>
            </div>
          </div>
          <div className="reportStack">
            {report.questions.length ? (
              report.questions.map((question) => (
                <article key={question.id} className="reportCard">
                  <h3>{question.prompt}</h3>
                  <p className="panelHint">{question.rationale}</p>
                  <div className="reportAnswerBlock">{report.answers[question.id] || "작성되지 않음"}</div>
                </article>
              ))
            ) : (
              <article className="reportCard">
                <p>생성된 성찰 질문이 없습니다.</p>
              </article>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
