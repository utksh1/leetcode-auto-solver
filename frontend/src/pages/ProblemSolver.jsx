import React, { useState } from 'react';
import { 
  Search, 
  Zap, 
  FileCode, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ProblemSolver() {
  const { showToast } = useToast();

  const [inputSlug, setInputSlug] = useState('');
  const [language, setLanguage] = useState('python3');
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problemInfo, setProblemInfo] = useState(null);
  const [code, setCode] = useState('');
  const [source, setSource] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const popularChips = [
    { title: 'Two Sum', slug: 'two-sum' },
    { title: 'Valid Parentheses', slug: 'valid-parentheses' },
    { title: 'LRU Cache', slug: 'lru-cache' },
    { title: 'Trapping Rain Water', slug: 'trapping-rain-water' },
    { title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists' },
    { title: 'Min Ops to Sort Permutation', slug: 'minimum-operations-to-sort-a-permutation' },
  ];

  // Helper to extract clean slug from input or URL
  const cleanSlug = (input) => {
    let s = input.trim();
    if (s.includes('leetcode.com/problems/')) {
      const match = s.match(/leetcode\.com\/problems\/([^/?#]+)/);
      if (match && match[1]) {
        s = match[1];
      }
    }
    return s.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  };

  const handleInspect = async (slugToUse = null) => {
    const slug = cleanSlug(slugToUse || inputSlug);
    if (!slug) {
      showToast('Please enter a problem slug or URL', 'error');
      return;
    }

    setPreviewing(true);
    setSubmitResult(null);
    showToast(`Inspecting solution for "${slug}"...`, 'info');

    try {
      // 1. Fetch problem metadata from API
      const probRes = await fetch(`/api/problem/${slug}`);
      if (probRes.ok) {
        const probData = await probRes.json();
        setProblemInfo(probData);
      }

      // 2. Fetch code from GitHub archive
      const prevRes = await fetch(`/api/preview/${slug}?lang=${language}`);
      if (prevRes.ok) {
        const prevData = await prevRes.json();
        setCode(prevData.code || '// No solution found in repository');
        setSource(prevData.source || 'GitHub Archive');
        showToast('Solution loaded from GitHub archive', 'success');
      } else {
        setCode('// Failed to find solution in GitHub archive');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    const slug = cleanSlug(inputSlug);
    if (!slug) {
      showToast('Please enter a problem slug or URL', 'error');
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    showToast(`Submitting "${slug}" to LeetCode...`, 'info');

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_slug: slug,
          language: language,
        }),
      });

      const data = await res.json();
      setSubmitResult(data);

      if (data.success) {
        showToast(`LeetCode Result: ${data.status || 'Accepted'}`, 'success');
        if (data.code_submitted) {
          setCode(data.code_submitted);
        }
      } else {
        showToast(`Submission failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard', 'success');
  };

  const getDifficultyClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'badge-easy';
    if (d === 'medium') return 'badge-medium';
    if (d === 'hard') return 'badge-hard';
    return '';
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem' }}>Custom Problem Solver</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Search, fetch solutions, and submit any of the 3,500+ LeetCode problems directly
        </p>
      </div>

      {/* Search & Configuration Card */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Problem Slug or Full LeetCode URL</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. two-sum, trapping-rain-water, or paste full URL"
                  value={inputSlug}
                  onChange={(e) => setInputSlug(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="form-select"
                style={{ minWidth: '150px' }}
              >
                <option value="typescript">TypeScript</option>
                <option value="python3">Python 3</option>
                <option value="rust">Rust</option>
                <option value="golang">Go</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '26px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleInspect()}
                disabled={previewing || submitting}
              >
                <Search size={16} />
                <span>{previewing ? 'Inspecting...' : 'Inspect'}</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={previewing || submitting}
              >
                <Zap size={16} />
                <span>{submitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </div>

          {/* Quick Problem Suggestion Chips */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={14} color="#818cf8" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>POPULAR PROBLEMS</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {popularChips.map((chip) => (
                <button
                  key={chip.slug}
                  className="btn btn-ghost btn-sm"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                  }}
                  onClick={() => {
                    setInputSlug(chip.slug);
                    handleInspect(chip.slug);
                  }}
                >
                  {chip.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results View */}
      {(code || problemInfo || submitResult) && (
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCode size={20} color="#818cf8" />
                <h2>
                  {problemInfo
                    ? `#${problemInfo.frontend_question_id} ${problemInfo.question_title}`
                    : inputSlug}
                </h2>
                {problemInfo && (
                  <span className={`badge ${getDifficultyClass(problemInfo.difficulty)}`}>
                    {problemInfo.difficulty}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {source && (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {source}
                </span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                <Copy size={14} />
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div className="card-body">
            {submitResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  background: submitResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${submitResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  {submitResult.success ? (
                    <CheckCircle size={18} color="var(--success)" />
                  ) : (
                    <AlertCircle size={18} color="var(--danger)" />
                  )}
                  <strong style={{ color: submitResult.success ? 'var(--success)' : 'var(--danger)' }}>
                    Submission Status: {submitResult.status || (submitResult.success ? 'Success' : 'Failed')}
                  </strong>
                </div>
                {submitResult.runtime && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Runtime: <span style={{ color: '#fff' }}>{submitResult.runtime}</span> | Memory:{' '}
                    <span style={{ color: '#fff' }}>{submitResult.memory}</span>
                  </div>
                )}
                {submitResult.error && (
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '4px' }}>
                    {submitResult.error}
                  </div>
                )}
              </div>
            )}

            <div className="code-container">
              <pre>
                <code>{code}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
