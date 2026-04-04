import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_NAME,
  getSharedPasswordConfig,
  normalizeReturnTo,
  verifyAccessToken,
} from "@/lib/server/access-gate";

type UnlockPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = getSingleValue(resolvedSearchParams.error);
  const returnTo = normalizeReturnTo(getSingleValue(resolvedSearchParams.returnTo));
  const config = getSharedPasswordConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (config && (await verifyAccessToken(accessToken, config.secret))) {
    redirect(returnTo);
  }

  return (
    <main className="unlockShell">
      <section className="unlockCard">
        <p className="eyebrow">Shared Access</p>
        <h1>비밀번호를 입력해 들어오세요</h1>
        <p className="unlockDescription">
          첫 진입 시 공용 비밀번호를 확인한 뒤 접근을 허용합니다. 비밀번호는 서버 환경 변수에서만
          확인합니다.
        </p>
        {error === "invalid" ? (
          <p className="formError">비밀번호가 맞지 않습니다. 다시 입력해 주세요.</p>
        ) : null}
        {error === "config" || !config ? (
          <p className="formError">
            접근 비밀번호가 아직 설정되지 않았습니다. `APP_SHARED_PASSWORD`와
            `APP_SESSION_SECRET`을 먼저 설정해 주세요.
          </p>
        ) : null}
        <form className="unlockForm" action="/api/access" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="fieldLabel" htmlFor="password">
            공용 비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="textInput"
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            required
            disabled={!config}
          />
          <button type="submit" className="primaryButton unlockSubmit" disabled={!config}>
            입장하기
          </button>
        </form>
      </section>
    </main>
  );
}
