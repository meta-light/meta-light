import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const INLINE_TIME_TAG = /<\d{2}:\d{2}:\d{2}\.\d{3}>/;
const INLINE_TIME_TAG_GLOBAL = /<\d{2}:\d{2}:\d{2}\.\d{3}>/g;
const STYLE_TAG_GLOBAL = /<\/?c[^>]*>/g;
const WHITESPACE_GLOBAL = /\s+/g;

async function runCommand(
  command: string,
  args: string[],
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(chunk.toString());
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(chunk.toString());
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      resolve({
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        exitCode: code ?? 1,
      });
    });
  });
}

async function listVttFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".vtt"),
    )
    .map((entry) => join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export type VideoMetadata = {
  video_id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  duration: number | null;
  url: string;
};

export class VttPlaintext {
  static vttToText(vttContent: string): string {
    const lines: string[] = [];
    const source = vttContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (const raw of source.split("\n")) {
      const stripped = raw.trim();

      if (!stripped) {
        lines.push("");
        continue;
      }

      if (
        stripped.startsWith("WEBVTT") ||
        stripped.startsWith("Kind:") ||
        stripped.startsWith("Language:")
      ) {
        continue;
      }
      if (stripped.includes("-->")) {
        continue;
      }
      if (/^\d+$/.test(stripped)) {
        continue;
      }
      if (INLINE_TIME_TAG.test(stripped)) {
        continue;
      }

      let text = stripped.replace(INLINE_TIME_TAG_GLOBAL, "");
      text = text.replace(STYLE_TAG_GLOBAL, "");
      text = text.trim();

      if (text) {
        lines.push(text);
      }
    }

    const normalized: string[] = [];
    let previousBlank = true;
    for (const line of lines) {
      if (!line) {
        if (!previousBlank) {
          normalized.push("");
        }
        previousBlank = true;
      } else {
        normalized.push(line);
        previousBlank = false;
      }
    }

    const deduped: string[] = [];
    let previousLine: string | null = null;
    for (const line of normalized) {
      if (line && line === previousLine) {
        continue;
      }
      deduped.push(line);
      if (line) {
        previousLine = line;
      }
    }

    return `${deduped.join("\n").trim()}\n`;
  }

  static flattenText(text: string): string {
    return text.replace(WHITESPACE_GLOBAL, " ").trim();
  }

  static async vttToTextFile(vttPath: string, txtPath: string): Promise<void> {
    const content = await readFile(vttPath, "utf8");
    const text = VttPlaintext.vttToText(content);
    await mkdir(dirname(txtPath), { recursive: true });
    await writeFile(txtPath, text, "utf8");
  }
}

export class YtDlpTranscripts {
  static async getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    const args = [
      "--skip-download",
      "--no-warnings",
      "--print",
      "%(id)s",
      "--print",
      "%(title)s",
      "--print",
      "%(channel)s",
      "--print",
      "%(upload_date)s",
      "--print",
      "%(duration)s",
      videoUrl,
    ];

    let result: CommandResult;
    try {
      result = await runCommand("yt-dlp", args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`yt-dlp failed to fetch metadata: ${message}`);
    }

    if (result.exitCode !== 0) {
      throw new Error(
        `yt-dlp failed to fetch metadata: ${result.stderr.trim()}`,
      );
    }

    const lines = result.stdout.trim().split(/\r?\n/);
    if (lines.length < 5) {
      throw new Error(`Unexpected yt-dlp output: ${result.stdout}`);
    }

    const durationRaw = lines[4].trim();
    const parsedDuration = Number.parseInt(durationRaw, 10);
    const duration =
      durationRaw && durationRaw !== "NA" && Number.isFinite(parsedDuration)
        ? parsedDuration
        : null;

    return {
      video_id: lines[0].trim(),
      title: lines[1].trim(),
      channel: lines[2].trim(),
      upload_date:
        lines[3].trim() && lines[3].trim() !== "NA" ? lines[3].trim() : null,
      duration,
      url: videoUrl,
    };
  }

  private static buildSingleVideoCmd(
    videoUrl: string,
    outputDir: string,
    language: string,
    useAutoSubs: boolean,
  ): string[] {
    const subFlag = useAutoSubs ? "--write-auto-subs" : "--write-subs";
    return [
      "--skip-download",
      subFlag,
      "--sub-langs",
      language,
      "--sub-format",
      "vtt",
      "--no-warnings",
      "--ignore-errors",
      "--no-check-certificate",
      "--output",
      join(outputDir, "%(id)s.%(ext)s"),
      videoUrl,
    ];
  }

  static async fetchVideoTranscript(
    videoUrl: string,
    language: string = "en",
    useAutoSubs: boolean = true,
  ): Promise<[string, VideoMetadata]> {
    const metadata = await YtDlpTranscripts.getVideoMetadata(videoUrl);
    const tempDirectory = await mkdtemp(join(tmpdir(), "yt-dlp-transcript-"));
    let latestResult: CommandResult = { stdout: "", stderr: "", exitCode: 0 };

    try {
      const initialArgs = YtDlpTranscripts.buildSingleVideoCmd(
        videoUrl,
        tempDirectory,
        language,
        useAutoSubs,
      );
      try {
        latestResult = await runCommand("yt-dlp", initialArgs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`yt-dlp failed to fetch transcript: ${message}`);
      }

      let vttFiles = await listVttFiles(tempDirectory);
      if (vttFiles.length === 0 && useAutoSubs) {
        const fallbackArgs = YtDlpTranscripts.buildSingleVideoCmd(
          videoUrl,
          tempDirectory,
          language,
          false,
        );
        try {
          latestResult = await runCommand("yt-dlp", fallbackArgs);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(`yt-dlp failed to fetch transcript: ${message}`);
        }
        vttFiles = await listVttFiles(tempDirectory);
      }

      if (vttFiles.length === 0) {
        const stderr = latestResult.stderr.trim() || "unknown error";
        throw new Error(
          `No transcript available for video ${metadata.video_id}. The video may not have subtitles. Error: ${stderr}`,
        );
      }

      const vttContent = await readFile(vttFiles[0], "utf8");
      const transcript = VttPlaintext.vttToText(vttContent);
      return [transcript, metadata];
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

// Migration-friendly snake_case exports.
export function vtt_to_text(vttContent: string): string {
  return VttPlaintext.vttToText(vttContent);
}

export function flatten_text(text: string): string {
  return VttPlaintext.flattenText(text);
}

export async function vtt_to_text_file(
  vttPath: string,
  txtPath: string,
): Promise<void> {
  await VttPlaintext.vttToTextFile(vttPath, txtPath);
}

export async function get_video_metadata(
  videoUrl: string,
): Promise<VideoMetadata> {
  return YtDlpTranscripts.getVideoMetadata(videoUrl);
}

export async function fetch_video_transcript(
  videoUrl: string,
  language: string = "en",
  use_auto_subs: boolean = true,
): Promise<[string, VideoMetadata]> {
  return YtDlpTranscripts.fetchVideoTranscript(
    videoUrl,
    language,
    use_auto_subs,
  );
}
