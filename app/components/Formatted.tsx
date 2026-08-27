import { Fragment } from 'react';

/**
 * AIの回答を読みやすく整形する軽量レンダラ。
 * 【見出し】・箇条書き・引用・**強調** のみを扱い、外部のMarkdownライブラリは使わない。
 */

function inline(text: string, keyPrefix: string) {
  // **強調** と 「引用」 を軽く装飾する。
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>;
  });
}

export default function Formatted({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, index) => {
        const key = `l${index}`;
        const trimmed = line.trim();

        if (!trimmed) return <div key={key} style={{ height: 8 }} />;

        if (/^【.+】/.test(trimmed) || /^#{1,4}\s+/.test(trimmed)) {
          return (
            <div key={key} className="fmt-h">
              {trimmed.replace(/^#{1,4}\s+/, '')}
            </div>
          );
        }

        if (/^[・•]/.test(trimmed) || /^[-*]\s+/.test(trimmed)) {
          return (
            <div key={key} className="fmt-li">
              ・{inline(trimmed.replace(/^[・•]\s*/, '').replace(/^[-*]\s+/, ''), key)}
            </div>
          );
        }

        if (/^\d+[.)]\s+/.test(trimmed)) {
          return (
            <div key={key} className="fmt-li">
              {inline(trimmed, key)}
            </div>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <div key={key} className="fmt-quote">
              {inline(trimmed.slice(1).trim(), key)}
            </div>
          );
        }

        return <div key={key}>{inline(line, key)}</div>;
      })}
    </>
  );
}
