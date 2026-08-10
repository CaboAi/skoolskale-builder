/**
 * Standalone per-deliverable HTML page for PDF rendering — TypeScript port
 * of Skool_Skale_DFY cli/export_pdfs.py section_html + the CSS from
 * cli/build_review_html.py (Notion-inspired design system: warm neutrals,
 * whisper borders, Notion Blue accent).
 *
 * Pure module — the Chromium render step (pdf.ts) feeds these pages to
 * page.setContent().
 */
import { escapeHtml, convertMarkdown } from "./markdown-html";
import { countWords, countPlaceholders } from "@/prompts/handover/parse";

const CSS = String.raw`
:root{
  --bg:#ffffff; --bg-alt:#f6f5f4; --bg-sunken:#efeeec;
  --text:rgba(0,0,0,.95); --text-dim:#615d59; --text-muted:#a39e98;
  --border:rgba(0,0,0,.1);
  --accent:#0075de; --accent-active:#005bab; --accent-bg:#f2f9ff;
  --flag:#dd5b00; --flag-bg:#fdf1e8;
  --ok:#1aae39;
  --font:Inter,-apple-system,system-ui,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-mono:Consolas,"SF Mono","Cascadia Mono",monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:var(--bg); color:var(--text); font-family:var(--font); -webkit-print-color-adjust:exact; print-color-adjust:exact;}
a{color:var(--accent); text-decoration:none;}
hr{border:none; border-top:1px solid var(--border); margin:1.6em 0;}
@page{margin:18mm 16mm;}

.spec-strip{
  background:var(--bg-alt); border-bottom:1px solid var(--border);
  display:flex; align-items:center; gap:1.6em; flex-wrap:wrap;
  padding:.9em 1.6em; font-size:13px; color:var(--text-dim);
}
.spec-strip .brand{font-weight:700; font-size:16px; letter-spacing:-.02em; color:var(--text); margin-right:.2em;}
.spec-strip .badge-ph{
  margin-left:auto; background:var(--flag-bg); color:var(--flag);
  border-radius:9999px; padding:.3em .9em; font-weight:600; font-size:12px;
}

.panel{max-width:760px; margin:0 auto; padding:2.6em 2em 3em;}
.panel-head{display:flex; align-items:baseline; gap:.5em; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:.7em; margin-bottom:1.5em;}
.panel-num{font-family:var(--font-mono); color:var(--accent); font-size:14px; font-weight:700;}
.panel-head h2{font-size:26px; font-weight:700; letter-spacing:-.02em; margin:0; flex:1;}
.panel-stats{display:flex; gap:.5em; font-size:11.5px;}
.stat{color:var(--text-dim); background:var(--bg-alt); border:1px solid var(--border); border-radius:4px; padding:.25em .6em;}
.stat-ph{color:var(--flag); background:var(--flag-bg); border-color:var(--flag);}
.stat-clear{color:var(--ok);}

.panel-body{font-size:16px; line-height:1.6;}
.panel-body h3{font-size:19px; font-weight:700; letter-spacing:-.01em; margin:1.8em 0 .6em; padding-left:.6em; border-left:3px solid var(--accent);}
.panel-body h4{font-size:16px; font-weight:600; margin:1.4em 0 .4em; color:var(--text);}
.panel-body p{margin:0 0 1.1em;}
.panel-body p.meta{font-style:italic; color:var(--text-dim); font-size:14px; margin-bottom:1.7em;}
.panel-body ul, .panel-body ol{margin:0 0 1.1em; padding-left:1.4em;}
.panel-body li{margin-bottom:.4em;}
.panel-body blockquote{margin:0 0 1.3em; padding:.8em 1.1em; background:var(--bg-alt); border-left:3px solid var(--border); border-radius:0 8px 8px 0; font-size:14.5px; color:var(--text-dim);}
.table-wrap{overflow-x:auto; margin-bottom:1.3em; border:1px solid var(--border); border-radius:8px;}
table{border-collapse:collapse; width:100%; font-size:14.5px;}
th,td{border-bottom:1px solid var(--border); padding:.6em .8em; text-align:left; vertical-align:top;}
th{background:var(--bg-alt); font-weight:600;}

mark.ph{background:var(--flag-bg); color:var(--flag); border-bottom:1px dashed var(--flag); padding:.05em .2em; border-radius:3px; font-family:var(--font-mono); font-size:.87em; font-weight:600;}
span.stage{font-family:var(--font-mono); font-size:.87em; color:var(--text-muted); font-style:italic;}
code{font-family:var(--font-mono); font-size:.87em; background:var(--bg-alt); border:1px solid var(--border); border-radius:4px; padding:.05em .4em;}
span.cta{display:inline-block; font-size:12.5px; font-weight:600; letter-spacing:.02em; color:var(--accent); border:1px solid var(--border); border-radius:9999px; padding:.2em .8em; margin:.1em .15em; background:var(--accent-bg);}
span.cta-main{display:inline-block; font-size:13.5px; padding:.35em 1em; margin:.4em 0;}
button.inline-link{background:none; border:none; color:var(--accent); text-decoration:underline; font:inherit; padding:0;}
del{color:var(--text-muted);}
li.todo .box, li.done .box{display:inline-block; width:1.1em; height:1.1em; border:1.5px solid var(--border); border-radius:3px; margin-right:.4em; vertical-align:-2px; text-align:center; font-size:.8em; line-height:1.05em;}
li.done .box{background:var(--flag); border-color:var(--flag); color:#fff;}
li.done{color:var(--text-dim);}
`;

/**
 * One self-contained page per deliverable, mirroring export_pdfs.py's
 * section_html: spec strip (community · doc title · counts) over the
 * document body.
 */
export function renderHandoverDocHtml(params: {
  community: string;
  num: string;
  title: string;
  contentMd: string;
}): string {
  const { community, num, title, contentMd } = params;
  const wc = countWords(contentMd);
  const ph = countPlaceholders(contentMd);
  const stat = ph
    ? `<span class="stat stat-ph">${ph} to fill</span>`
    : '<span class="stat stat-clear">no placeholders</span>';
  const bodyHtml = convertMarkdown(contentMd);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(community)} — ${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="spec-strip">
  <span class="brand">${escapeHtml(community)}</span>
  <span>${escapeHtml(title)}</span>
  <span class="badge-ph">${wc.toLocaleString("en-US")} words &middot; ${ph} to fill</span>
</div>
<main>
  <section class="panel">
    <div class="panel-head">
      <span class="panel-num">${num}</span>
      <h2>${escapeHtml(title)}</h2>
      <div class="panel-stats">
        <span class="stat">${wc.toLocaleString("en-US")} words</span>
        ${stat}
      </div>
    </div>
    <div class="panel-body">
      ${bodyHtml}
    </div>
  </section>
</main>
</body>
</html>
`;
}
