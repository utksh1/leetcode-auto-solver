import React from 'react';
import { CheckCircle2, XCircle, Timer, MemoryStick, Gauge } from 'lucide-react';

/**
 * Shared submission-result panel.
 * Works with the payloads returned by POST /api/solve and POST /api/test.
 */
export default function ResultPanel({ result, pipelineMs }) {
  if (!result) return null;

  const success = Boolean(result.success);
  const status = result.status || (success ? 'Success' : 'Failed');

  return (
    <div className={`result-panel ${success ? 'success' : 'error'}`} role="status">
      <div className="result-head">
        {success ? (
          <CheckCircle2 size={19} color="var(--success-text)" />
        ) : (
          <XCircle size={19} color="var(--danger-text)" />
        )}
        <span className="result-title">{status}</span>
      </div>

      {(result.runtime || result.memory || pipelineMs) && (
        <div className="result-metrics">
          {result.runtime && (
            <span className="result-metric">
              <Timer size={14} />
              Runtime <strong>{result.runtime}</strong>
            </span>
          )}
          {result.memory && (
            <span className="result-metric">
              <MemoryStick size={14} />
              Memory <strong>{result.memory}</strong>
            </span>
          )}
          {pipelineMs != null && (
            <span className="result-metric">
              <Gauge size={14} />
              Pipeline <strong>{pipelineMs} ms</strong>
            </span>
          )}
        </div>
      )}

      {result.error && (
        <div className="result-error">{String(result.error)}</div>
      )}
    </div>
  );
}
