import Document, { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
          <link href="https://fonts.googleapis.com/css2?family=Fira+Mono&display=optional" rel="stylesheet" />
          <Script src="/capital/scripts/jquery.min.js" strategy="beforeInteractive" />
          <Script src="/capital/scripts/browser.min.js" strategy="beforeInteractive" />
          <Script src="/capital/scripts/breakpoints.min.js" strategy="beforeInteractive" />
          <Script src="/capital/scripts/util.js" strategy="beforeInteractive"/>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;