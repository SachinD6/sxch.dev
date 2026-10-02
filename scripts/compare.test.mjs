import assert from "node:assert/strict";
import { test } from "node:test";

import { compareRecords } from "./compare.mjs";

const merged = (repo, number, date) => ({ state: "merged", repo, number, date });
const open = (repo, number, date) => ({ state: "open", repo, number, date });
const accepted = (repo, number, date) => ({ state: "accepted", repo, number, date });

const key = (record) => `${record.repo}#${record.number}${record.title ? ` ${record.title}` : ""}`;

const order = (records) => records.slice().sort(compareRecords).map(key);

test("a merged record sorts before an open record with a newer date", () => {
  assert.deepEqual(order([open("acme/widgets", 12, "2025-09-09"), merged("acme/tools", 4, "2024-05-01")]), [
    "acme/tools#4",
    "acme/widgets#12",
  ]);
});

test("a merged record sorts before an accepted record with a newer date", () => {
  assert.deepEqual(
    order([accepted("acme/docs", 31, "2025-09-09"), merged("acme/tools", 4, "2024-05-01")]),
    ["acme/tools#4", "acme/docs#31"]
  );
});

test("among merged records, newer comes first", () => {
  assert.deepEqual(order([merged("acme/tools", 4, "2024-05-01"), merged("acme/widgets", 12, "2025-11-11")]), [
    "acme/widgets#12",
    "acme/tools#4",
  ]);
});

test("among non-merged records, newer comes first", () => {
  assert.deepEqual(order([open("acme/widgets", 12, "2024-05-01"), accepted("acme/docs", 31, "2025-11-11")]), [
    "acme/docs#31",
    "acme/widgets#12",
  ]);
});

test("records with the same date fall back to repo name ascending", () => {
  assert.deepEqual(order([open("zeta/tools", 7, "2025-04-04"), accepted("alpha/docs", 19, "2025-04-04")]), [
    "alpha/docs#19",
    "zeta/tools#7",
  ]);
});

test("records with the same date and repo fall back to the lower pull request number first", () => {
  assert.deepEqual(order([merged("acme/tools", 42, "2025-04-04"), merged("acme/tools", 7, "2025-04-04")]), [
    "acme/tools#7",
    "acme/tools#42",
  ]);
});

test("the sort is stable and deterministic", () => {
  const records = [
    merged("acme/tools", 9, "2025-03-03"),
    accepted("acme/docs", 31, "2025-02-02"),
    { ...merged("acme/tools", 9, "2025-03-03"), title: "written first" },
    open("acme/widgets", 12, "2025-05-05"),
    { ...merged("acme/tools", 9, "2025-03-03"), title: "written second" },
    merged("acme/gadgets", 3, "2025-06-06"),
  ];
  const shuffled = [records[4], records[1], records[5], records[0], records[3], records[2]];

  const first = shuffled.slice().sort(compareRecords);
  const second = shuffled.slice().sort(compareRecords);

  assert.equal(first.length, shuffled.length);
  for (let i = 0; i < first.length; i += 1) {
    assert.deepEqual(first[i], second[i], `position ${i} differs between runs`);
  }

  assert.deepEqual(first.map(key), [
    "acme/gadgets#3",
    "acme/tools#9 written second",
    "acme/tools#9",
    "acme/tools#9 written first",
    "acme/widgets#12",
    "acme/docs#31",
  ]);
});
