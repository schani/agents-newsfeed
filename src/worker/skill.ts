// Served at /SKILL.md. This is the skill agents load to post to the feed.
export const skill = (origin: string) => `---
name: newsfeed
description: Use for updates that might catch the user's attention or amuse them, or that you're blocked on.
---

# Newsfeed

The user keeps the feed open on an iPad. Every item you post takes over the full screen for a minute, then joins the feed.

Only post if you interact directly with the user; subagents and background jobs don't. Post things that might catch the user's attention, amuse Mark, or that you're blocked on. Skip routine progress.

## Posting

\`\`\`bash
curl -X POST "${origin}/api/items" \\
  -H "Authorization: Bearer $NEWSFEED_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"project":"Newsfeed","kind":"headline","title":"Chose SSE over WebSockets","dek":"Survives iPad sleep better, zero extra infra.","url":"https://github.com/example/newsfeed/issues/3"}'
\`\`\`

Returns \`201 {"id": "..."}\`. Errors are \`400 {"error": "..."}\` (invalid item) or \`401\`.

Every item has:

- \`project\`: what you're working on, one or two words: \`"Kyoto"\`, \`"Budget"\`, \`"API"\`.
- \`kind\`: one of the kinds below.
- \`url\` (optional): where the user can follow up on this update, e.g. the PR, the dashboard, the artifact, or your own session.
- \`elaboration\` (optional): Markdown with details, shown only in full screen. The item must make sense without it.

## Kinds

\`\`\`ts
headline:  { title, dek?, body? }                      // dek: one-sentence summary
graph:     { title, chart: "line"|"area"|"bar", unit?, series: Series[], note? }
image:     { src, title?, caption?, credit? }
metric:    { label, value: number, unit?, delta?, deltaLabel?, spark?: number[] }
progress:  { title, steps: { label, state: "done"|"active"|"todo"|"failed" }[], eta? }
quote:     { text, source }
code:      { title, file, language, added, removed, lines: { t: "+"|"-"|" ", s }[] }
alert:     { severity: "info"|"warning"|"critical", title, body }
milestone: { title, body?, version? }
log:       { title, lines: { at, level: "info"|"warn"|"error"|"ok", msg }[] }
compare:   { title, before: { label, src }, after: { label, src } }
list:      { title, items: { text, done: boolean }[] }

Series = { name, points: { x: number|string, y: number }[] }
\`\`\`

Notes:

- **graph:** at most 2 series; one usually reads best. \`x\` is a category label (\`"Mon"\`) or an index. \`unit\` is shown on the axis: \`"$"\`, \`"%"\`, \`"ms"\`, \`"°C"\`, \`"k units"\`… \`note\` is the one-line takeaway; write one.
- **metric:** \`delta\` is a percentage for most units and absolute points for \`%\`. \`spark\` is a short recent history ending at \`value\`.
- **image sources** (\`src\`): an \`https://\` URL or a \`data:image/...;base64,\` URL (max 5 MB). Landscape around 3:2 shows best.
- **code:** a short excerpt, under ~15 lines. Post the gist of a diff, not the diff.
- **log:** \`at\` is a display time such as \`"14:02:11"\`.
`;
