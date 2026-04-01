"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { orchestrationCards } from "@/data/cards";
import { riskLabels } from "@/lib/constants";
import { buildFallbackReportSnapshot, buildReportHtmlDocument } from "@/lib/report";
import { loadStoredDesign, loadStoredReport, loadStoredSimulation } from "@/lib/storage";
import type { SimulationReportSnapshot } from "@/types/report";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}

function findCardTitles(ids: string[]) {
  return ids.map((id) => orchestrationCards.find((card) => card.id === id)?.title ?? id);
}

function downloadHtml(report: SimulationReportSnapshot) {
  const html = buildReportHtmlDocument(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.design.meta.topic || "lesson-report"}-report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportViewer() {
  const [report, setReport] = useState<SimulationReportSnapshot | null>(null);

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
          teacher: findCardTitles(activity.humanCardIds),
          ai: findCardTitles(activity.aiCardIds),
        },
      ]),
    );
  }, [report]);

  const personaById = useMemo(() => {
    if (!report?.scenario) {
      return new Map<string, { name: string; label: string }>();
    }

    return new Map(report.scenario.studentPersonas.map((persona) => [persona.id, { name: persona.name, label: persona.label }]));
  }, [report]);

  if (!report) {
    return (
      <main className="appShell">
        <section className="panel reportEmptyState">
          <p className="sectionTag">Report</p>
          <h1>저장된 리포트가 없습니다.</h1>
          <p className="emptyPanelText">먼저 모의수업 실행 화면에서 `리포트 저장하기`를 눌러 주세요.</p>
          <div className="heroActions">
            <Link href="/simulation" className="primaryButton">시뮬레이션으로 이동</Link>
            <Link href="/" className="ghostButton">1페이지로 이동</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="reportShell">
      <section className="reportToolbar printHidden">
        <div>
          <p className="sectionTag">Report Workspace</p>
          <h1>{report.reportTitle}</h1>
          <p className="panelHint">브라우저에서 바로 보고, `PDF로 저장`으로 인쇄 저장할 수 있습니다.</p>
        </div>
        <div className="heroActions reportToolbarActions">
          <button type="button" className="primaryButton" onClick={() => window.print()}>PDF로 저장</button>
          <button type="button" className="secondaryButton" onClick={() => downloadHtml(report)}>HTML 다운로드</button>
          <Link href="/simulation" className="ghostButton">시뮬레이션으로 돌아가기</Link>
        </div>
      </section>

      <section className="reportSection reportHeroSection">
        <p className="sectionTag">Teacher Agent Report</p>
        <h2>{report.reportTitle}</h2>
        <p className="panelHint">생성 시각: {formatDateTime(report.generatedAt)}</p>
        <div className="reportMetaGrid">
          <article className="reportMetricCard"><span>주제</span><strong>{report.design.meta.topic || "미입력"}</strong></article>
          <article className="reportMetricCard"><span>교과</span><strong>{report.design.meta.subject || "미입력"}</strong></article>
          <article className="reportMetricCard"><span>대상</span><strong>{report.design.meta.target || "미입력"}</strong></article>
          <article className="reportMetricCard"><span>활동 수</span><strong>{report.design.activities.length}개</strong></article>
        </div>
      </section>

      <section className="reportSection">
        <div className="panelHeader"><div><p className="sectionTag">Lesson Design</p><h2>수업 설계 내용</h2></div></div>
        <div className="reportGrid reportGridThree">
          <article className="reportCard"><h3>성취기준</h3><ul>{report.design.achievementStandards.length ? report.design.achievementStandards.map((item) => <li key={item}>{item}</li>) : <li>없음</li>}</ul></article>
          <article className="reportCard"><h3>학습 목표</h3><ul>{report.design.learningGoals.length ? report.design.learningGoals.map((item) => <li key={item}>{item}</li>) : <li>없음</li>}</ul></article>
          <article className="reportCard"><h3>설계 정보</h3><ul><li>버전 {report.design.version}</li><li>생성 {formatDateTime(report.design.createdAt)}</li><li>수정 {formatDateTime(report.design.updatedAt)}</li></ul></article>
        </div>
        <div className="reportTableWrap">
          <table className="lessonTable reportTable">
            <thead>
              <tr>
                <th>기능</th>
                <th>교과</th>
                <th>학습활동</th>
                <th>평가 방법</th>
                <th>교사 카드</th>
                <th>AI 카드</th>
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
                    <td>{activity.assessmentMethod || "-"}</td>
                    <td><div className="reportChipWrap">{cards.teacher.length ? cards.teacher.map((item) => <span key={`${activity.id}-${item}`} className="reportChip">{item}</span>) : <span className="reportChip reportChipMuted">없음</span>}</div></td>
                    <td><div className="reportChipWrap">{cards.ai.length ? cards.ai.map((item) => <span key={`${activity.id}-${item}`} className="reportChip">{item}</span>) : <span className="reportChip reportChipMuted">없음</span>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {report.analysis ? (
        <section className="reportSection">
          <div className="panelHeader"><div><p className="sectionTag">Analysis</p><h2>설계 분석</h2></div><span className="engineBadge">{report.analysis.engine}</span></div>
          <article className="reportCard reportSummaryCard"><p>{report.analysis.summary}</p></article>
          <div className="reportGrid reportGridThree">
            <article className="reportCard"><h3>강점</h3><ul>{report.analysis.strengths.length ? report.analysis.strengths.map((item) => <li key={item}>{item}</li>) : <li>없음</li>}</ul></article>
            <article className="reportCard"><h3>보완점</h3><ul>{report.analysis.gaps.length ? report.analysis.gaps.map((item) => <li key={item}>{item}</li>) : <li>없음</li>}</ul></article>
            <article className="reportCard"><h3>권장 수정</h3><ul>{report.analysis.recommendations.length ? report.analysis.recommendations.map((item) => <li key={item}>{item}</li>) : <li>없음</li>}</ul></article>
          </div>
        </section>
      ) : null}

      {report.scenario ? (
        <section className="reportSection">
          <div className="panelHeader"><div><p className="sectionTag">Scenario</p><h2>모의 수업 시나리오</h2></div><span className="engineBadge">{report.scenario.engine}</span></div>
          <div className="reportGrid reportGridThree">
            <article className="reportCard"><h3>시나리오 제목</h3><p>{report.scenario.title}</p></article>
            <article className="reportCard"><h3>학습 흐름</h3><p>{report.scenario.learningArc}</p></article>
            <article className="reportCard"><h3>관찰 포인트</h3><p>{report.scenario.facilitatorBrief}</p></article>
          </div>
          <article className="reportCard reportSummaryCard"><h3>배경</h3><p>{report.scenario.setting}</p></article>
          <div className="personaGrid reportPersonaGrid">
            {report.scenario.studentPersonas.map((persona) => (
              <article key={persona.id} className="personaCard reportPersonaCard">
                <div className="personaCardHead"><strong>{persona.name}</strong><span>{persona.label}</span></div>
                <p>{persona.profile}</p>
                <ul className="miniBulletList">
                  <li><strong>강점</strong><span>{persona.strength}</span></li>
                  <li><strong>관찰 포인트</strong><span>{persona.watchPoint}</span></li>
                  <li><strong>AI 경향</strong><span>{persona.aiTendency}</span></li>
                  <li><strong>지원 필요</strong><span>{persona.supportNeed}</span></li>
                </ul>
              </article>
            ))}
          </div>
          <div className="reportStack">
            {report.scenario.episodes.map((episode, index) => (
              <article key={episode.id} className="reportCard">
                <div className="reportEpisodeHead"><span className="reportChip">Episode {index + 1}</span><span className="reportChip">{episode.lens}</span></div>
                <h3>{episode.title}</h3>
                <p>{episode.narrative}</p>
                <div className="reportGrid reportGridThree reportContrastGrid">
                  <div className="reportMiniBlock reportContrastCard reportContrastCard-positive"><strong>잘되고 있는 모습</strong><p>{episode.successScene || "설계를 따라갈 때 드러나는 긍정 장면이 제시됩니다."}</p></div>
                  <div className="reportMiniBlock reportContrastCard reportContrastCard-neutral"><strong>보통의 실제 모습</strong><p>{episode.ordinaryScene || "실제 교실에서 흔히 나타나는 평균적 장면이 제시됩니다."}</p></div>
                  <div className="reportMiniBlock reportContrastCard reportContrastCard-negative"><strong>잘 안되는 모습</strong><p>{episode.challengeScene || "같은 설계 안에서도 흔들릴 수 있는 장면이 제시됩니다."}</p></div>
                </div>
                <div className="reportGrid reportGridTwo">
                  <div className="reportMiniBlock"><strong>Human agency</strong><p>{episode.humanAgencyFocus}</p></div>
                  <div className="reportMiniBlock"><strong>AI agency</strong><p>{episode.aiAgencyFocus}</p></div>
                  <div className="reportMiniBlock"><strong>학생 학습 신호</strong><p>{episode.studentLearningSignal}</p></div>
                  <div className="reportMiniBlock"><strong>잠재 긴장</strong><p>{episode.possibleTension}</p></div>
                </div>
                <div className="reportGrid reportGridTwo reportScenarioDetailGrid">
                  <div className="reportMiniBlock"><strong>주요 학생 페르소나</strong><div className="reportChipWrap">{(episode.featuredPersonaIds ?? []).map((personaId) => { const persona = personaById.get(personaId); return <span key={`${episode.id}-${personaId}`} className="reportChip">{persona ? `${persona.name} · ${persona.label}` : personaId}</span>; })}</div></div>
                  <div className="reportMiniBlock"><strong>학생 산출물 예시</strong><ul>{(episode.sampleArtifacts ?? []).map((artifact) => <li key={artifact.id}>{artifact.title}: {artifact.content}</li>)}</ul></div>
                  <div className="reportMiniBlock"><strong>교사 개입 추천</strong><ul>{(episode.teacherInterventions ?? []).map((item) => <li key={item.id}>{item.title}: {item.move}</li>)}</ul></div>
                  <div className="reportMiniBlock"><strong>카드-결과 연결</strong><ul>{(episode.cardOutcomeLinks ?? []).map((item) => <li key={`${episode.id}-${item.cardId}`}>{item.cardTitle}: {item.resultingChange}</li>)}</ul></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="reportSection">
        <div className="panelHeader"><div><p className="sectionTag">Simulation Results</p><h2>모의 수업 실행 결과</h2></div></div>
        {report.turns.length ? (
          <div className="reportStack">
            {report.turns.map((turn) => (
              <article key={turn.id} className="reportCard">
                <div className="reportEpisodeHead"><span className="reportChip">{turn.turnIndex}차 활동</span><span className="reportChip">{turn.engine}</span></div>
                <h3>{turn.activityTitle}</h3>
                <ul className="reportDetailList">
                  <li><strong>교사 행동</strong><span>{turn.teacherAction}</span></li>
                  <li><strong>AI 행동</strong><span>{turn.aiAction}</span></li>
                  <li><strong>예상 학생 반응</strong><span>{turn.expectedStudentResponse}</span></li>
                  <li><strong>관찰 메모</strong><span>{turn.observerNote}</span></li>
                  <li><strong>놓칠 수 있는 지점</strong><span>{turn.missedOpportunities.join(" / ") || "없음"}</span></li>
                  <li><strong>연결 카드</strong><span>{findCardTitles(turn.linkedCardIds).join(" / ") || "없음"}</span></li>
                  <li><strong>활동별 위험 신호</strong><span>{(turn.activityRiskSignals ?? []).join(" / ") || "없음"}</span></li>
                </ul>
                <div className="reportGrid reportGridTwo reportScenarioDetailGrid">
                  <div className="reportMiniBlock"><strong>학생 페르소나 반응</strong><ul>{(turn.studentPersonaResponses ?? []).map((item) => <li key={`${turn.id}-${item.personaId}`}>{item.personaName}: {item.response}</li>)}</ul></div>
                  <div className="reportMiniBlock"><strong>학생 산출물 예시</strong><ul>{(turn.sampleArtifacts ?? []).map((artifact) => <li key={artifact.id}>{artifact.title}: {artifact.content}</li>)}</ul></div>
                  <div className="reportMiniBlock"><strong>교사 개입 추천</strong><ul>{(turn.teacherInterventions ?? []).map((item) => <li key={item.id}>{item.title}: {item.move}</li>)}</ul></div>
                  <div className="reportMiniBlock"><strong>카드-결과 연결</strong><ul>{(turn.cardOutcomeLinks ?? []).map((item) => <li key={`${turn.id}-${item.cardId}`}>{item.cardTitle}: {item.resultingChange}</li>)}</ul></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="emptyPanelText">저장된 실행 로그가 없습니다.</p>
        )}
      </section>

      <section className="reportSection">
        <div className="panelHeader"><div><p className="sectionTag">Risk Observer</p><h2>활동별 위험 관찰</h2></div></div>
        {report.risks.length ? (
          <div className="reportStack">
            {report.risks.map((risk) => (
              <article key={risk.id} className={`reportCard reportRiskCard reportRiskCard-${risk.severity}`}>
                <div className="reportEpisodeHead"><span className="reportChip">{riskLabels[risk.riskType]}</span><span className="reportChip">{risk.severity}</span></div>
                <p>{risk.rationale}</p>
                <div className="reportGrid reportGridTwo reportScenarioDetailGrid">
                  <div className="reportMiniBlock"><strong>활동/초점</strong><p>{`${risk.activityTitle || "공통 위험"} · ${risk.focusArea}`}</p></div>
                  <div className="reportMiniBlock"><strong>학생 영향</strong><p>{risk.studentImpact}</p></div>
                  <div className="reportMiniBlock"><strong>관찰 신호</strong><p>{(risk.watchSignals ?? []).join(" / ") || "없음"}</p></div>
                  <div className="reportMiniBlock"><strong>권장 개입</strong><p>{risk.recommendedIntervention}</p></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="emptyPanelText">주요 위험이 없습니다.</p>
        )}
      </section>

      <section className="reportSection">
        <div className="panelHeader"><div><p className="sectionTag">Reflection Journal</p><h2>성찰 일지</h2></div></div>
        <div className="reportStack">
          {report.questions.length ? report.questions.map((question) => (
            <article key={question.id} className="reportCard">
              <h3>{question.prompt}</h3>
              <p className="panelHint">{question.rationale}</p>
              <div className="reportAnswerBlock">{report.answers[question.id] || "응답 없음"}</div>
            </article>
          )) : <article className="reportCard"><p>생성된 성찰 질문이 없습니다.</p></article>}
          <article className="reportCard"><h3>종합 메모</h3><div className="reportAnswerBlock">{report.summary || "입력 없음"}</div></article>
          <article className="reportCard"><h3>다음 수정 체크리스트</h3><ul>{report.nextRevisionNotes.length ? report.nextRevisionNotes.map((note) => <li key={note}>{note}</li>) : <li>없음</li>}</ul></article>
        </div>
      </section>
    </main>
  );
}
