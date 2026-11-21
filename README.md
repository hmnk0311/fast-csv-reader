# fast-csv-reader

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hmnk0311/fast-csv-reader/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hmnk0311/fast-csv-reader/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: `solve.js` exports
`run(input)`, which returns csv-reader's exact answer
(`{columns, rows, errors}`) for every `{text, header}` input, under the
same broken-row policy — BOM dropped, blank lines are no record, stray
CRs outside quotes, quoted fields with doubled quotes and CR/CRLF read
as LF, junk after a closing quote appended, an unterminated quote
re-read as unquoted text, and rows padded or cut to the first record's
width with every error recorded in the order met.

csv-reader builds each field one character at a time, with a string
concatenation per character. This reader walks each field once and
takes every run of ordinary characters as a single slice, which is
where the speed comes from. On the kit's practice set its parsing runs
about five times faster than the reference reader's.

## Run it

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=<dir holding cases.json> MAKEFUN_OUTPUT_DIR=out node main.ts
cat out/answers.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
