import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });
export const metadata = {title: "Nick Carpinito", description: ""};
export default function RootLayout({ children }) {return (<html lang="en"><head><link rel="icon" href="/favicon.png"/></head><body className={inter.className}>{children}</body></html>);}
