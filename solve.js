// A fast drop-in replacement for csv-reader 1.0.0.
//
// It returns exactly csv-reader's answer for every input {text, header}:
// {columns, rows, errors} under csv-reader's broken-row policy (BOM drop,
// blank lines are no record, stray CRs outside quotes, quoted fields with
// doubled quotes and CR/CRLF read as LF, junk after a closing quote, an
// unterminated quote re-read as unquoted text, rows padded or cut to the
// first record's width, and every error as {code, line, row} in the order
// met).
//
// Where csv-reader builds each field one character at a time (a string
// concatenation per character), this reader walks each field once and
// takes every run of ordinary characters as a single slice, so a field
// costs one pass and one slice instead of a concatenation per
// character. Nothing is kept between calls.

const COMMA_END = 0;
const BREAK_END = 1;
const TEXT_END = 2;

export function run(input) {
  const text = typeof input.text === 'string' ? input.text : String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  // The field the reader functions just produced.
  let fValue = '';
  let fEnded = TEXT_END;
  let fAdded = 0;

  function fail(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters starting at pos, on top of `initial`, up to
  // the next comma or line break. A CR not followed by LF is dropped and
  // recorded as stray_cr. Sets fValue, fEnded and fAdded (the number of
  // characters this call kept, not counting `initial`).
  //
  // The scan walks the field once, character by character: fields are
  // short, so one pass over their own characters beats searching ahead
  // for each of the three characters that could end them. The value is
  // still taken as slices, never built a character at a time.
  function readUnquoted(initial) {
    let parts = null;
    let segStart = pos;
    let added = 0;
    let i = pos;
    for (;;) {
      if (i >= len) {
        pos = len;
        fAdded = added + (len - segStart);
        if (parts === null) {
          fValue = initial + text.slice(segStart, len);
        } else {
          parts.push(text.slice(segStart, len));
          fValue = parts.join('');
        }
        fEnded = TEXT_END;
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 44 || c === 10 || c === 13) {
        if (c === 13 && text.charCodeAt(i + 1) !== 10) {
          // A lone CR outside quotes: dropped, and the field goes on.
          fail('stray_cr');
          if (parts === null) parts = [initial];
          parts.push(text.slice(segStart, i));
          added += i - segStart;
          i += 1;
          pos = i;
          segStart = i;
          continue;
        }
        fAdded = added + (i - segStart);
        if (parts === null) {
          fValue = initial + text.slice(segStart, i);
        } else {
          parts.push(text.slice(segStart, i));
          fValue = parts.join('');
        }
        if (c === 44) {
          pos = i + 1;
          fEnded = COMMA_END;
        } else if (c === 10) {
          pos = i + 1;
          line += 1;
          fEnded = BREAK_END;
        } else {
          // A CR with an LF after it: a CRLF line break.
          pos = i + 2;
          line += 1;
          fEnded = BREAK_END;
        }
        return;
      }
      i += 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Like
  // readUnquoted, it walks the field once and slices out the runs
  // between the characters that matter.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let segStart = pos;
    let parts = null;
    let i = pos;
    for (;;) {
      if (i >= len) {
        // The quote never closes: it is a literal character, and the
        // text after it is read again as an unquoted field.
        fail('unterminated_quote');
        pos = open + 1;
        line = openLine;
        readUnquoted('"');
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 10) {
        // An LF inside quotes is kept as it stands and counts a line.
        line += 1;
        i += 1;
        continue;
      }
      if (c === 13) {
        // A CRLF or a lone CR inside quotes is read as one LF.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        segStart = i;
        continue;
      }
      if (c === 34) {
        if (text.charCodeAt(i + 1) === 34) {
          // A doubled quote inside the field is one quote.
          if (parts === null) parts = [];
          parts.push(text.slice(segStart, i), '"');
          i += 2;
          segStart = i;
          continue;
        }
        // The closing quote.
        let value;
        if (parts === null) {
          value = text.slice(segStart, i);
        } else {
          parts.push(text.slice(segStart, i));
          value = parts.join('');
        }
        pos = i + 1;
        if (pos >= len) { fValue = value; fEnded = TEXT_END; return; }
        const after = text.charCodeAt(pos);
        if (after === 44) { pos += 1; fValue = value; fEnded = COMMA_END; return; }
        if (after === 10) { pos += 1; line += 1; fValue = value; fEnded = BREAK_END; return; }
        if (after === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          fValue = value;
          fEnded = BREAK_END;
          return;
        }
        // Whatever follows the closing quote, up to the next comma or
        // line break, is appended as it stands.
        readUnquoted(value);
        if (fAdded > 0) fail('quote_junk');
        return;
      }
      i += 1;
    }
  }

  for (;;) {
    // Lines left with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        readQuoted();
      } else {
        quoted = false;
        readUnquoted('');
      }
      fields.push(fValue);
    } while (fEnded === COMMA_END);

    // A line that held only stray CRs is left with no characters: no
    // record (the stray_cr errors it produced stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
