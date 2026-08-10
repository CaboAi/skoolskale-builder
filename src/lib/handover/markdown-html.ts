/**
 * Markdown → HTML converter for handover deliverables — TypeScript port of
 * Skool_Skale_DFY cli/build_review_html.py (esc / inline_md / convert).
 *
 * Deliberately NOT a general markdown library: the dialect includes custom
 * extensions a stock renderer can't express — `[[…]]` placeholder marks,
 * CTA button pills, [stage directions], checkbox checklists — and the docs
 * are generated under our own prompts, so the input surface is bounded.
 * Regex semantics mirror the Python line-for-line.
 *
 * Pure module. 100% coverage mandated (renders generator output).
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Deliverable filenames that inline links may point at (cross-references
 * like "[the docuseries](04-docuseries-full-script.md)"). In the combined
 * review page these became tab-switch buttons; in single-doc PDF pages the
 * button renders inert, which matches the Python export behavior.
 */
const FILE_TO_TAB: Record<string, string> = {
  "00-README.md": "overview",
  "01-vsl-and-cancellation.md": "vsl-cancel",
  "02-pre-launch-emails.md": "pre-launch",
  "03-post-launch-emails.md": "post-launch",
  "04-docuseries-full-script.md": "full-script",
  "05-dm-sequences.md": "dm-sequences",
};

export function inlineMd(input: string): string {
  let s = escapeHtml(input);
  s = s.replace(
    /`?\[\[([^[\]]+)\]\]`?/g,
    '<mark class="ph" title="Fill before use">&#91;&#91;$1&#93;&#93;</mark>',
  );
  s = s.replace(
    /\*\*\[CTA Button:\s*"([^"]+)"\]\*\*/g,
    '<span class="cta cta-main">$1</span>',
  );
  s = s.replace(/`\[([^[\]`]+)\]`/g, '<span class="cta">$1</span>');
  s = s.replace(/\[([^[\]]+)\]\(([^()]+)\)/g, (_m, text: string, href: string) => {
    if (href.startsWith("http")) {
      return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    }
    const tab = FILE_TO_TAB[href];
    if (tab) return `<button class="inline-link" data-goto="${tab}">${text}</button>`;
    return text;
  });
  s = s.replace(/\[([^[\]]{1,160})\]/g, '<span class="stage">&#91;$1&#93;</span>');
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<![\w*])_([^_]+)_(?![\w*])/g, "<em>$1</em>");
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s;
}

const BULLET_RE = /^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)$/;
const NUM_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEAD_RE = /^(#{1,3})\s+(.*)$/;
const BQ_RE = /^>\s?(.*)$/;
const TABLE_ROW_RE = /^\|(.+)\|\s*$/;

type ListItem = { state: string | null; content: string };

function renderListGroup(
  items: ListItem[],
  ordered: boolean,
  checklist: boolean,
): string {
  const tag = ordered ? "ol" : "ul";
  const cls = checklist ? ' class="checklist"' : "";
  const out = [`<${tag}${cls}>`];
  for (const { state, content } of items) {
    const body = inlineMd(content);
    if (state === "x") {
      out.push(`<li class="done"><span class="box">&#10003;</span>${body}</li>`);
    } else if (state === " ") {
      out.push(`<li class="todo"><span class="box"></span>${body}</li>`);
    } else {
      out.push(`<li>${body}</li>`);
    }
  }
  out.push(`</${tag}>`);
  return out.join("\n");
}

function renderTable(rows: string[]): string {
  const [header, , ...body] = rows;
  const headerCells = header
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  const out = ['<div class="table-wrap"><table>', "<thead><tr>"];
  out.push(...headerCells.map((c) => `<th>${inlineMd(c)}</th>`));
  out.push("</tr></thead><tbody>");
  for (const row of body) {
    const cells = row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    out.push(
      "<tr>" + cells.map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>",
    );
  }
  out.push("</tbody></table></div>");
  return out.join("\n");
}

export function convertMarkdown(
  mdText: string,
  skipFirstH1 = true,
): string {
  // Normalize CRLF — generated docs are LF but DB round-trips and Windows
  // tooling can introduce \r, which would otherwise leak into every line.
  let lines = mdText.replace(/\r\n/g, "\n").split("\n");
  if (skipFirstH1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) {
        if (lines[i].trim().startsWith("# ")) lines = lines.slice(i + 1);
        break;
      }
    }
  }
  const out: string[] = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    const stripped = line.trim();
    if (!stripped) {
      i += 1;
      continue;
    }
    if (stripped === "---") {
      out.push("<hr>");
      i += 1;
      continue;
    }
    const head = HEAD_RE.exec(stripped);
    if (head) {
      const level = head[1].length + 1;
      out.push(`<h${level}>${inlineMd(head[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (TABLE_ROW_RE.test(stripped)) {
      const rows: string[] = [];
      while (i < n && TABLE_ROW_RE.test(lines[i].trim())) {
        rows.push(lines[i].trim());
        i += 1;
      }
      out.push(renderTable(rows));
      continue;
    }
    if (BQ_RE.test(stripped)) {
      const buf: string[] = [];
      while (i < n && BQ_RE.test(lines[i].trim())) {
        buf.push(BQ_RE.exec(lines[i].trim())![1]);
        i += 1;
      }
      out.push(`<blockquote>${inlineMd(buf.join(" "))}</blockquote>`);
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    const num = NUM_RE.exec(line);
    if (bullet || num) {
      const ordered = Boolean(num);
      const checklist = Boolean(bullet && bullet[1] !== undefined);
      const items: ListItem[] = [];
      while (i < n) {
        const cur = lines[i];
        const b = BULLET_RE.exec(cur);
        const nn = NUM_RE.exec(cur);
        if ((!ordered && b) || (ordered && nn)) {
          items.push({
            state: b ? (b[1] ?? null) : null,
            content: b ? b[2] : nn![1],
          });
          i += 1;
        } else {
          break;
        }
      }
      out.push(renderListGroup(items, ordered, checklist));
      continue;
    }
    const buf: string[] = [];
    while (
      i < n &&
      lines[i].trim() &&
      lines[i].trim() !== "---" &&
      !HEAD_RE.test(lines[i].trim()) &&
      !BQ_RE.test(lines[i].trim()) &&
      !BULLET_RE.test(lines[i]) &&
      !NUM_RE.test(lines[i]) &&
      !TABLE_ROW_RE.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i += 1;
    }
    const isMeta =
      buf.length === 1 &&
      buf[0].startsWith("_") &&
      buf[0].endsWith("_") &&
      buf[0].split("_").length - 1 === 2;
    const cls = isMeta ? ' class="meta"' : "";
    out.push(`<p${cls}>` + buf.map(inlineMd).join("<br>") + "</p>");
  }
  return out.join("\n");
}
