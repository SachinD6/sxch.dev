export function compareRecords(a, b) {
  return (
    (a.state === "merged" ? 0 : 1) - (b.state === "merged" ? 0 : 1) ||
    b.date.localeCompare(a.date) ||
    a.repo.localeCompare(b.repo) ||
    a.number - b.number
  );
}
