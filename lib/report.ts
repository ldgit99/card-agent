import { orchestrationCards } from "@/data/cards";
import { riskLabels } from "@/lib/constants";
import type { LessonDesign } from "@/types/lesson";
import type { SimulationReportSnapshot } from "@/types/report";
import type { StoredSimulationState } from "@/types/workspace";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cardTitle(cardId: string) {
  return orchestrationCards.find((card) => card.id === cardId)?.title ?? cardId;
}

function renderList(items: string[]) {
  if (!items.length) {
    return "<li>없음</li>";
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderChips(items: string[]) {
  if (!items.length) {
    return '<span class="report-chip report-chip-muted">없음</span>';
  }

  return items.map((item) => `<span class="report-chip">${escapeHtml(item)}</span>`).join("");
}

function renderMiniList(items: string[]) {
  return items.length ? `<ul>${renderList(items)}</ul>` : "<p>없음</p>";
}

export function buildSimulationReportSnapshot(input: {
  design: LessonDesign;
  analysis: SimulationReportSnapshot["analysis"];
  scenario: SimulationReportSnapshot["scenario"];
  turns: SimulationReportSnapshot["turns"];
  risks: SimulationReportSnapshot["risks"];
  questions: SimulationReportSnapshot["questions"];
  answers: SimulationReportSnapshot["answers"];
  summary: string;
  nextRevisionNotes: string[];
}) {
  return {
    generatedAt: new Date().toISOString(),
    reportTitle: `${input.design.meta.topic || "수업 설계"} 리포트`,
    design: input.design,
    analysis: input.analysis,
    scenario: input.scenario,
    turns: input.turns,
    risks: input.risks,
    questions: input.questions,
    answers: input.answers,
    summary: input.summary,
    nextRevisionNotes: input.nextRevisionNotes,
  } satisfies SimulationReportSnapshot;
}

export function buildFallbackReportSnapshot(input: {
  design: LessonDesign;
  simulation: StoredSimulationState;
}) {
  const answers = Object.fromEntries(
    (input.simulation.journal?.answers ?? []).map((answer) => [answer.questionId, answer.answer]),
  );

  return buildSimulationReportSnapshot({
    design: input.design,
    analysis: input.simulation.analysis,
    scenario: input.simulation.scenario,
    turns: input.simulation.turns,
    risks: input.simulation.risks,
    questions: input.simulation.questions,
    answers,
    summary: input.simulation.journal?.summary ?? "",
    nextRevisionNotes: input.simulation.journal?.nextRevisionNotes ?? [],
  });
}

export function buildReportHtmlDocument(report: SimulationReportSnapshot) {
  const generatedAt = new Date(report.generatedAt).toLocaleString("ko-KR");

  const activityCardMap = new Map(
    report.design.activities.map((activity) => [
      activity.id,
      {
        teacher: activity.humanCardIds.map(cardTitle),
        ai: activity.aiCardIds.map(cardTitle),
      },
    ]),
  );

  // ① 수업 설계 내용
  const activityRows = report.design.activities
    .map((activity) => {
      const cards = activityCardMap.get(activity.id) ?? { teacher: [], ai: [] };
      return `
        <tr>
          <td>${escapeHtml(activity.functionLabel || `활동 ${activity.order}`)}</td>
          <td>${escapeHtml(activity.subjectLabel || report.design.meta.subject || "-")}</td>
          <td>${escapeHtml(activity.learningActivity || activity.title || "-")}</td>
          <td>${renderChips(activity.tools)}</td>
          <td>${escapeHtml(activity.assessmentMethod || "-")}</td>
          <td>${renderChips(cards.teacher)}</td>
          <td>${renderChips(cards.ai)}</td>
        </tr>
      `;
    })
    .join("");

  const designSection = `
    <section class="rs">
      <h2><span class="rs-circle">①</span>수업 설계 내용</h2>
      <div class="rs-grid2" style="margin-top:14px">
        <article class="rs-card">
          <h3>학습 목표</h3>
          <ul>${renderList(report.design.learningGoals)}</ul>
        </article>
        <article class="rs-card">
          <h3>수업 정보</h3>
          <ul class="rs-info-list">
            <li><span class="rs-info-label">교과</span>${escapeHtml(report.design.meta.subject || "-")}</li>
            <li><span class="rs-info-label">대상</span>${escapeHtml(report.design.meta.target || "-")}</li>
          </ul>
        </article>
      </div>
      <div style="overflow-x:auto;margin-top:14px">
        <table class="rs-table">
          <thead>
            <tr>
              <th>기능</th><th>교과</th><th>학습활동</th><th>AI도구</th>
              <th>평가 방법</th><th>교사 질문·행동</th><th>AI 질문·행동</th>
            </tr>
          </thead>
          <tbody>${activityRows}</tbody>
        </table>
      </div>
    </section>
  `;

  // ② 활동별 수업 장면
  const turnsSection = report.turns.length
    ? `
      <section class="rs">
        <h2><span class="rs-circle">②</span>활동별 수업 장면</h2>
        <div class="rs-stack">
          ${report.turns.map((turn) => {
            const cards = activityCardMap.get(turn.activityId) ?? { teacher: [], ai: [] };
            const topSignal = (turn.activityRiskSignals ?? [])[0];
            return `
              <article class="rs-scene">
                <div class="rs-scene-head">
                  <span class="rs-index-chip">활동 ${turn.turnIndex}</span>
                  <strong>${escapeHtml(turn.activityTitle)}</strong>
                </div>
                <div class="rs-scene-body">
                  <div class="rs-scene-col">
                    <p class="rs-block-label">교사 · AI 역할 분담</p>
                    <div class="rs-role-row">
                      <span class="rs-role-badge rs-role-teacher">교사</span>
                      <p>${escapeHtml(turn.teacherAction)}</p>
                    </div>
                    <div class="rs-role-row">
                      <span class="rs-role-badge rs-role-ai">AI</span>
                      <p>${escapeHtml(turn.aiAction)}</p>
                    </div>
                    <div style="margin-top:10px">${renderChips([...cards.teacher, ...cards.ai])}</div>
                  </div>
                  <div class="rs-scene-col">
                    <p class="rs-block-label">핵심 관찰 포인트</p>
                    <p>${escapeHtml(turn.observerNote)}</p>
                    ${topSignal ? `<div class="rs-signal">⚠ ${escapeHtml(topSignal)}</div>` : ""}
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `
    : "";

  // ③ 위험 신호
  const severities: Array<{ key: "high" | "medium" | "low"; label: string }> = [
    { key: "high", label: "HIGH" },
    { key: "medium", label: "MEDIUM" },
    { key: "low", label: "LOW" },
  ];
  const riskGroups = severities
    .map(({ key, label }) => {
      const items = report.risks.filter((r) => r.severity === key);
      if (!items.length) return "";
      return `
        <div class="rs-risk-group rs-risk-${key}">
          <p class="rs-risk-label rs-risk-label-${key}">${label}</p>
          ${items.map((risk) => `
            <div class="rs-risk-row">
              <strong>${escapeHtml(riskLabels[risk.riskType])}</strong>
              <p>→ ${escapeHtml(risk.recommendedIntervention)}</p>
            </div>
          `).join("")}
        </div>
      `;
    })
    .join("");

  const risksSection = `
    <section class="rs">
      <h2><span class="rs-circle">③</span>위험 신호</h2>
      <div class="rs-stack" style="margin-top:14px">
        ${riskGroups || "<p>주요 위험이 없습니다.</p>"}
      </div>
    </section>
  `;

  // ④ 교사 성찰
  const answeredQuestions = report.questions
    .filter((q) => report.answers[q.id])
    .map((q) => `
      <div class="rs-qa">
        <p class="rs-q">${escapeHtml(q.prompt)}</p>
        <div class="rs-answer">${escapeHtml(report.answers[q.id])}</div>
      </div>
    `)
    .join("");

  const revisionNotes = (report.nextRevisionNotes ?? []).length
    ? `<div class="rs-card" style="margin-top:14px">
        <p class="rs-block-label">다음 수업에서 바꿀 것</p>
        <ul>${renderList(report.nextRevisionNotes ?? [])}</ul>
       </div>`
    : "";

  const reflectionSection = `
    <section class="rs">
      <h2><span class="rs-circle">④</span>교사 성찰</h2>
      ${report.summary ? `<div class="rs-card" style="margin-top:14px"><p class="rs-block-label">수업 총평</p><p>${escapeHtml(report.summary)}</p></div>` : ""}
      <div class="rs-stack" style="margin-top:14px">
        ${answeredQuestions || "<p>작성된 성찰 답변이 없습니다.</p>"}
      </div>
      ${revisionNotes}
    </section>
  `;

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.reportTitle)}</title>
    <style>
      :root {
        --ink: #18181b; --muted: #71717b; --accent: #155dfc; --accent-soft: rgba(21,93,252,0.08);
        --teacher: #1447e6; --ai: #00a3a3;
        --risk-high: #e40014; --risk-medium: #f99c00; --risk-low: #155dfc;
        --line: #e4e4e7; --surface: #ffffff; --bg: #f7f9fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        font-size: 15px; line-height: 1.6; color: var(--ink);
        background: linear-gradient(180deg, #f7f9fc 0%, #eef4ff 100%);
      }
      .report-page {
        width: min(1160px, calc(100% - 40px));
        margin: 0 auto; padding: 32px 0 48px;
        display: grid; gap: 16px;
      }
      .report-hero {
        background: var(--surface); border: 1px solid var(--line);
        border-radius: 24px; padding: 22px 28px;
        box-shadow: 0 1px 3px rgba(60,64,67,.1), 0 4px 12px rgba(60,64,67,.07);
      }
      .report-hero h1 { margin: 8px 0 4px; font-size: 1.5rem; letter-spacing: -0.03em; }
      .report-hero p { margin: 0; color: var(--muted); font-size: 0.9rem; }
      .rs {
        background: var(--surface); border: 1px solid var(--line);
        border-radius: 24px; padding: 22px;
        box-shadow: 0 1px 3px rgba(60,64,67,.1), 0 4px 12px rgba(60,64,67,.07);
      }
      .rs h2 { margin: 0 0 0; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
      .rs-circle {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; border-radius: 50%;
        background: var(--accent); color: #fff;
        font-size: 0.82rem; font-weight: 800; flex-shrink: 0;
      }
      .rs-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .rs-card {
        border: 1px solid var(--line); border-radius: 16px;
        padding: 16px; background: var(--surface);
      }
      .rs-card h3 { margin: 0 0 10px; font-size: 0.95rem; font-weight: 700; }
      .rs-card ul { margin: 0; padding-left: 18px; }
      .rs-card li { line-height: 1.6; font-size: 0.9rem; }
      .rs-info-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
      .rs-info-list li { display: flex; align-items: center; gap: 10px; font-size: 0.92rem; }
      .rs-info-label { font-weight: 700; color: var(--muted); font-size: 0.82rem; min-width: 32px; }
      .rs-block-label {
        margin: 0 0 8px; font-size: 0.76rem; font-weight: 800;
        letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent);
      }
      .rs-table { width: 100%; border-collapse: collapse; min-width: 720px; }
      .rs-table th, .rs-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); vertical-align: top; text-align: left; font-size: 0.88rem; }
      .rs-table th:last-child, .rs-table td:last-child { border-right: none; }
      .rs-table th { background: rgba(223,235,255,.72); color: var(--accent); font-weight: 800; text-align: center; }
      .report-chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: #eff6ff; color: var(--accent); font-size: 0.8rem; font-weight: 700; margin: 2px; }
      .report-chip-muted { background: #f4f4f5; color: #71717a; }
      .rs-stack { display: grid; gap: 12px; }
      .rs-scene { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
      .rs-scene-head { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid var(--line); }
      .rs-scene-head strong { font-size: 0.95rem; }
      .rs-index-chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.76rem; font-weight: 800; white-space: nowrap; }
      .rs-scene-body { display: grid; grid-template-columns: 1.2fr 1fr; }
      .rs-scene-col { padding: 14px 16px; }
      .rs-scene-col:first-child { border-right: 1px solid var(--line); }
      .rs-role-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
      .rs-role-row p { margin: 0; font-size: 0.88rem; line-height: 1.55; }
      .rs-role-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
      .rs-role-teacher { background: rgba(20,71,230,.08); color: var(--teacher); }
      .rs-role-ai { background: rgba(0,163,163,.1); color: var(--ai); }
      .rs-signal { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 12px; border-radius: 999px; background: rgba(249,156,0,.1); border: 1px solid rgba(249,156,0,.24); font-size: 0.82rem; font-weight: 700; color: #b45309; }
      .rs-risk-group { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
      .rs-risk-high { border-left: 4px solid var(--risk-high); }
      .rs-risk-medium { border-left: 4px solid var(--risk-medium); }
      .rs-risk-low { border-left: 4px solid var(--risk-low); }
      .rs-risk-label { margin: 0; padding: 7px 14px; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
      .rs-risk-label-high { background: rgba(254,242,242,.9); color: var(--risk-high); }
      .rs-risk-label-medium { background: rgba(255,251,235,.9); color: #b45309; }
      .rs-risk-label-low { background: rgba(239,246,255,.9); color: var(--risk-low); }
      .rs-risk-row { display: grid; gap: 3px; padding: 10px 14px; border-top: 1px solid var(--line); background: #fff; }
      .rs-risk-row strong { font-size: 0.88rem; }
      .rs-risk-row p { margin: 0; font-size: 0.88rem; color: var(--muted); line-height: 1.55; }
      .rs-qa { display: grid; gap: 8px; }
      .rs-q { margin: 0; font-size: 0.9rem; font-weight: 700; line-height: 1.5; }
      .rs-answer { padding: 12px 14px; border-radius: 12px; background: #f8fbff; border: 1px solid rgba(219,234,254,.88); font-size: 0.9rem; line-height: 1.7; white-space: pre-wrap; color: var(--muted); }
      @media (max-width: 760px) {
        .rs-grid2, .rs-scene-body { grid-template-columns: 1fr; }
        .rs-scene-col:first-child { border-right: none; border-bottom: 1px solid var(--line); }
      }
      @media print {
        @page { size: A4 portrait; margin: 18mm 15mm; }
        body { background: #fff; }
        .report-page { width: 100%; margin: 0; padding: 0; }
        .rs { box-shadow: none; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="report-page">
      <section class="report-hero">
        <p style="margin:0;font-size:0.76rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)">Teacher Agent Report</p>
        <h1>${escapeHtml(report.reportTitle)}</h1>
        <p>생성 시각: ${escapeHtml(generatedAt)}</p>
      </section>
      ${designSection}
      ${turnsSection}
      ${risksSection}
      ${reflectionSection}
    </main>
  </body>
</html>`;
}


