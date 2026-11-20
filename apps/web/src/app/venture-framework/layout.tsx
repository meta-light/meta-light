import type { ReactNode } from "react";
import "./venture.css";

export const metadata = {
  title: "Venture Investment Framework",
  description: "Investment philosophy, evaluation framework and scoring rubric, with a deal scorecard calculator.",
};

export default function VentureFrameworkLayout({ children }: { children: ReactNode }) {
  return <div className="vf">{children}</div>;
}
