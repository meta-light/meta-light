import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function Home() {
  useEffect(() => {
    let j, o, y, x, c, i, D, S, r;
    (r=()=>setInterval(t=>{for(j=o="\n",y=5;y--;document.body["inn"
      +"erHTML"]="<pre>&lt"+(S="script>\n")+o+"\n\n&lt/"+S)for(x=-0o1;
      63-!y>x++;o+=`(r=${r})()`[j++].fontcolor(c?"#FF0":"#444"))c=x/2
      %4<3&&parseInt("odRFacb67o2vi5gmOZmwFNteohbOh3sw".slice(i="9"<(
      D=Date()[16+(x/8|0)])?30:D*3,i+3),36)&1<<(x/2|0)%4+3*y},100))()

    const intervalId = r();

    return () => clearInterval(intervalId);
  }, []);

  return (
    <>
      <Head>
        <title>Qlock</title>
        <meta property="og:title" content="Qlock - A JavaScript Quine Clock" />
        <meta property="og:url" content="https://aem1k.com/qlock" />
        <meta property="og:image" content="https://aem1k.com/qlock/preview.png" />
        <meta property="og:description" content="Displays the current time in a seven-segment style, embedded within its own JavaScript source code. (321 bytes)" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
      </Head>
      <style jsx global>{`
        body {
          background-color: black;
          color: #0FF;
          height: 100vh;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        pre {
          font-family: "Fira Mono", monospace;
          font-size: 18px;
          line-height: 1;
          margin: 0;
          white-space: pre-wrap; /* Ensure line breaks are respected */
        }
      `}</style>
    </>
  );
}