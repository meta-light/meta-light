"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as rubric from "@/lib/venture-framework/rubric";

const STORAGE_KEY = "venture-rubric:v1";
type Tab = "scorecard" | "settings" | "lenses";
type Tone = "good" | "warn" | "bad" | null;
interface State {
  inputs: rubric.Inputs;
  settings: rubric.Settings;
  tab: Tab;
}
type Update = (fn: (s: State) => void) => void;
type MoneyKey = "fundSize" | "checkSize" | "entryValuation" | "forwardRevenue" | "treasuryCash" | "monthlyBurn";

const initialState = (): State => ({
  inputs: rubric.emptyInputs(),
  settings: structuredClone(rubric.DEFAULT_SETTINGS),
  tab: "scorecard",
});

const verdictTone = (v: string): Tone =>
  v.startsWith("Pass") ? "bad" : v === "Dig deeper" ? "warn" : v === "Advance to IC" ? "good" : null;
const filterTone = (v: string): Tone => (v === "FAIL" ? "bad" : v === "PASS" ? "good" : null);
const yesNoTone = (v: string | null): Tone => (v === "No" ? "bad" : v === "Yes" ? "good" : null);

const plain = (v: number | null, scale: number) => (v === null ? "" : String(Number((v * scale).toPrecision(12))));

function Out({ text, tone, cell }: { text: string; tone?: Tone; cell?: boolean }) {
  const content = tone === undefined ? text : <span className={`pill ${text ? (tone ?? "") : ""}`}>{text}</span>;
  return cell ? <td className="num out">{content}</td> : <span className="out">{content}</span>;
}

function NumberInput(props: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  scale?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const scale = props.scale ?? 1;
  const [text, setText] = useState(() => plain(props.value, scale));
  const [bad, setBad] = useState(false);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={props.className ?? "numin"}
      aria-label={props.label}
      aria-invalid={bad}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.replace(/[$,%\s]/g, "");
        const v = raw === "" ? null : Number(raw) / scale;
        const invalid =
          v !== null &&
          (!Number.isFinite(v) || (props.min !== undefined && v < props.min) || (props.max !== undefined && v > props.max));
        setBad(invalid);
        props.onChange(invalid ? null : v);
      }}
    />
  );
}

function Select(props: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <select aria-label={props.label} className={props.className} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      <option value="" />
      {props.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function TextInput(props: { value: string; onChange: (v: string) => void; label: string; type?: string }) {
  return <input type={props.type ?? "text"} aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
}

function Kv({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="kv">
      {rows.map(([k, v], i) => (
        <KvRow key={i} k={k} v={v} />
      ))}
    </div>
  );
}

function KvRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <>
      {typeof k === "string" ? <span className="k">{k}</span> : k}
      {v}
    </>
  );
}

function DealSection({ s, r, update }: { s: State; r: rubric.Results; update: Update }) {
  const i = s.inputs;
  const label = (text: string) => <label>{text}</label>;
  return (
    <div className="grid2">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Deal</h2>
        <Kv
          rows={[
            [label("Company"), <TextInput label="Company" value={i.company} onChange={(v) => update((d) => void (d.inputs.company = v))} />],
            [label("Date reviewed"), <TextInput label="Date reviewed" type="date" value={i.dateReviewed} onChange={(v) => update((d) => void (d.inputs.dateReviewed = v))} />],
            [label("Stage"), <Select label="Stage" options={rubric.STAGES} value={i.stage} onChange={(v) => update((d) => void (d.inputs.stage = v))} />],
            [label("Vertical"), <Select label="Vertical" options={rubric.VERTICALS} value={i.vertical} onChange={(v) => update((d) => void (d.inputs.vertical = v))} />],
            [label("Instrument"), <Select label="Instrument" options={rubric.INSTRUMENTS} value={i.instrument} onChange={(v) => update((d) => void (d.inputs.instrument = v))} />],
            [label("Reviewer"), <TextInput label="Reviewer" value={i.reviewer} onChange={(v) => update((d) => void (d.inputs.reviewer = v))} />],
          ]}
        />
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Result</h2>
        <Kv
          rows={[
            ["Fundamentals filter", <Out text={r.filter} tone={filterTone(r.filter)} />],
            ["Weighted score (0-100)", <Out text={rubric.fmt.num1(r.weightedScore)} />],
            ["Verdict", <Out text={r.verdict} tone={verdictTone(r.verdict)} />],
            ["Expected multiple", <Out text={rubric.fmt.mult1(r.expectedMultiple)} />],
            ["Meets target multiple?", <Out text={r.meetsTarget ?? ""} tone={yesNoTone(r.meetsTarget)} />],
            ["Weakest category", <Out text={r.weakestCategory ?? ""} />],
          ]}
        />
      </div>
    </div>
  );
}

function FilterSection({ s, r, update }: { s: State; r: rubric.Results; update: Update }) {
  return (
    <>
      <h2>1. Fundamentals filter (any No fails the deal)</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Gate</th>
              <th>Question</th>
              <th>Answer</th>
            </tr>
          </thead>
          <tbody>
            {rubric.GATES.map((g, i) => (
              <tr key={g.gate}>
                <td>{g.gate}</td>
                <td>{g.question}</td>
                <td style={{ width: 110 }}>
                  <Select
                    label={g.gate}
                    options={["Yes", "No"]}
                    value={s.inputs.gates[i] ?? ""}
                    className={s.inputs.gates[i] === "No" ? "bad" : undefined}
                    onChange={(v) => update((d) => void (d.inputs.gates[i] = (v || null) as rubric.YesNo | null))}
                  />
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={2}>Filter result</td>
              <td>
                <Out text={r.filter} tone={filterTone(r.filter)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScoreRow({ s, row, name, five, update }: { s: State; row: number; name: ReactNode; five: ReactNode; update: Update }) {
  const score = s.inputs.scores[row] ?? null;
  return (
    <tr>
      <td>{name}</td>
      <td className="five">{five}</td>
      <td className={`num${score !== null && score <= 1 ? " lowscore" : ""}`}>
        <NumberInput
          className="score"
          label={typeof name === "string" ? name : "Vertical check score"}
          min={0}
          max={5}
          value={score}
          onChange={(v) => update((d) => void (d.inputs.scores[row] = v))}
        />
      </td>
      <td style={{ minWidth: 160 }}>
        <TextInput label="Notes" value={s.inputs.notes[row] ?? ""} onChange={(v) => update((d) => void (d.inputs.notes[row] = v))} />
      </td>
    </tr>
  );
}

function ScoringSection({ s, update }: { s: State; update: Update }) {
  const lenses = rubric.verticalRows(s.inputs.vertical);
  const rows: ReactNode[] = [];
  rubric.CRITERIA.forEach((c, row) => {
    if (c.category !== rubric.CRITERIA[row - 1]?.category) {
      rows.push(
        <tr className="group" key={`g-${c.category}`}>
          <td colSpan={4}>{c.category}</td>
        </tr>,
      );
    }
    rows.push(<ScoreRow key={row} s={s} row={row} name={c.name} five={c.five} update={update} />);
  });
  rows.push(
    <tr className="group" key="g-vertical">
      <td colSpan={4}>Vertical Fit</td>
    </tr>,
  );
  lenses.forEach((lens, i) => {
    const name = <span className={lens ? "" : "empty-check"}>{lens?.check ?? "No check for this vertical"}</span>;
    rows.push(<ScoreRow key={`v-${i}`} s={s} row={rubric.CRITERIA.length + i} name={name} five={lens?.five ?? ""} update={update} />);
  });
  return (
    <>
      <h2>2. Scoring</h2>
      <p className="lede">Score each criterion 0-5 and leave it blank if it doesn&apos;t apply.</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th>What a 5 looks like</th>
              <th className="num">Score (0-5)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </>
  );
}

function CategorySection({ r }: { r: rubric.Results }) {
  return (
    <>
      <h2>3. Category scores</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Weight</th>
              <th className="num">Criteria scored</th>
              <th className="num">Avg score (0-5)</th>
              <th className="num">Score %</th>
              <th className="num">Weighted points</th>
            </tr>
          </thead>
          <tbody>
            {r.categories.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <Out cell text={String(c.weight)} />
                <Out cell text={String(c.scored)} />
                <Out cell text={rubric.fmt.num1(c.avg)} />
                <Out cell text={rubric.fmt.pct1(c.pct)} />
                <Out cell text={rubric.fmt.num1(c.points)} />
              </tr>
            ))}
            <tr className="total">
              <td colSpan={5}>Weighted score (0-100)</td>
              <Out cell text={rubric.fmt.num1(r.weightedScore)} />
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function ValuationSection({ s, r, update }: { s: State; r: rubric.Results; update: Update }) {
  const money = (label: string, key: MoneyKey): [ReactNode, ReactNode] => [
    <label>{label}</label>,
    <NumberInput label={label} value={s.inputs[key]} onChange={(v) => update((d) => void (d.inputs[key] = v))} />,
  ];
  const dilution = "Expected dilution to exit (%)";
  return (
    <>
      <h2>4. Valuation and return math</h2>
      <div className="grid2">
        <div className="card">
          <Kv
            rows={[
              money("Fund size ($)", "fundSize"),
              money("Check size ($)", "checkSize"),
              money("Entry post-money valuation or FDV ($)", "entryValuation"),
              money("Forward annual revenue, mixed-activity scenario ($)", "forwardRevenue"),
              money("Treasury cash ($)", "treasuryCash"),
              money("Monthly burn ($)", "monthlyBurn"),
              [
                <label>{dilution}</label>,
                <NumberInput
                  label={dilution}
                  scale={100}
                  min={0}
                  max={rubric.MAX_DILUTION}
                  value={s.inputs.dilution}
                  onChange={(v) => update((d) => void (d.inputs.dilution = v))}
                />,
              ],
            ]}
          />
        </div>
        <div className="card">
          <Kv
            rows={[
              ["Ownership at entry", <Out text={rubric.fmt.pct2(r.ownershipAtEntry)} />],
              ["Ownership at exit", <Out text={rubric.fmt.pct2(r.ownershipAtExit)} />],
              ["Exit value needed to return the fund ($)", <Out text={rubric.fmt.money(r.exitValueToReturnFund)} />],
              ["Required multiple on entry valuation", <Out text={rubric.fmt.mult1(r.requiredMultiple)} />],
              ["Entry price-to-sales", <Out text={rubric.fmt.mult1(r.entryPriceToSales)} />],
              ["Runway (months)", <Out text={rubric.fmt.num1(r.runwayMonths)} />],
            ]}
          />
        </div>
      </div>
    </>
  );
}

function ScenarioSection({ s, r, update }: { s: State; r: rubric.Results; update: Update }) {
  return (
    <>
      <h2>5. Outcome scenarios (probability-weighted)</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Probability (%)</th>
              <th>Exit valuation ($)</th>
              <th className="num">Multiple on check</th>
              <th className="num">Weighted multiple</th>
              <th className="num">Returns the fund?</th>
            </tr>
          </thead>
          <tbody>
            {rubric.SCENARIOS.map((name, i) => (
              <tr key={name}>
                <td>{name}</td>
                <td style={{ width: 110 }}>
                  <NumberInput
                    label={`${name} probability (%)`}
                    scale={100}
                    value={s.inputs.scenarios[i]!.probability}
                    onChange={(v) => update((d) => void (d.inputs.scenarios[i]!.probability = v))}
                  />
                </td>
                <td style={{ minWidth: 150 }}>
                  <NumberInput
                    label={`${name} exit valuation ($)`}
                    value={s.inputs.scenarios[i]!.exitValuation}
                    onChange={(v) => update((d) => void (d.inputs.scenarios[i]!.exitValuation = v))}
                  />
                </td>
                <Out cell text={rubric.fmt.mult2(r.scenarios[i]!.multiple)} />
                <Out cell text={rubric.fmt.mult2(r.scenarios[i]!.weighted)} />
                <Out cell text={r.scenarios[i]!.returnsFund ?? ""} />
              </tr>
            ))}
            <tr className="total">
              <td>Total probability</td>
              <Out cell text={rubric.fmt.pct1(r.totalProbability)} />
              <td>
                <Out text={r.probabilityOk ? "OK" : "Must total 100%"} tone={r.probabilityOk ? null : "bad"} />
              </td>
              <td colSpan={3} />
            </tr>
            <tr className="total">
              <td colSpan={4}>Expected multiple</td>
              <Out cell text={rubric.fmt.mult2(r.expectedMultiple)} />
              <td />
            </tr>
            <tr className="total">
              <td colSpan={4}>Probability of returning the fund</td>
              <Out cell text={rubric.fmt.pct1(r.probabilityReturnsFund)} />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsTab({ s, r, update, onRestore }: { s: State; r: rubric.Results; update: Update; onRestore: () => void }) {
  const threshold = (label: string, key: "advanceAt" | "digDeeperAt" | "targetMultiple") => (
    <tr>
      <td>{label}</td>
      <td style={{ width: 100 }}>
        <NumberInput label={label} value={s.settings[key]} onChange={(v) => update((d) => void (d.settings[key] = v ?? 0))} />
      </td>
      <td className="five">Source: placeholder, set your own</td>
    </tr>
  );
  return (
    <section>
      <p className="lede">Weights don&apos;t need to total 100; scores are normalized.</p>
      <h2>Category weights</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Weight</th>
              <th>What it covers (framework section)</th>
            </tr>
          </thead>
          <tbody>
            {rubric.CATEGORIES.map((c, i) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td style={{ width: 100 }}>
                  <NumberInput
                    label={`${c.name} weight`}
                    value={s.settings.weights[i] ?? 0}
                    onChange={(v) => update((d) => void (d.settings.weights[i] = v ?? 0))}
                  />
                </td>
                <td className="five">{c.covers}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <Out cell text={String(r.categories.reduce((a, c) => a + c.weight, 0))} />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <h2>Thresholds</h2>
      <div className="tablewrap">
        <table>
          <tbody>
            {threshold("Advance to IC at or above (score out of 100)", "advanceAt")}
            {threshold("Dig deeper at or above", "digDeeperAt")}
            {threshold("Target expected multiple per deal", "targetMultiple")}
          </tbody>
        </table>
      </div>
      <h2>Score scale</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {rubric.SCORE_SCALE.map(([score, meaning]) => (
              <tr key={score}>
                <td>{score}</td>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 24 }}>
        <button type="button" className="linkbtn" onClick={onRestore}>
          Restore default settings
        </button>
      </p>
    </section>
  );
}

function LensesTab() {
  return (
    <section>
      <p className="lede">The Scorecard&apos;s Vertical Fit rows pull the first five checks for the selected vertical.</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Vertical</th>
              <th>Check</th>
              <th>What a 5 looks like</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rubric.VERTICAL_LENSES.map((l) => (
              <tr key={`${l.vertical}-${l.check}`}>
                <td>{l.vertical}</td>
                <td>{l.check}</td>
                <td className="five">{l.five}</td>
                <td className="five">{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const TABS: [Tab, string][] = [
  ["scorecard", "Scorecard"],
  ["settings", "Settings"],
  ["lenses", "Vertical Lenses"],
];

export default function Calculator() {
  const [state, setState] = useState<State>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        setState((s) => ({
          inputs: saved.inputs ? { ...rubric.emptyInputs(), ...saved.inputs } : s.inputs,
          settings: saved.settings ? { ...structuredClone(rubric.DEFAULT_SETTINGS), ...saved.settings } : s.settings,
          tab: saved.tab ?? s.tab,
        }));
        setEpoch((e) => e + 1);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, loaded]);

  const results = useMemo(() => rubric.compute(state.inputs, state.settings), [state.inputs, state.settings]);

  const update: Update = (fn) =>
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const reset = (fn: (s: State) => void) => {
    update(fn);
    setEpoch((e) => e + 1);
  };

  const props = { s: state, r: results, update };
  return (
    <main>
      <p className="crumbs">
        <Link href="/venture-framework">← Venture Investment Framework</Link>
      </p>
      <h1>Venture Investment Scorecard</h1>
      <p className="lede">
        Fill in the highlighted fields. Score each criterion 0-5 and leave it blank if it doesn&apos;t apply. Everything else calculates.
      </p>
      <nav role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={id === state.tab} onClick={() => update((d) => void (d.tab = id))}>
            {label}
          </button>
        ))}
      </nav>
      <div key={epoch}>
        {state.tab === "scorecard" && (
          <section>
            <DealSection {...props} />
            <FilterSection {...props} />
            <ScoringSection s={state} update={update} />
            <CategorySection r={results} />
            <ValuationSection {...props} />
            <ScenarioSection {...props} />
            <p style={{ marginTop: 24 }}>
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  if (confirm("Clear every input on the scorecard?")) reset((d) => void (d.inputs = rubric.emptyInputs()));
                }}
              >
                Clear scorecard
              </button>
            </p>
          </section>
        )}
        {state.tab === "settings" && (
          <SettingsTab {...props} onRestore={() => reset((d) => void (d.settings = structuredClone(rubric.DEFAULT_SETTINGS)))} />
        )}
        {state.tab === "lenses" && <LensesTab />}
      </div>
    </main>
  );
}
