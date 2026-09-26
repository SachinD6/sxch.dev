import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "SachinD6";
const LIMIT = 8;
const EXCLUDE_OWN_REPOS = true;

const SEARCH_LIMIT = 100;
const START_MARKER = "<!-- prs:start -->";
const END_MARKER = "<!-- prs:end -->";
const HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html");

// CLICOLOR_FORCE in the environment makes gh emit ANSI codes even when piped.
const GH_ENV = { ...process.env, CLICOLOR_FORCE: "0" };

function ghJson(args) {
  try {
    return JSON.parse(execFileSync("gh", args, { encoding: "utf8", env: GH_ENV }));
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString().trim() : error.message;
    process.stderr.write(`gh ${args.join(" ")} failed: ${detail}\n`);
    process.exit(1);
  }
}

function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeTitle(value) {
  return escapeText(value).replace(/'/g, "&rsquo;");
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function render(pr) {
  return [
    '      <li class="pr">',
    `        <a href="${escapeAttr(pr.url)}">${escapeTitle(pr.title)}</a>`,
    `        <span class="pr-meta">${escapeText(pr.repo)} #${pr.number} &middot; ${pr.state}</span>`,
    "      </li>",
  ].join("\n");
}

const open = ghJson([
  "search",
  "prs",
  `--author=${OWNER}`,
  "--state=open",
  "--limit",
  String(SEARCH_LIMIT),
  "--json",
  "number,title,repository,url,createdAt",
]);

const merged = ghJson([
  "search",
  "prs",
  `--author=${OWNER}`,
  "--state=closed",
  "--merged",
  "--limit",
  String(SEARCH_LIMIT),
  "--json",
  "number,title,repository,url,closedAt",
]);

const records = [
  ...open.map((pr) => ({
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    title: pr.title,
    state: "open",
    url: pr.url,
    date: pr.createdAt,
  })),
  ...merged.map((pr) => ({
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    title: pr.title,
    state: "merged",
    url: pr.url,
    date: pr.closedAt,
  })),
];

const external = EXCLUDE_OWN_REPOS
  ? records.filter((pr) => pr.repo.split("/")[0] !== OWNER)
  : records;

external.sort(
  (a, b) =>
    b.date.localeCompare(a.date) ||
    a.repo.localeCompare(b.repo) ||
    a.number - b.number
);

const list = external.slice(0, LIMIT);

const html = readFileSync(HTML_PATH, "utf8");
const start = html.indexOf(START_MARKER);
const end = html.indexOf(END_MARKER);

if (start === -1 || end === -1 || end < start) {
  process.stderr.write(`missing ${START_MARKER} or ${END_MARKER} in ${HTML_PATH}\n`);
  process.exit(1);
}

const block = list.length ? `\n${list.map(render).join("\n")}\n      ` : "\n      ";
const next = html.slice(0, start + START_MARKER.length) + block + html.slice(end);

if (next !== html) {
  writeFileSync(HTML_PATH, next);
}

process.stdout.write(`${list.length} pull requests rendered into ${HTML_PATH}\n`);
