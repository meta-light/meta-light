import { fmtPct } from "./common";

const API = "https://chutes.ai/api/research";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

type Utilization = {
  name: string;
  utilization_1h: number;
  total_requests_1h: number;
  rate_limited_requests_1h: number;
  active_instance_count: number;
  action_taken: string;
};

export async function chutesPlatform() {
  const [overview, llm, users, utilization] = await Promise.all([
    get<{ total_gpus: number; gpu_types: number; total_chutes: number; requests_last_hour: number; active_instances: number }>("/overview"),
    get<{ daily_data: Array<{ date: string; tokens: number; count: number }> }>("/stats?type=llm&period=year"),
    get<Array<{ date: string; daily_count: number; cumulative_count: number }>>("/stats?type=users"),
    get<Utilization[]>("/utilization"),
  ]);
  return { overview, daily: llm.daily_data, users, utilization };
}

export type ChutesPlatform = Awaited<ReturnType<typeof chutesPlatform>>;

export function chutesSummary(p: ChutesPlatform) {
  const recent = p.users.slice(-8, -1);
  return [
    {
      GPUs: p.overview.total_gpus,
      "GPU types": p.overview.gpu_types,
      Chutes: p.overview.total_chutes,
      "Active instances": p.overview.active_instances,
      "Requests 1h": p.overview.requests_last_hour,
      Users: p.users.at(-1)?.cumulative_count ?? 0,
      "New users 7d": recent.reduce((a, d) => a + d.daily_count, 0),
    },
  ];
}

export function chutesBusiest(p: ChutesPlatform, n: number) {
  return [...p.utilization]
    .sort((a, b) => b.total_requests_1h - a.total_requests_1h)
    .slice(0, n)
    .map((u) => ({
      Chute: u.name,
      "Req 1h": u.total_requests_1h,
      "Util 1h": fmtPct(u.utilization_1h * 100),
      "Rate-limited": u.total_requests_1h ? fmtPct((u.rate_limited_requests_1h / u.total_requests_1h) * 100) : "—",
      Instances: u.active_instance_count,
      Scaling: u.action_taken,
    }));
}

export const chutesTokens = (p: ChutesPlatform) => new Map(p.daily.map((d) => [d.date, d.tokens]));
