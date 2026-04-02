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
  const personaMap = new Map((report.scenario?.studentPersonas ?? []).map((persona) => [persona.id, persona]));

  const activityRows = report.design.activities
    .map(
      (activity) => `
        <tr>
          <td>${escapeHtml(activity.functionLabel || `활동 ${activity.order}`)}</td>
          <td>${escapeHtml(activity.subjectLabel || report.design.meta.subject || "-")}</td>
          <td>${escapeHtml(activity.learningActivity || activity.title || "-")}</td>
          <td>${escapeHtml(activity.assessmentMethod || "-")}</td>
          <td>${renderChips(activity.humanCardIds.map(cardTitle))}</td>
          <td>${renderChips(activity.aiCardIds.map(cardTitle))}</td>
        </tr>
      `,
    )
    .join("");

  const analysisSection = report.analysis
    ? `
      <section class="report-section">
        <h2>설계 분석</h2>
        <article class="report-block"><p>${escapeHtml(report.analysis.summary)}</p></article>
        <div class="report-card-grid report-card-grid-3">
          <article class="report-block"><h3>강점</h3><ul>${renderList(report.analysis.strengths)}</ul></article>
          <article class="report-block"><h3>보완점</h3><ul>${renderList(report.analysis.gaps)}</ul></article>
          <article class="report-block"><h3>권장 수정</h3><ul>${renderList(report.analysis.recommendations)}</ul></article>
        </div>
      </section>
    `
    : "";

  const scenarioSection = report.scenario
    ? `
      <section class="report-section">
        <h2>모의수업 시나리오</h2>
        <div class="report-card-grid report-card-grid-3">
          <article class="report-card"><span>시나리오 제목</span><strong>${escapeHtml(report.scenario.title)}</strong></article>
          <article class="report-card"><span>학습 흐름</span><strong>${escapeHtml(report.scenario.learningArc)}</strong></article>
          <article class="report-card"><span>엔진</span><strong>${escapeHtml(report.scenario.engine)}</strong></article>
        </div>
        <article class="report-block">
          <h3>배경</h3>
          <p>${escapeHtml(report.scenario.setting)}</p>
          <h3>관찰 포인트</h3>
          <p>${escapeHtml(report.scenario.facilitatorBrief)}</p>
        </article>
        <div class="report-card-grid report-card-grid-2 report-persona-grid">
          ${report.scenario.studentPersonas
            .map(
              (persona) => `
                <article class="report-block">
                  <div class="report-block-head"><span>${escapeHtml(persona.name)}</span><strong>${escapeHtml(persona.label)}</strong></div>
                  <p>${escapeHtml(persona.profile)}</p>
                  <ul class="report-detail-list">
                    <li><strong>강점</strong><span>${escapeHtml(persona.strength)}</span></li>
                    <li><strong>관찰 포인트</strong><span>${escapeHtml(persona.watchPoint)}</span></li>
                    <li><strong>AI 경향</strong><span>${escapeHtml(persona.aiTendency)}</span></li>
                    <li><strong>지원 필요</strong><span>${escapeHtml(persona.supportNeed)}</span></li>
                  </ul>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="report-stack">
          ${report.scenario.episodes
            .map(
              (episode, index) => `
                <article class="report-block">
                  <div class="report-block-head">
                    <span>Episode ${index + 1}</span>
                    <strong>${escapeHtml(episode.lens)}</strong>
                  </div>
                  <h3>${escapeHtml(episode.title)}</h3>
                  <p>${escapeHtml(episode.narrative)}</p>
                  <div class="report-bullet-grid report-bullet-grid-3 report-contrast-grid">
                    <li class="report-contrast-card report-contrast-card-positive"><strong>잘되고 있는 모습</strong><span>${escapeHtml(episode.successScene || "설계를 따라갈 때 드러나는 긍정 장면이 제시됩니다.")}</span></li>
                    <li class="report-contrast-card report-contrast-card-neutral"><strong>보통의 실제 모습</strong><span>${escapeHtml(episode.ordinaryScene || "실제 교실에서 흔히 나타나는 평균적 장면이 제시됩니다.")}</span></li>
                    <li class="report-contrast-card report-contrast-card-negative"><strong>잘 안되는 모습</strong><span>${escapeHtml(episode.challengeScene || "같은 설계 안에서도 흔들릴 수 있는 장면이 제시됩니다.")}</span></li>
                  </div>
                  <ul class="report-bullet-grid">
                    <li><strong>Human agency</strong><span>${escapeHtml(episode.humanAgencyFocus)}</span></li>
                    <li><strong>AI agency</strong><span>${escapeHtml(episode.aiAgencyFocus)}</span></li>
                    <li><strong>학생 학습 신호</strong><span>${escapeHtml(episode.studentLearningSignal)}</span></li>
                    <li><strong>잠재 긴장</strong><span>${escapeHtml(episode.possibleTension)}</span></li>
                  </ul>
                  <div class="report-card-grid report-card-grid-2">
                    <article class="report-card"><h3>주요 학생 페르소나</h3>${renderChips((episode.featuredPersonaIds ?? []).map((personaId) => {
                      const persona = personaMap.get(personaId);
                      return persona ? `${persona.name} · ${persona.label}` : personaId;
                    }))}</article>
                    <article class="report-card"><h3>학생 산출물 예시</h3>${renderMiniList((episode.sampleArtifacts ?? []).map((artifact) => `${artifact.title}: ${artifact.content}`))}</article>
                    <article class="report-card"><h3>교사 개입 추천</h3>${renderMiniList((episode.teacherInterventions ?? []).map((item) => `${item.title}: ${item.move}`))}</article>
                    <article class="report-card"><h3>질문·행동과 결과 연결</h3>${renderMiniList((episode.cardOutcomeLinks ?? []).map((item) => `${item.cardTitle}: ${item.resultingChange}`))}</article>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `
    : "";

  const turnsSection = report.turns.length
    ? `
      <section class="report-section">
        <h2>모의수업 실행 결과</h2>
        <div class="report-stack">
          ${report.turns
            .map(
              (turn) => `
                <article class="report-block">
                  <div class="report-block-head">
                    <span>${turn.turnIndex}차 활동</span>
                    <strong>${escapeHtml(turn.engine)}</strong>
                  </div>
                  <h3>${escapeHtml(turn.activityTitle)}</h3>
                  <ul class="report-detail-list">
                    <li><strong>교사 행동</strong><span>${escapeHtml(turn.teacherAction)}</span></li>
                    <li><strong>AI 행동</strong><span>${escapeHtml(turn.aiAction)}</span></li>
                    <li><strong>예상 학생 반응</strong><span>${escapeHtml(turn.expectedStudentResponse)}</span></li>
                    <li><strong>관찰 메모</strong><span>${escapeHtml(turn.observerNote)}</span></li>
                    <li><strong>놓칠 수 있는 지점</strong><span>${escapeHtml(turn.missedOpportunities.join(" / ") || "없음")}</span></li>
                    <li><strong>연결된 질문·행동</strong><span>${escapeHtml(turn.linkedCardIds.map(cardTitle).join(" / ") || "없음")}</span></li>
                    <li><strong>활동별 위험 신호</strong><span>${escapeHtml((turn.activityRiskSignals ?? []).join(" / ") || "없음")}</span></li>
                  </ul>
                  <div class="report-card-grid report-card-grid-2">
                    <article class="report-card"><h3>학생 페르소나 반응</h3>${renderMiniList((turn.studentPersonaResponses ?? []).map((item) => `${item.personaName}: ${item.response}`))}</article>
                    <article class="report-card"><h3>학생 산출물 예시</h3>${renderMiniList((turn.sampleArtifacts ?? []).map((artifact) => `${artifact.title}: ${artifact.content}`))}</article>
                    <article class="report-card"><h3>교사 개입 추천</h3>${renderMiniList((turn.teacherInterventions ?? []).map((item) => `${item.title}: ${item.move}`))}</article>
                    <article class="report-card"><h3>질문·행동과 결과 연결</h3>${renderMiniList((turn.cardOutcomeLinks ?? []).map((item) => `${item.cardTitle}: ${item.resultingChange}`))}</article>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `
    : "";

  const risksSection = `
    <section class="report-section">
      <h2>위험 관찰 결과</h2>
      ${report.risks.length
        ? `<div class="report-stack">${report.risks
            .map(
              (risk) => `
                <article class="report-block">
                  <div class="report-block-head">
                    <span>${escapeHtml(riskLabels[risk.riskType])}</span>
                    <strong>${escapeHtml(risk.severity)}</strong>
                  </div>
                  <p>${escapeHtml(risk.rationale)}</p>
                  <div class="report-card-grid report-card-grid-2">
                    <article class="report-card"><h3>활동/초점</h3><p>${escapeHtml(`${risk.activityTitle || "공통 위험"} · ${risk.focusArea}`)}</p></article>
                    <article class="report-card"><h3>학생 영향</h3><p>${escapeHtml(risk.studentImpact)}</p></article>
                    <article class="report-card"><h3>관찰 신호</h3><p>${escapeHtml((risk.watchSignals ?? []).join(" / ") || "없음")}</p></article>
                    <article class="report-card"><h3>권장 개입</h3><p>${escapeHtml(risk.recommendedIntervention)}</p></article>
                  </div>
                </article>
              `,
            )
            .join("")}</div>`
        : '<article class="report-block"><p>주요 위험이 없습니다.</p></article>'}
    </section>
  `;

  const reflectionSection = `
    <section class="report-section">
      <h2>성찰 일지</h2>
      <div class="report-stack">
        ${report.questions
          .map(
            (question) => `
              <article class="report-block">
                <h3>${escapeHtml(question.prompt)}</h3>
                <p class="report-note">${escapeHtml(question.rationale)}</p>
                <div class="report-answer">${escapeHtml(report.answers[question.id] || "응답 없음")}</div>
              </article>
            `,
          )
          .join("")}

        <article class="report-block">
          <h3>다음 수정 체크리스트</h3>
          <ul>${renderList(report.nextRevisionNotes)}</ul>
        </article>
      </div>
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
        color-scheme: light;
        --bg: #f3f7ff;
        --surface: #ffffff;
        --surface-soft: #f8fbff;
        --line: #dbe7ff;
        --ink: #172554;
        --muted: #5b6b82;
        --accent: #2563eb;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
      }
      .report-page {
        width: min(1160px, calc(100% - 40px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }
      .report-hero,
      .report-section,
      .report-block,
      .report-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 22px;
      }
      .report-hero,
      .report-section {
        padding: 24px;
        margin-bottom: 18px;
      }
      .report-hero h1,
      .report-section h2,
      .report-block h3,
      .report-card h3 {
        margin: 0;
        letter-spacing: -0.03em;
      }
      .report-hero p,
      .report-block p,
      .report-card p,
      .report-detail-list span,
      .report-bullet-grid span,
      .report-note {
        color: var(--muted);
        line-height: 1.7;
      }
      .report-eyebrow {
        margin: 0 0 10px;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .report-meta,
      .report-card-grid {
        display: grid;
        gap: 12px;
      }
      .report-meta {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-top: 18px;
      }
      .report-card-grid-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .report-card-grid-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .report-card,
      .report-block {
        padding: 18px;
      }
      .report-card span,
      .report-block-head span {
        display: block;
        margin-bottom: 8px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .report-card strong,
      .report-block-head strong {
        font-size: 1rem;
      }
      .report-stack { display: grid; gap: 14px; }
      .report-block-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .report-bullet-grid,
      .report-detail-list {
        display: grid;
        gap: 10px;
        list-style: none;
        padding: 0;
        margin: 14px 0 0;
      }
      .report-bullet-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .report-bullet-grid-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .report-bullet-grid li,
      .report-detail-list li {
        display: grid;
        gap: 6px;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--surface-soft);
      }
      .report-contrast-grid {
        margin-top: 14px;
      }
      .report-contrast-card-positive {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
      }
      .report-contrast-card-neutral {
        background: #f8fafc;
        border: 1px solid #dbeafe;
      }
      .report-contrast-card-negative {
        background: #fff7ed;
        border: 1px solid #fed7aa;
      }
      .report-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
      }
      .report-table th,
      .report-table td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
        text-align: left;
      }
      .report-table th {
        background: #eff6ff;
        font-size: 0.84rem;
      }
      .report-chip {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #eff6ff;
        color: var(--accent);
        font-size: 0.82rem;
        font-weight: 700;
      }
      .report-chip-muted {
        background: #f4f4f5;
        color: #71717a;
      }
      .report-answer {
        padding: 14px 16px;
        border-radius: 16px;
        background: #f8fbff;
        border: 1px solid var(--line);
        white-space: pre-wrap;
        line-height: 1.7;
      }
      @media (max-width: 860px) {
        .report-page { width: min(100% - 20px, 1160px); }
        .report-meta,
        .report-card-grid-2,
        .report-card-grid-3,
        .report-bullet-grid,
        .report-bullet-grid-3 { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: white; }
        .report-page { width: 100%; margin: 0; padding: 0; }
        .report-hero,
        .report-section,
        .report-block,
        .report-card { box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <main class="report-page">
      <section class="report-hero">
        <p class="report-eyebrow">Teacher Agent Report</p>
        <h1>${escapeHtml(report.reportTitle)}</h1>
        <p>생성 시각: ${escapeHtml(generatedAt)}</p>
        <div class="report-meta">
          <article class="report-card"><span>주제</span><strong>${escapeHtml(report.design.meta.topic || "미입력")}</strong></article>
          <article class="report-card"><span>교과</span><strong>${escapeHtml(report.design.meta.subject || "미입력")}</strong></article>
          <article class="report-card"><span>대상</span><strong>${escapeHtml(report.design.meta.target || "미입력")}</strong></article>
          <article class="report-card"><span>활동 수</span><strong>${report.design.activities.length}개</strong></article>
        </div>
      </section>
      <section class="report-section">
        <h2>수업 설계 내용</h2>
        <div class="report-card-grid report-card-grid-2">
          <article class="report-block"><h3>학습 목표</h3><ul>${renderList(report.design.learningGoals)}</ul></article>
          <article class="report-block"><h3>설계 메타</h3><ul>${renderList([
            `버전: ${report.design.version}`,
            `생성: ${new Date(report.design.createdAt).toLocaleString("ko-KR")}`,
            `수정: ${new Date(report.design.updatedAt).toLocaleString("ko-KR")}`,
          ])}</ul></article>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th>기능</th>
              <th>교과</th>
              <th>학습활동</th>
              <th>평가 방법</th>
              <th>교사 질문·행동</th>
              <th>AI 질문·행동</th>
            </tr>
          </thead>
          <tbody>${activityRows}</tbody>
        </table>
      </section>
      ${analysisSection}
      ${scenarioSection}
      ${turnsSection}
      ${risksSection}
      ${reflectionSection}
    </main>
  </body>
</html>`;
}

