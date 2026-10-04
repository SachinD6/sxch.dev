import assert from "node:assert/strict";
import { test } from "node:test";

import { compareRecords } from "./compare.mjs";

const merged = (repo, number, date, stars = 0) => ({ state: "merged", repo, number, date, stars });
const open = (repo, number, date, stars = 0) => ({ state: "open", repo, number, date, stars });
const accepted = (repo, number, date, stars = 0) => ({ state: "accepted", repo, number, date, stars });

const key = (record) => `${record.repo}#${record.number}${record.title ? ` ${record.title}` : ""}`;

const order = (records) => records.slice().sort(compareRecords).map(key);

test("a record with more stars sorts before one with fewer stars, even when the other is newer", () => {
  assert.deepEqual(
    order([open("acme/widgets", 12, "2025-09-09", 4), open("acme/tools", 4, "2024-05-01", 900)]),
    ["acme/tools#4", "acme/widgets#12"]
  );
});

test("a merged record outranks a higher-starred open record", () => {
  assert.deepEqual(
    order([merged("acme/tools", 4, "2024-05-01", 4), open("acme/widgets", 12, "2025-09-09", 1200)]),
    ["acme/tools#4", "acme/widgets#12"]
  );
});

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

test("a merged record outranks an open record at equal stars", () => {
  assert.deepEqual(
    order([open("acme/widgets", 12, "2025-09-09", 300), merged("acme/tools", 4, "2024-05-01", 300)]),
    ["acme/tools#4", "acme/widgets#12"]
  );
});

test("a merged record outranks an accepted record at equal stars", () => {
  assert.deepEqual(
    order([accepted("acme/docs", 31, "2025-09-09", 300), merged("acme/tools", 4, "2024-05-01", 300)]),
    ["acme/tools#4", "acme/docs#31"]
  );
});

test("among merged records, more stars come first even when the other record is newer", () => {
  assert.deepEqual(
    order([merged("acme/tools", 4, "2024-05-01", 300), merged("acme/widgets", 12, "2025-11-11", 900)]),
    ["acme/widgets#12", "acme/tools#4"]
  );
});

test("among non-merged records, more stars come first even when the other record is newer", () => {
  assert.deepEqual(
    order([open("acme/tools", 4, "2024-05-01", 300), accepted("acme/widgets", 12, "2025-11-11", 900)]),
    ["acme/widgets#12", "acme/tools#4"]
  );
});

test("among merged records with equal stars, the recency tiebreak puts the newer record first", () => {
  assert.deepEqual(
    order([merged("acme/tools", 4, "2024-05-01", 300), merged("acme/widgets", 12, "2025-11-11", 300)]),
    ["acme/widgets#12", "acme/tools#4"]
  );
});

test("among non-merged records with equal stars, the recency tiebreak puts the newer record first", () => {
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
    merged("acme/tools", 9, "2025-03-03", 900),
    accepted("acme/docs", 31, "2025-02-02", 40),
    { ...merged("acme/tools", 9, "2025-03-03", 900), title: "written first" },
    merged("acme/widgets", 12, "2025-11-11", 250),
    { ...merged("acme/tools", 9, "2025-03-03", 900), title: "written second" },
    open("acme/gadgets", 3, "2024-01-05", 1200),
  ];
  const shuffled = [records[4], records[1], records[5], records[0], records[3], records[2]];

  const first = shuffled.slice().sort(compareRecords);
  const second = shuffled.slice().sort(compareRecords);

  assert.equal(first.length, shuffled.length);
  for (let i = 0; i < first.length; i += 1) {
    assert.deepEqual(first[i], second[i], `position ${i} differs between runs`);
  }

  assert.deepEqual(first.map(key), [
    "acme/tools#9 written second",
    "acme/tools#9",
    "acme/tools#9 written first",
    "acme/widgets#12",
    "acme/gadgets#3",
    "acme/docs#31",
  ]);
});
