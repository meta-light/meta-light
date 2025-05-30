import { Inter } from "next/font/google";
// import Script from "next/script";
import ProviderWrapper from "../components/basket/providers/ProviderWrapper";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Nick Carpinito", 
  description: ""
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png"/>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Mono&display=optional" rel="stylesheet" />
        {/* <Script src="/capital/scripts/jquery.min.js" strategy="beforeInteractive" />
        <Script src="/capital/scripts/browser.min.js" strategy="beforeInteractive" />
        <Script src="/capital/scripts/breakpoints.min.js" strategy="beforeInteractive" />
        <Script src="/capital/scripts/util.js" strategy="beforeInteractive"/> */}
      </head>
      <body className={inter.className}>
        <ProviderWrapper>
          {children}
        </ProviderWrapper>
      </body>
    </html>
  );
}
