import React, { useEffect, useState } from 'react';
import {
  Zap,
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  FileCode2,
  Tag,
  ListChecks,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeBlock from '../components/CodeBlock';
import LanguageTabs from '../components/LanguageTabs';
import ResultPanel from '../components/ResultPanel';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { getDifficultyClass, copyToClipboard, cn } from '../lib/utils';

export default function DailyChallenge() {
  const { showToast } = useToast();

  const [daily, setDaily] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('python3');
  const [code, setCode] = useState('');
  const [source, setSource] = useState('');
  const [fetchingCode, setFetchingCode] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solveResult, setSolveResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDailyQuestion();
  }, []);

  const fetchDailyQuestion = async () => {
    setLoading(true);
    setLoadError(false);
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
        setLoadError(true);
        showToast("Failed to fetch today's challenge", 'error');
      }
    } catch (err) {
      setLoadError(true);
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
        setCode(data.code || '');
        setSource(data.source || 'GitHub Archive');
      } else {
        setCode('');
        showToast('No solution found in the archive for this language', 'error');
      }
    } catch (err) {
      setCode('');
      showToast(`Error fetching solution: ${err.message}`, 'error');
    } finally {
      setFetchingCode(false);
    }
  };

  const handleLanguageChange = (newLang) => {
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
    showToast(`Submitting ${title} (${language})…`, 'info');

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, lang: language }),
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

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      showToast('Code copied to clipboard', 'success');
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  const problemId = daily?.question_frontend_id || daily?.frontend_question_id || '---';
  const problemTitle = daily?.title || daily?.question_title || 'Fetching challenge…';
  const problemContent =
    daily?.content || daily?.question_content || '<p>No description content available.</p>';
  const problemSlug = daily?.title_slug || daily?.slug;
  const leetCodeUrl = daily?.link
    ? `https://leetcode.com${daily.link}`
    : problemSlug
      ? `https://leetcode.com/problems/${problemSlug}`
      : null;

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Today's Daily Challenge</h1>
          <p className="page-desc">Synchronized live with the official LeetCode GraphQL API</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleSolveSubmit}
          disabled={solving || loading || !daily}
        >
          <Zap size={18} />
          <span>{solving ? 'Submitting to LeetCode…' : 'Solve & Submit Now'}</span>
        </button>
      </div>

      <div className="grid-2-wide">
        {/* Left: problem statement */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="mono" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>
                #{problemId}
              </span>
              <h2 style={{ overflowWrap: 'anywhere', textTransform: 'none', letterSpacing: 0, fontSize: '15px' }}>{problemTitle}</h2>
            </div>
            {daily && (
              <span className={cn('badge', getDifficultyClass(daily.difficulty))}>
                {daily.difficulty || '—'}
              </span>
            )}
          </div>

          <div className="card-body">
            {loading && !daily ? (
              <div>
                <div className="row" style={{ marginBottom: 20 }}>
                  <Skeleton width={110} height={26} radius={999} />
                  <Skeleton width={130} height={30} radius={8} />
                </div>
                <div className="row" style={{ marginBottom: 24 }}>
                  <Skeleton width={64} height={24} radius={999} />
                  <Skeleton width={82} height={24} radius={999} />
                  <Skeleton width={56} height={24} radius={999} />
                </div>
                <Skeleton width="96%" height={12} />
                <div style={{ height: 12 }} />
                <Skeleton width="88%" height={12} />
                <div style={{ height: 12 }} />
                <Skeleton width="92%" height={12} />
                <div style={{ height: 12 }} />
                <Skeleton width="60%" height={12} />
              </div>
            ) : daily ? (
              <div>
                <div className="row" style={{ marginBottom: 18 }}>
                  <span className="badge badge-plain">
                    <Calendar size={12} />
                    {daily.date || 'Today'}
                  </span>
                  {leetCodeUrl && (
                    <a
                      href={leetCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <span>View on LeetCode</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {(daily.topic_tags || []).length > 0 && (
                  <div className="row" style={{ marginBottom: 22 }}>
                    {daily.topic_tags.map((t, idx) => {
                      const tagLabel = typeof t === 'string' ? t : t?.name || `Tag ${idx}`;
                      return (
                        <span key={tagLabel + idx} className="tag-chip">
                          <Tag size={11} />
                          {tagLabel}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div
                  className="markdown-body scroll-area"
                  dangerouslySetInnerHTML={{ __html: problemContent }}
                />
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="Challenge unavailable"
                description={
                  loadError
                    ? 'The LeetCode GraphQL endpoint could not be reached. Check your connection and retry.'
                    : 'No daily challenge data available right now.'
                }
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDailyQuestion}>
                    <RotateCw size={14} />
                    <span>Retry</span>
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Right: solution preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">
                <FileCode2 size={18} />
              </span>
              <h2>Solution Archive</h2>
            </div>
            {source && <span className="badge badge-plain">{source}</span>}
          </div>

          <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="row-between">
              <LanguageTabs value={language} onChange={handleLanguageChange} disabled={fetchingCode} />
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => problemSlug && fetchPreviewCode(problemSlug, language)}
                  disabled={fetchingCode || !daily}
                  title="Reload solution from archive"
                >
                  <RotateCw size={14} className={cn(fetchingCode && 'animate-spin')} />
                  <span>Reload</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyCode}
                  disabled={!code}
                  title="Copy code to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {fetchingCode ? (
              <div className="code-container" style={{ minHeight: 380 }}>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} width={`${88 - (i % 4) * 14}%`} height={11} />
                  ))}
                </div>
              </div>
            ) : code ? (
              <CodeBlock code={code} language={language} maxHeight={440} />
            ) : (
              <EmptyState
                icon={ListChecks}
                title="No solution loaded"
                description={
                  daily
                    ? 'No archived solution found for this language yet. Pick another language or reload.'
                    : 'Load the daily challenge first, then preview solutions here.'
                }
              />
            )}

            <ResultPanel result={solveResult} />
          </div>
        </div>
      </div>
    </div>
  );
}
