import React, { useMemo } from 'react';
import { highlightLine } from '../lib/utils';

export default function CodeBlock({ code, language, maxHeight = 480, showLineNumbers = true }) {
  const lines = useMemo(() => {
    const src = code ?? '';
    return src.split('\n').slice(0, 1200);
  }, [code]);

  return (
    <div className="code-container" style={{ maxHeight }}>
      <div className="code-inner">
        {lines.map((line, i) => (
          <div className="code-line" key={i}>
            {showLineNumbers && (
              <span className="code-ln">{i + 1}</span>
            )}
            <span
              className="code-line-content"
              dangerouslySetInnerHTML={{ __html: highlightLine(line, language) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
