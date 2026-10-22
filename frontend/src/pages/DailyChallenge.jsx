import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  RotateCw, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  FileCode,
  Tag
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function DailyChallenge() {
  const { showToast } = useToast();

  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('python3');
  const [code, setCode] = useState('');
  const [source, setSource] = useState('');
  const [fetchingCode, setFetchingCode] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solveResult, setSolveResult] = useState(null);

  useEffect(() => {
    fetchDailyQuestion();
  }, []);

  const fetchDailyQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily');
      if (res.ok) {
        const data = await res.json();
        setDaily(data);
        const slug = data.title_slug || data.slug;
        if (slug) {
          fetchPreviewCode(slug, language);
        }
      } else {
        showToast("Failed to fetch today's challenge", 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewCode = async (slug, lang) => {
    setFetchingCode(true);
    try {
      const res = await fetch(`/api/preview/${slug}?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setCode(data.code || '// No solution found for this language');
        setSource(data.source || 'GitHub Archive');
      } else {
        setCode('// Failed to preview solution from archive');
      }
    } catch (err) {
      setCode(`// Error fetching solution: ${err.message}`);
    } finally {
      setFetchingCode(false);
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const slug = daily?.title_slug || daily?.slug;
    if (slug) {
      fetchPreviewCode(slug, newLang);
    }
  };

  const handleSolveSubmit = async () => {
    const slug = daily?.title_slug || daily?.slug;
    if (!slug) return;
    setSolving(true);
    setSolveResult(null);
    const title = daily?.title || daily?.question_title || slug;
    showToast(`Submitting ${title} (${language})...`, 'info');

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug,
          lang: language,
        }),
      });

      const data = await res.json();
      setSolveResult(data);

      if (data.success) {
        showToast(`Submission Successful: ${data.status || 'Accepted'}`, 'success');
        if (data.code) {
          setCode(data.code);
        }
      } else {
        showToast(`Solve error: ${data.error || 'Submission failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setSolving(false);
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

  const problemId = daily?.question_frontend_id || daily?.frontend_question_id || '---';
  const problemTitle = daily?.title || daily?.question_title || 'Fetching challenge...';
  const problemContent = daily?.content || daily?.question_content || '<p>No description content available.</p>';
  const problemSlug = daily?.title_slug || daily?.slug;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Today's Daily Challenge</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Synchronized directly with the official LeetCode GraphQL API
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSolveSubmit}
          disabled={solving || loading || !daily}
        >
          <Zap size={18} />
          <span>{solving ? 'Submitting to LeetCode...' : 'Solve & Submit Now'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
        {/* Left Column: Problem Information */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>
                #{problemId}
              </span>
              <h2>{problemTitle}</h2>
            </div>
            {daily && (
              <span className={`badge ${getDifficultyClass(daily.difficulty)}`}>
                {daily.difficulty}
              </span>
            )}
          </div>

          <div className="card-body">
            {daily ? (
              <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    📅 {daily.date || 'Today'}
                  </span>
                  {daily.link ? (
                    <a
                      href={`https://leetcode.com${daily.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <span>View on LeetCode</span>
                      <ExternalLink size={14} />
                    </a>
                  ) : problemSlug ? (
                    <a
                      href={`https://leetcode.com/problems/${problemSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <span>View on LeetCode</span>
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {(daily.topic_tags || []).map((t, idx) => {
                    const tagLabel = typeof t === 'string' ? t : (t?.name || `Tag ${idx}`);
                    return (
                      <span key={tagLabel + idx} className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                        <Tag size={12} style={{ marginRight: '4px' }} />
                        {tagLabel}
                      </span>
                    );
                  })}
                </div>

                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: problemContent }}
                  style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '8px' }}
                />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Loading problem details from LeetCode...</p>
            )}
          </div>
        </div>

        {/* Right Column: Code & Solution Preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileCode size={18} color="#818cf8" />
              <h2>Solution Archive</h2>
            </div>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
              {source || 'doocs/leetcode'}
            </span>
          </div>

          <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Language:
                </label>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="form-select"
                  style={{ maxWidth: '160px', padding: '8px 12px' }}
                >
                  <option value="typescript">TypeScript</option>
                  <option value="python3">Python 3</option>
                  <option value="rust">Rust</option>
                  <option value="golang">Go</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => problemSlug && fetchPreviewCode(problemSlug, language)}
                  disabled={fetchingCode || !daily}
                >
                  <RotateCw size={14} className={fetchingCode ? 'animate-spin' : ''} />
                  <span>Reload</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="code-container" style={{ flex: 1, minHeight: '380px' }}>
              <pre>
                <code>{fetchingCode ? '// Fetching solution from repository...' : code || '// Ready to fetch'}</code>
              </pre>
            </div>

            {/* Submission Result Callout */}
            {solveResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: solveResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${solveResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  {solveResult.success ? (
                    <CheckCircle size={18} color="var(--success)" />
                  ) : (
                    <AlertCircle size={18} color="var(--danger)" />
                  )}
                  <strong style={{ color: solveResult.success ? 'var(--success)' : 'var(--danger)' }}>
                    {solveResult.status || (solveResult.success ? 'Success' : 'Failed')}
                  </strong>
                </div>
                {solveResult.runtime && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Runtime: <span style={{ color: '#fff' }}>{solveResult.runtime}</span> | Memory:{' '}
                    <span style={{ color: '#fff' }}>{solveResult.memory}</span>
                  </div>
                )}
                {solveResult.error && (
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '4px' }}>
                    {solveResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
