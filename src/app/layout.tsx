import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "\uC218\uC5C5 \uC124\uACC4 \uC2A4\uD29C\uB514\uC624",
  description:
    "\uAD50\uC0AC\uC758 \uC218\uC5C5 \uC124\uACC4, Human-AI \uCE74\uB4DC \uBC30\uCE58, \uBAA8\uC758 \uC218\uC5C5 \uC2E4\uD589, \uC131\uCC30 \uC77C\uC9C0 \uC791\uC131\uC744 \uC9C0\uC6D0\uD558\uB294 \uD558\uB124\uC2A4 \uAE30\uBC18 \uC5D0\uC774\uC804\uD2B8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
