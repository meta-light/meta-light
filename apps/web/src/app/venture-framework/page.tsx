import Link from "next/link";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import html from "remark-html";
import source from "@/lib/venture-framework/framework.md";

export const dynamic = "force-static";

export default async function FrameworkPage() {
  const body = String(await remark().use(remarkGfm).use(html).process(source));
  return (
    <main>
      <div className="card cta">
        <span>Score a deal against this framework.</span>
        <Link href="/venture-framework/calculator" className="linkbtn">
          Open the scorecard calculator →
        </Link>
      </div>
      <article className="doc" dangerouslySetInnerHTML={{ __html: body }} />
    </main>
  );
}
