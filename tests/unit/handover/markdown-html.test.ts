/**
 * Unit tests for the handover markdown → HTML renderer
 * (src/lib/handover/markdown-html.ts).
 *
 * This module renders generator output, so it falls under the CLAUDE.md
 * 100%-coverage mandate for output renderers/parsers. Expected HTML strings
 * are pre-computed by hand from the regex semantics (which mirror the DFY
 * Python cli/build_review_html.py line-for-line).
 */
import { describe, expect, test } from "vitest";
import {
  convertMarkdown,
  escapeHtml,
  inlineMd,
} from "@/lib/handover/markdown-html";

describe("escapeHtml", () => {
  test("escapes & < > in one pass", () => {
    expect(escapeHtml("a & b <c> & <d>")).toBe(
      "a &amp; b &lt;c&gt; &amp; &lt;d&gt;",
    );
  });

  test("leaves single and double quotes untouched", () => {
    expect(escapeHtml(`say "hi" and 'bye'`)).toBe(`say "hi" and 'bye'`);
  });

  test("passes plain text through unchanged", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});

describe("inlineMd", () => {
  test("[[PLACEHOLDER]] becomes a mark.ph with numeric bracket entities", () => {
    expect(inlineMd("fill [[CREATOR STORY]] here")).toBe(
      'fill <mark class="ph" title="Fill before use">&#91;&#91;CREATOR STORY&#93;&#93;</mark> here',
    );
  });

  test("backtick-wrapped `[[X]]` consumes the backticks and marks the same", () => {
    expect(inlineMd("`[[X]]`")).toBe(
      '<mark class="ph" title="Fill before use">&#91;&#91;X&#93;&#93;</mark>',
    );
  });

  test('**[CTA Button: "Join"]** becomes span.cta-main with the label only', () => {
    expect(inlineMd('**[CTA Button: "Join"]**')).toBe(
      '<span class="cta cta-main">Join</span>',
    );
  });

  test("`[Join Now]` becomes a plain span.cta pill", () => {
    expect(inlineMd("`[Join Now]`")).toBe('<span class="cta">Join Now</span>');
  });

  test("http(s) markdown link renders an <a target=_blank>", () => {
    expect(inlineMd("[Anthropic](https://anthropic.com)")).toBe(
      '<a href="https://anthropic.com" target="_blank" rel="noopener">Anthropic</a>',
    );
  });

  test("known deliverable filename link renders an inline-link button with data-goto", () => {
    expect(inlineMd("[the VSL](01-vsl-and-cancellation.md)")).toBe(
      '<button class="inline-link" data-goto="vsl-cancel">the VSL</button>',
    );
  });

  test("unknown relative href degrades to the bare link text", () => {
    expect(inlineMd("see [notes](notes.md) for more")).toBe(
      "see notes for more",
    );
  });

  test("[stage direction] renders span.stage with &#91;/&#93; entities", () => {
    expect(inlineMd("[pause for effect]")).toBe(
      '<span class="stage">&#91;pause for effect&#93;</span>',
    );
  });

  test("`code` renders a <code> span", () => {
    expect(inlineMd("run `npm test` now")).toBe("run <code>npm test</code> now");
  });

  test("**bold** renders <strong>", () => {
    expect(inlineMd("**bold**")).toBe("<strong>bold</strong>");
  });

  test("_em_ renders <em>", () => {
    expect(inlineMd("a _soft_ word")).toBe("a <em>soft</em> word");
  });

  test("mid-word snake_case is NOT emphasized", () => {
    expect(inlineMd("foo_bar_baz")).toBe("foo_bar_baz");
  });

  test("*em* renders <em>", () => {
    expect(inlineMd("a *glow* word")).toBe("a <em>glow</em> word");
  });

  test("~~del~~ renders <del>", () => {
    expect(inlineMd("~~gone~~")).toBe("<del>gone</del>");
  });

  test("escaping happens before markup: **<b>** keeps the tag inert", () => {
    expect(inlineMd("**<b>**")).toBe("<strong>&lt;b&gt;</strong>");
  });
});

describe("convertMarkdown", () => {
  test("skips the first H1 when it is the first non-blank line", () => {
    expect(convertMarkdown("\n# Title\n\nBody line")).toBe("<p>Body line</p>");
  });

  test("does NOT skip an H1 that is not the first non-blank line", () => {
    expect(convertMarkdown("Intro\n# Title")).toBe(
      "<p>Intro</p>\n<h2>Title</h2>",
    );
  });

  test("only the FIRST H1 is skipped; a later H1 still renders", () => {
    expect(convertMarkdown("# Title\n\n# Another")).toBe("<h2>Another</h2>");
  });

  test("skipFirstH1=false keeps the leading H1", () => {
    expect(convertMarkdown("# Title", false)).toBe("<h2>Title</h2>");
  });

  test("--- renders <hr>", () => {
    expect(convertMarkdown("---")).toBe("<hr>");
  });

  test("--- also terminates a paragraph run", () => {
    expect(convertMarkdown("alpha\n---\nbeta")).toBe(
      "<p>alpha</p>\n<hr>\n<p>beta</p>",
    );
  });

  test("# ## ### map to h2/h3/h4 (level + 1)", () => {
    expect(convertMarkdown("# A\n## B\n### C", false)).toBe(
      "<h2>A</h2>\n<h3>B</h3>\n<h4>C</h4>",
    );
  });

  test("pipe table renders thead/tbody inside .table-wrap", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    expect(convertMarkdown(md)).toBe(
      [
        '<div class="table-wrap"><table>',
        "<thead><tr>",
        "<th>A</th>",
        "<th>B</th>",
        "</tr></thead><tbody>",
        "<tr><td>1</td><td>2</td></tr>",
        "</tbody></table></div>",
      ].join("\n"),
    );
  });

  test("consecutive blockquote lines join into one <blockquote> with spaces", () => {
    expect(convertMarkdown("> one\n> two")).toBe(
      "<blockquote>one two</blockquote>",
    );
  });

  test("unordered list renders <ul> with one <li> per bullet", () => {
    expect(convertMarkdown("- a\n- b")).toBe(
      "<ul>\n<li>a</li>\n<li>b</li>\n</ul>",
    );
  });

  test('ordered list accepts both "1." and "1)" markers', () => {
    expect(convertMarkdown("1. first\n2) second")).toBe(
      "<ol>\n<li>first</li>\n<li>second</li>\n</ol>",
    );
  });

  test("checkbox checklist renders li.todo / li.done inside ul.checklist", () => {
    expect(convertMarkdown("- [ ] open\n- [x] closed")).toBe(
      [
        '<ul class="checklist">',
        '<li class="todo"><span class="box"></span>open</li>',
        '<li class="done"><span class="box">&#10003;</span>closed</li>',
        "</ul>",
      ].join("\n"),
    );
  });

  test("adjacent bullet-then-numbered lines break into separate list groups", () => {
    expect(convertMarkdown("- a\n1. b")).toBe(
      "<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>",
    );
  });

  test("consecutive plain lines merge into one paragraph with <br>", () => {
    expect(convertMarkdown("one\ntwo")).toBe("<p>one<br>two</p>");
  });

  test("single _a · b_ line with exactly two underscores gets class=meta", () => {
    expect(convertMarkdown("_Ada · warm_")).toBe(
      '<p class="meta"><em>Ada · warm</em></p>',
    );
  });

  test("a line with more than two underscores is a plain paragraph", () => {
    expect(convertMarkdown("_a_ then _b_")).toBe(
      "<p><em>a</em> then <em>b</em></p>",
    );
  });

  test("a line starting but not ending with underscore is a plain paragraph", () => {
    expect(convertMarkdown("_dangling")).toBe("<p>_dangling</p>");
  });

  test("paragraph run stops at a following bullet list", () => {
    expect(convertMarkdown("intro line\n- item")).toBe(
      "<p>intro line</p>\n<ul>\n<li>item</li>\n</ul>",
    );
  });

  test("paragraph run stops at a following numbered list", () => {
    expect(convertMarkdown("intro line\n1. item")).toBe(
      "<p>intro line</p>\n<ol>\n<li>item</li>\n</ol>",
    );
  });

  test("paragraph run stops at a following blockquote", () => {
    expect(convertMarkdown("para\n> quoted")).toBe(
      "<p>para</p>\n<blockquote>quoted</blockquote>",
    );
  });

  test("paragraph run stops at a following table", () => {
    expect(convertMarkdown("para\n| A |\n|---|\n| 1 |")).toBe(
      [
        "<p>para</p>",
        '<div class="table-wrap"><table>',
        "<thead><tr>",
        "<th>A</th>",
        "</tr></thead><tbody>",
        "<tr><td>1</td></tr>",
        "</tbody></table></div>",
      ].join("\n"),
    );
  });

  test("empty input renders empty output", () => {
    expect(convertMarkdown("")).toBe("");
  });
});
