---
humans: "0.3"
id: nick
name: Nick
updated: "2026-11-20"
visibility: private
languages: [en]
reading:
  lead_with: tldr
  length: short
  max_words: 199
  structure: bullets
  visual: [table, example]
  technical_depth: expert
  jargon: ok
  tone: direct
  evidence: numbers_and_sources
  uncertainty: flag_explicitly
  close_with: next_action
deciding:
  reversible: decide_and_report
  batch_questions: end_of_task
  default_answer: always
  asks_per_message: few
  format: recommendation_first
  question_style: yes_confirms_recommendation
  challenge: welcome_early
  out_of_scope_steps: omit_unless_blocking
interrupting:
  interrupt_for: blocking_or_risky
  progress_updates: phase_changes
  channel_hint: async_written
context:
  role: researcher
  knows_well: [typescript, react, node, frontend, apis, sql, data-pipelines, analytics, cloudflare, docker, infrastructure, networking, distributed-systems, finance, llm-agents]
  decides: [architecture, schema-changes, dependencies, vendor-choice, copy-and-content]
  context_updated: "2026-11-20"
avoid: [walls_of_text, filler_intro, filler_outro, hedging, emoji, exclamation, long_preamble, recap]
notes: "Researcher who also builds. Plan before non-trivial work; just fix bugs. Bulk changes to files I did not name count as risky."
---
