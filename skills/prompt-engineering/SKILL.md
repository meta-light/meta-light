---
name: prompt-engineering
description: Design, debug and document prompts for LLM calls. Covers sampling config (temperature, top-K, top-P, max tokens), zero/few-shot, system/role/context prompts, step-back, chain of thought, self-consistency, tree of thoughts, ReAct, automatic prompt engineering, structured JSON output and input schemas, and a prompt log template. Use when writing or improving a prompt or system prompt for an LLM feature, agent, classifier or extractor, when model output is inconsistent, wrong-format or truncated, or when choosing sampling settings.
metadata:
  source: Lee Boonstra, "Prompt Engineering" (Google whitepaper, Feb 2025)
---

# Prompt engineering

An LLM predicts the next token. A prompt sets it up to predict the right sequence. Prompt engineering is iterative: write, test, document, refine. The prompt, the model, its version and the sampling config all change the output, so treat them together.

## Workflow

1. **Define the goal and the check.** Write one sentence for what the output must do. Then decide how you'll tell a good output from a bad one: an exact label, valid JSON against a schema, a rubric, or a reference answer.
2. **Pick a technique** from the table below. Start with the simplest one that could work, and escalate only when tests fail.
3. **Set the config.** See Sampling.
4. **Write the prompt** following Best practices.
5. **Test** on a handful of real inputs plus edge cases. For anything that ships, build a small eval set and rerun it on every change.
6. **Log each attempt** using the Prompt log template. Change one thing at a time.

## Sampling

| Setting | Effect |
|---|---|
| **Max output tokens** | A hard stop, not a style setting. A low cap cuts the text off mid-sentence; it doesn't make it shorter. Ask for brevity in the prompt as well. Cap it tightly for ReAct, which keeps generating after the useful part. |
| **Temperature** | Randomness. 0 is greedy and (nearly) deterministic. Higher values give more diverse output. |
| **Top-K** | Sample only from the K most likely tokens. K = 1 is greedy. |
| **Top-P** | Sample from the smallest set of tokens whose probabilities add up to P. P near 0 is greedy; P = 1 allows every token. |

Order of application, where all three exist: top-K and top-P filter the candidates first, then temperature samples from what's left. Extreme values override the others: temperature 0, top-K 1 or top-P near 0 each make the remaining settings irrelevant.

Starting points (temperature / top-P / top-K):

| Task | T | P | K |
|---|---|---|---|
| Balanced default | 0.2 | 0.95 | 30 |
| Creative | 0.9 | 0.99 | 40 |
| Factual / conservative | 0.1 | 0.9 | 20 |
| Single correct answer (math, classification) | 0 | n/a | n/a |

**Repetition loops** (output that ends in repeated filler) can come from either extreme. Very low temperature locks onto a cycle; very high temperature wanders back into one. Fix them by tuning temperature together with top-K and top-P.

*Addition, not in the paper:* providers differ. Some APIs don't expose top-K. Some reject setting temperature and top-P together. Reasoning or "extended thinking" modes often fix or ignore the sampling parameters. Check the current provider docs before you tune.

## Techniques

| Technique | What it is | Use when |
|---|---|---|
| **Zero-shot** | A task description only | The task is common and the format is simple. Try this first. |
| **One-/few-shot** | Show 1, or 3–5+, worked examples | You need a specific format, style or pattern. This is the highest-leverage technique. |
| **System prompt** | The overall task and output rules ("Only return the label in uppercase") | Enforcing format, language, safety or tone across every call |
| **Role prompt** | An identity for the model ("Act as a travel guide"), optionally with a style (direct, formal, humorous, persuasive...) | You need consistent voice, expertise or perspective |
| **Contextual prompt** | Background specific to this task ("You are writing for a blog about 80s arcade games") | The right answer depends on situation-specific details |
| **Step-back** | First ask a general question about the principles involved, then feed that answer into the specific task | Output is generic, or the task benefits from first recalling the relevant background knowledge |
| **Chain of thought (CoT)** | Ask for the reasoning steps before the answer, ideally with one worked example | Math, logic, multi-step problems, or any task you could solve by talking it through |
| **Self-consistency** | Run the same CoT prompt N times at high temperature and take the majority answer | Accuracy matters more than cost. Agreement across runs also gives a rough confidence. |
| **Tree of thoughts (ToT)** | Explore and prune several reasoning branches | Open problems that need exploration rather than a single chain |
| **ReAct** | A thought → action (tool call) → observation loop until the answer is reached | The answer needs external data or tools (search, code, APIs). This is the basis of agents. |
| **Automatic prompt engineering (APE)** | Have a model generate prompt variants, score them, keep the best and repeat | Generating many phrasings (e.g. chatbot training utterances) or searching for a better instruction |

### Few-shot rules

- Start at 3–5 examples, or about 6 for classification, and measure from there.
- The examples must be correct and well written. The model copies their mistakes too; one typo in an example can show up in every output.
- Include edge cases, not just the easy inputs.
- **For classification, mix the order of the classes** so the model learns their features rather than their position.

### CoT rules

- **The reasoning comes before the final answer.** The answer has to be generated after the reasoning tokens for them to help.
- Make the final answer easy to extract and separate from the reasoning, e.g. "The answer is X" or an `answer` field. Self-consistency depends on this.
- The paper recommends temperature 0 for CoT, since there's usually one right answer. Self-consistency deliberately uses a high temperature instead.
- *Addition:* models with built-in reasoning ("thinking") modes already reason before answering. For them, a "think step by step" line adds little. Spend the effort on the examples and the output spec instead.

### ReAct in code

Each turn, resend the full history of thoughts, actions and observations, and trim whatever the model generates past the action. Cap the output tokens. Give it examples or instructions for the exact action format.

## Best practices

- **Provide examples.** This is the single most effective practice.
- **Keep it simple.** If the prompt confuses you, it will confuse the model. Cut unnecessary background.
  - Before: "I am visiting New York right now, and I'd like to hear more about great locations. I am with two 3 year old kids. Where should we go?"
  - After: "Act as a travel guide for tourists. Describe great places to visit in Manhattan with a 3 year old."
- **Start with an action verb:** Analyze, Classify, Compare, Extract, Generate, List, Parse, Rank, Rewrite, Summarize, Translate, Write...
- **Be specific about the output.** "Generate a 3 paragraph blog post about the top 5 video game consoles, informative and conversational" beats "Generate a blog post about video game consoles."
- **Prefer instructions to constraints.** Say what to do ("Only discuss the console, its maker, year and total sales"), not what to avoid ("Do not list game names"). Keep constraints for safety, hard format rules, or a must-not-cross line. Long lists of "don't"s can contradict each other.
- **Control length** in the prompt ("in a tweet-length message") as well as with max tokens.
- **Use variables** (`{city}`) so a prompt can be reused and kept in code.
- **Try different phrasings:** as a question, a statement to complete, or an instruction. They produce different outputs.
- **Retest when the model changes.** A new model or version can change how a prompt behaves.
- **For data tasks, ask for structured output.** For extraction, classification, ranking and parsing, request JSON (or XML) with a schema. It keeps the format consistent, keeps the model focused on the requested fields, reduces hallucination, and gives you types you can sort.
  - JSON costs more tokens and breaks when truncated. Leave room in max tokens, and repair malformed output with a library (`json-repair` on PyPI).
  - *Addition:* if the API supports native structured outputs or tool/function schemas, use them rather than relying on the prompt alone.
- **Structure the input too.** Give a JSON Schema plus data that conforms to it, instead of whole documents. It focuses the model on the relevant fields, and dates with explicit formats help it reason about time.
- **Have several people try** the same prompt and compare the results.

## Prompt log template

Log every attempt. Outputs vary across models, versions and settings, and even between identical calls.

| Field | Value |
|---|---|
| Name | `<name>_v<n>` |
| Goal | One sentence |
| Model | Name and exact version |
| Temperature / Token limit | |
| Top-K / Top-P | |
| Prompt | The full prompt text, with variables shown |
| Output | The output, or several outputs |
| Result | OK / NOT OK / SOMETIMES OK |
| Feedback | What to change next |

For RAG, also log the retrieval query, chunk settings and the retrieved chunks that went into the prompt.

When the prompt is good enough, move it into the codebase **as its own file, separate from the code**, and back it with automated evals.

## Output

When writing or fixing a prompt, return:

1. The prompt, in a code block, with `{variables}` marked.
2. The recommended config (model, temperature, top-P/top-K if the API exposes them, max tokens) and why.
3. The technique used and why it fits. If you're debugging, name what was wrong in one line.
4. 3–5 test inputs, including edge cases, with what a correct output looks like for each.
5. If the user is iterating, a filled-in log row for this attempt.
