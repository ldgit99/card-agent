import type { LessonDesign } from "@/types/lesson";
import type {
  SimulationSessionRecord,
  WorkspaceSnapshot,
} from "@/types/workspace";
import { Pool } from "pg";

const schemaStatements = [
  `create table if not exists lesson_designs (
    id text primary key,
    current_version integer not null,
    title text not null,
    topic text not null,
    subject_label text not null,
    target_label text not null,
    payload jsonb not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create table if not exists lesson_design_versions (
    id bigserial primary key,
    lesson_design_id text not null references lesson_designs(id) on delete cascade,
    version integer not null,
    title text not null,
    payload jsonb not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (lesson_design_id, version)
  )`,
  `create index if not exists idx_lesson_design_versions_design_id
    on lesson_design_versions (lesson_design_id, version desc)`,
  `create table if not exists simulation_sessions (
    id text primary key,
    lesson_design_id text not null references lesson_designs(id) on delete cascade,
    design_version integer not null,
    analysis jsonb,
    turns jsonb not null,
    risks jsonb not null,
    questions jsonb not null,
    journal jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists idx_simulation_sessions_design_id
    on simulation_sessions (lesson_design_id, updated_at desc)`,
];

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for postgres storage.");
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function computeSnapshotUpdatedAt(input: {
  currentDesign: LessonDesign | null;
  designHistory: LessonDesign[];
  sessions: SimulationSessionRecord[];
}) {
  return (
    input.currentDesign?.updatedAt ??
    input.sessions[0]?.updatedAt ??
    input.designHistory[0]?.updatedAt ??
    new Date().toISOString()
  );
}

function mapSessionRow(row: {
  id: string;
  lesson_design_id: string;
  design_version: number;
  analysis: SimulationSessionRecord["analysis"];
  turns: SimulationSessionRecord["turns"];
  risks: SimulationSessionRecord["risks"];
  questions: SimulationSessionRecord["questions"];
  journal: SimulationSessionRecord["journal"];
  updated_at: string | Date;
}): SimulationSessionRecord {
  return {
    id: row.id,
    lessonDesignId: row.lesson_design_id,
    designVersion: row.design_version,
    analysis: row.analysis,
    turns: row.turns,
    risks: row.risks,
    questions: row.questions,
    journal: row.journal,
    updatedAt: toIsoString(row.updated_at),
  };
}

async function ensureSchema() {
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = (async () => {
    const client = await getPool().connect();

    try {
      for (const statement of schemaStatements) {
        await client.query(statement);
      }
    } finally {
      client.release();
    }
  })();

  return schemaReady;
}

export async function readWorkspaceSnapshotPostgres(): Promise<WorkspaceSnapshot> {
  await ensureSchema();
  const database = getPool();

  const [currentDesignResult, designHistoryResult, sessionsResult] = await Promise.all([
    database.query<{ payload: LessonDesign }>(
      `select payload from lesson_designs order by updated_at desc limit 1`,
    ),
    database.query<{ payload: LessonDesign }>(
      `select payload from lesson_design_versions order by updated_at desc`,
    ),
    database.query<{
      id: string;
      lesson_design_id: string;
      design_version: number;
      analysis: SimulationSessionRecord["analysis"];
      turns: SimulationSessionRecord["turns"];
      risks: SimulationSessionRecord["risks"];
      questions: SimulationSessionRecord["questions"];
      journal: SimulationSessionRecord["journal"];
      updated_at: string | Date;
    }>(
      `select id, lesson_design_id, design_version, analysis, turns, risks, questions, journal, updated_at
       from simulation_sessions
       order by updated_at desc`,
    ),
  ]);

  const currentDesign = currentDesignResult.rows[0]?.payload ?? null;
  const designHistory = designHistoryResult.rows.map((row) => row.payload);
  const sessions = sessionsResult.rows.map(mapSessionRow);

  return {
    currentDesign,
    designHistory,
    sessions,
    updatedAt: computeSnapshotUpdatedAt({
      currentDesign,
      designHistory,
      sessions,
    }),
  };
}

export async function saveCurrentDesignPostgres(
  design: LessonDesign,
  persistVersion = false,
): Promise<WorkspaceSnapshot> {
  await ensureSchema();
  const client = await getPool().connect();

  try {
    await client.query("begin");

    await client.query(
      `insert into lesson_designs (
        id, current_version, title, topic, subject_label, target_label, payload, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
      on conflict (id) do update set
        current_version = excluded.current_version,
        title = excluded.title,
        topic = excluded.topic,
        subject_label = excluded.subject_label,
        target_label = excluded.target_label,
        payload = excluded.payload,
        updated_at = excluded.updated_at`,
      [
        design.id,
        design.version,
        design.title,
        design.meta.topic,
        design.meta.subject,
        design.meta.target,
        JSON.stringify(design),
        design.createdAt,
        design.updatedAt,
      ],
    );

    if (persistVersion) {
      await client.query(
        `insert into lesson_design_versions (
          lesson_design_id, version, title, payload, created_at, updated_at
        ) values ($1, $2, $3, $4::jsonb, $5, $6)
        on conflict (lesson_design_id, version) do update set
          title = excluded.title,
          payload = excluded.payload,
          updated_at = excluded.updated_at`,
        [
          design.id,
          design.version,
          design.title,
          JSON.stringify(design),
          design.createdAt,
          design.updatedAt,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return readWorkspaceSnapshotPostgres();
}

export async function saveSimulationSessionPostgres(
  session: SimulationSessionRecord,
): Promise<WorkspaceSnapshot> {
  await ensureSchema();
  const database = getPool();

  await database.query(
    `insert into simulation_sessions (
      id, lesson_design_id, design_version, analysis, turns, risks, questions, journal, created_at, updated_at
    ) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
    on conflict (id) do update set
      lesson_design_id = excluded.lesson_design_id,
      design_version = excluded.design_version,
      analysis = excluded.analysis,
      turns = excluded.turns,
      risks = excluded.risks,
      questions = excluded.questions,
      journal = excluded.journal,
      updated_at = excluded.updated_at`,
    [
      session.id,
      session.lessonDesignId,
      session.designVersion,
      JSON.stringify(session.analysis),
      JSON.stringify(session.turns),
      JSON.stringify(session.risks),
      JSON.stringify(session.questions),
      JSON.stringify(session.journal),
      session.updatedAt,
      session.updatedAt,
    ],
  );

  return readWorkspaceSnapshotPostgres();
}

export async function getLatestSimulationSessionPostgres(lessonDesignId?: string) {
  await ensureSchema();
  const database = getPool();

  const result = lessonDesignId
    ? await database.query<{
        id: string;
        lesson_design_id: string;
        design_version: number;
        analysis: SimulationSessionRecord["analysis"];
        turns: SimulationSessionRecord["turns"];
        risks: SimulationSessionRecord["risks"];
        questions: SimulationSessionRecord["questions"];
        journal: SimulationSessionRecord["journal"];
        updated_at: string | Date;
      }>(
        `select id, lesson_design_id, design_version, analysis, turns, risks, questions, journal, updated_at
         from simulation_sessions
         where lesson_design_id = $1
         order by updated_at desc
         limit 1`,
        [lessonDesignId],
      )
    : await database.query<{
        id: string;
        lesson_design_id: string;
        design_version: number;
        analysis: SimulationSessionRecord["analysis"];
        turns: SimulationSessionRecord["turns"];
        risks: SimulationSessionRecord["risks"];
        questions: SimulationSessionRecord["questions"];
        journal: SimulationSessionRecord["journal"];
        updated_at: string | Date;
      }>(
        `select id, lesson_design_id, design_version, analysis, turns, risks, questions, journal, updated_at
         from simulation_sessions
         order by updated_at desc
         limit 1`,
      );

  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
}