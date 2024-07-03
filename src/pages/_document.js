import Document, { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
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