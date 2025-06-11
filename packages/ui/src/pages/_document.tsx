import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="apple-touch-icon" sizes="76x76" href="/favicon.svg" />
        <link rel="icon" type="image/svg" sizes="32x32" href="/favicon.svg" />
        <link rel="icon" type="image/svg" sizes="16x16" href="/favicon.svg" />
      </Head>
      <body className="bg-neutral-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
