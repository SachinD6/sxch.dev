import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "SachinD6";
const HOME_LIMIT = 3;
const PAGE_LIMIT = 50;
const EXCLUDE_OWN_REPOS = true;

const SEARCH_LIMIT = 100;
const START_MARKER = "<!-- prs:start -->";
const END_MARKER = "<!-- prs:end -->";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
  { path: join(ROOT, "public", "index.html"), limit: HOME_LIMIT },
  { path: join(ROOT, "public", "open-source", "index.html"), limit: PAGE_LIMIT },
];

// CLICOLOR_FORCE in the environment makes gh emit ANSI codes even when piped.
const GH_ENV = { ...process.env, CLICOLOR_FORCE: "0" };

// Octicon paths from primer/octicons: git-pull-request-16 and git-merge-16.
const ICONS = {
  open: {
    className: "pr-icon-open",
    path: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
  },
  merged: {
    className: "pr-icon-merged",
    path: "M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z",
  },
};

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
  const icon = ICONS[pr.state];
  return [
    '      <li class="pr">',
    `        <svg class="pr-icon ${icon.className}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="${icon.path}"/></svg>`,
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

const pages = TARGETS.map((target) => {
  const html = readFileSync(target.path, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    process.stderr.write(`missing ${START_MARKER} or ${END_MARKER} in ${target.path}\n`);
    process.exit(1);
  }

  return { ...target, html, start, end };
});

for (const page of pages) {
  const list = external.slice(0, page.limit);
  const block = list.length ? `\n${list.map(render).join("\n")}\n      ` : "\n      ";
  const next =
    page.html.slice(0, page.start + START_MARKER.length) + block + page.html.slice(page.end);

  if (next !== page.html) {
    writeFileSync(page.path, next);
  }

  process.stdout.write(`${list.length} pull requests rendered into ${page.path}\n`);
}
