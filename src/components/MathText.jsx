import React from "react";
import katex from "katex";

function renderKatex(expr, displayMode) {
  try {
    return katex.renderToString(expr, { throwOnError: false, displayMode });
  } catch {
    return null;
  }
}

function renderInline(text, keyPrefix) {
  return text.split(/(\$[^$\n]+\$)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
      const html = renderKatex(part.slice(1, -1), false);
      if (html) {
        return <span key={`${keyPrefix}-${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
      }
    }
    return part;
  });
}

// Renders inline text containing $...$ and $$...$$ LaTeX as typeset maths via KaTeX.
export default function MathText({ text }) {
  const blocks = text.split(/(\$\$[\s\S]+?\$\$)/g);
  return blocks.map((block, i) => {
    if (block.startsWith("$$") && block.endsWith("$$") && block.length > 4) {
      const html = renderKatex(block.slice(2, -2), true);
      if (html) {
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      }
    }
    return <React.Fragment key={i}>{renderInline(block, i)}</React.Fragment>;
  });
}
