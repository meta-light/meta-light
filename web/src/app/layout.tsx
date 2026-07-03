import { Inter } from "next/font/google";
import ProviderWrapper from "../components/solana/ProviderWrapper";
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
      </head>
      <body className={inter.className}>
        <ProviderWrapper>
          {children}
        </ProviderWrapper>
      </body>
    </html>
  );
}
