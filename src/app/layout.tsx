import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "수업 설계 오케스트레이션 에이전트",
  description:
    "교사의 수업 설계, 인간-AI 카드 배치, 모의수업 실행, 성찰 일지 작성을 돕는 하네스 기반 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
