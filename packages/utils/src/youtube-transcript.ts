#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { utc_today } from "./index";
import { fetch_video_transcript } from "./transcripts";

function _format_duration(seconds: number | null): string {
  if (seconds === null) {
    return "Unknown";
  }
  const hours = Math.floor(seconds / 3600);
  const remainder = seconds % 3600;
  const minutes = Math.floor(remainder / 60);
  const secs = remainder % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function _format_upload_date(dateStr: string | null): string {
  if (!dateStr) {
    return "Unknown";
  }

  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  return dateStr;
}

export async function fetch_and_format_transcript(
  video_url: string,
  language: string = "en",
): Promise<string> {
  const [transcript, metadata] = await fetch_video_transcript(video_url, language);

  const lines = [
    `# ${metadata.title}`,
    "",
    `Source: ${metadata.url}`,
    `Scraped: ${utc_today()}`,
    `Channel: ${metadata.channel}`,
    `Duration: ${_format_duration(metadata.duration)}`,
    `Upload Date: ${_format_upload_date(metadata.upload_date)}`,
    "",
    "---",
    "",
    "## Transcript",
    "",
    transcript,
  ];

  return lines.join("\n");
}

function printUsage(): void {
  console.log("YouTube transcript fetcher");
  console.log("");
  console.log("Usage:");
  console.log("  bun packages/utils/src/youtube-transcript.ts <youtube-url> [output.md]");
  console.log("");
  console.log("Examples:");
  console.log(
    '  bun packages/utils/src/youtube-transcript.ts "https://www.youtube.com/watch?v=dQw4w9WgXcQ" /tmp/test.md',
  );
  console.log(
    '  bun packages/utils/src/youtube-transcript.ts "https://youtu.be/dQw4w9WgXcQ"',
  );
  console.log(
    '  bun packages/utils/src/youtube-transcript.ts "https://www.youtube.com/watch?v=VIDEO_ID" --language es',
  );
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h", default: false },
      language: { type: "string", short: "l", default: "en" },
    },
  });

  if (parsed.values.help) {
    printUsage();
    return 0;
  }

  const url = parsed.positionals[0];
  const output = parsed.positionals[1];

  if (!url) {
    printUsage();
    return 1;
  }

  try {
    const content = await fetch_and_format_transcript(url, parsed.values.language);

    if (output) {
      const outputPath = resolve(output);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
      console.log(`Transcript saved to: ${outputPath}`);
    } else {
      console.log(content);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

const isCliEntry = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isCliEntry) {
  const code = await main();
  process.exit(code);
}
