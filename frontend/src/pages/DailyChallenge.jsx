import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Clock,
  Zap,
  Play,
  Send,
  Edit3,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  TerminalSquare,
  BookOpen,
  Newspaper,
  MessagesSquare,
  History as HistoryIcon,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeBlock from '../components/CodeBlock';
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { cn } from '../lib/utils';

const DESC_TABS = [
  { id: 'description', label: 'Description', icon: BookOpen },
  { id: 'editorial', label: 'Editorial', icon: Newspaper },
  { id: 'solutions', label: 'Solutions', icon: MessagesSquare },
  { id: 'submissions', label: 'Submissions', icon: HistoryIcon },
];

const LANG_OPTIONS = [
  { value: 'python3', label: 'Python 3' },
  { value: 'rust', label: 'Rust' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'golang', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

// Strip LeetCode's <p>&nbsp;</p> spacer paragraphs
const cleanDescription = (html) =>
  (html || '')
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/(?:\s|&nbsp;|<br\s*\/?>)*$/i, '');

const getDiffTextClass = (diff) => {
  const d = (diff || '').toLowerCase();
  if (d === 'easy') return 'd-easy';
  if (d === 'medium') return 'd-medium';
  if (d === 'hard') return 'd-hard';
  return '';
};

export default function DailyChallenge() {
  const { showToast } = useToast();

  const [daily, setDaily] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('python3');
  const [code, setCode] = useState('');
  const [source, setSource] = useState('');
  const [fetchingCode, setFetchingCode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // LeetCode-style console: 'testcase' | 'result' + collapse
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [selectedCase, setSelectedCase] = useState(0);

  // Left-pane tabs
  const [descTab, setDescTab] = useState('description');

  // Test run / submit results
  const [testResult, setTestResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState('');

  // Submission history for the Submissions tab
  const [submissions, setSubmissions] = useState(null);
  const [subsLoading, setSubsLoading] = useState(false);

  // Draggable split
  const [splitPct, setSplitPct] = useState(42);
  const workspaceRef = useRef(null);
  const draggingRef = useRef(false);

  // Ticking clock for the daily-reset countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchDailyQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global drag handlers for the split resizer
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(70, Math.max(25, pct)));
    };
    const stopDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopDrag);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopDrag);
    };
  }, []);

  const startDrag = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const fetchDailyQuestion = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/daily');
      if (res.ok) {
        const data = await res.json();
        setDaily(data);
        setTestResult(null);
        setSubmitResult(null);
        setSubmissions(null);
        setConsoleTab('testcase');
        setDescTab('description');
        const slug = data.title_slug || data.slug;
        if (slug) {
          fetchPreviewCode(slug, language);
          // Prefill sample testcases from the problem endpoint (best effort)
          fetch(`/api/problem/${encodeURIComponent(slug)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((prob) => {
              if (!prob) return;
              if (prob.sample_test_case) {
                setCustomInput(prob.sample_test_case);
              } else if (
                Array.isArray(prob.example_testcase_list) &&
                prob.example_testcase_list.length > 0
              ) {
                setCustomInput(prob.example_testcase_list.join('\n'));
              }
            })
            .catch(() => {});
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

  const fetchSubmissions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await fetch('/api/history?limit=100');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(Array.isArray(data) ? data : []);
      } else {
        setSubmissions([]);
      }
    } catch {
      setSubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (descTab === 'submissions' && submissions === null && daily) {
      fetchSubmissions();
    }
  }, [descTab, submissions, daily, fetchSubmissions]);

  const handleLanguageChange = (e) => {
    const next = e.target.value;
    setLanguage(next);
    const slug = daily?.title_slug || daily?.slug;
    if (slug) {
      fetchPreviewCode(slug, next);
    }
  };

  const handleRunTests = async () => {
    const slug = daily?.title_slug || daily?.slug;
    if (!slug) return;
    setTesting(true);
    setConsoleOpen(true);
    setConsoleTab('result');
    showToast('Testing solution against sample testcases…', 'info');

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_slug: slug,
          language: language,
          code: code,
          data_input: customInput || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      setSelectedCase(0);

      if (res.ok && data.success) {
        showToast(`All Testcases Passed! (${data.total_correct}/${data.total_testcases})`, 'success');
      } else if (res.ok) {
        showToast(`Test Result: ${data.status || data.status_msg}`, 'warning');
      } else {
        showToast(`Test error: ${data.error || 'Failed to run testcases'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSolveSubmit = async () => {
    const slug = daily?.title_slug || daily?.slug;
    if (!slug) return;
    setSubmitting(true);
    setSubmitResult(null);
    setConsoleOpen(true);
    setConsoleTab('result');
    const title = daily?.title || daily?.question_title || slug;
    showToast(`Submitting ${title} (${language})…`, 'info');

    try {
      // Submit the code currently in the editor (archive default, edits included)
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_slug: slug,
          language: language,
          code: code,
        }),
      });

      const data = await res.json();
      setSubmitResult(data);
      setSubmissions(null);

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
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      showToast('Code copied to clipboard', 'success');
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────
  const problemId = daily?.question_frontend_id || daily?.frontend_question_id || '---';
  const problemTitle = daily?.title || daily?.question_title || 'Fetching challenge…';
  const problemContent = daily?.content || daily?.question_content || '';
  const problemSlug = daily?.title_slug || daily?.slug;
  const leetCodeUrl = daily?.link
    ? `https://leetcode.com${daily.link}`
    : problemSlug
      ? `https://leetcode.com/problems/${problemSlug}`
      : null;
  const topics = Array.isArray(daily?.topic_tags)
    ? daily.topic_tags.map((t, i) => (typeof t === 'string' ? t : t?.name || `Tag ${i}`))
    : [];

  const prettyDate = daily?.date
    ? new Date(`${daily.date}T00:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Today';

  // Countdown to the next daily reset (midnight UTC)
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  const resetMs = Math.max(0, nextReset.getTime() - now);
  const resetCountdown = [
    Math.floor(resetMs / 3600000),
    Math.floor((resetMs % 3600000) / 60000),
    Math.floor((resetMs % 60000) / 1000),
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

  const isSimulated = (r) => (r?.status || '').startsWith('Simulated');
  const verdictClass = (r) =>
    r?.success ? (isSimulated(r) ? 'warning' : 'success') : 'error';

  const sourceLabel = source
    ? source.startsWith('http')
      ? source.includes('github')
        ? 'GitHub Archive'
        : 'External'
      : source
    : '';

  const problemSubmissions = (submissions || []).filter((item) => {
    if (problemId !== '---' && String(item.problem_id) === String(problemId)) return true;
    if ((daily?.title || daily?.question_title) && item.problem_title === problemTitle) return true;
    return false;
  });

  const handleViewSubmission = (sub) => {
    if (!sub.code) {
      showToast('No code stored for this submission', 'error');
      return;
    }
    setCode(sub.code);
    setSource(`Submission #${sub.id}`);
    if (sub.language) setLanguage(sub.language);
    showToast(`Loaded submission #${sub.id} into the editor`, 'success');
  };

  const renderTabContent = () => {
    if (descTab === 'description') {
      return (
        <div
          className="lc-desc-body markdown-body"
          dangerouslySetInnerHTML={{
            __html: cleanDescription(problemContent) || '<p>No description available.</p>',
          }}
        />
      );
    }

    if (descTab === 'editorial' || descTab === 'solutions') {
      const isEditorial = descTab === 'editorial';
      return (
        <div className="lc-tab-empty">
          <div className="lc-tab-empty-icon" aria-hidden="true">
            {isEditorial ? <Newspaper size={20} /> : <MessagesSquare size={20} />}
          </div>
          <h3>{isEditorial ? 'Official Editorial' : 'Community Solutions'}</h3>
          <p>
            {isEditorial
              ? 'The official write-up for this problem lives on LeetCode.'
              : 'Browse thousands of community solutions on LeetCode Discuss.'}
          </p>
          {leetCodeUrl && (
            <a className="btn btn-secondary btn-sm" href={leetCodeUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={13} />
              <span>Open on LeetCode</span>
            </a>
          )}
        </div>
      );
    }

    // Submissions tab
    if (subsLoading) {
      return (
        <div className="lc-tab-empty" role="status" aria-live="polite">
          <Loader2 size={18} className="animate-spin" />
          <p>Loading submissions…</p>
        </div>
      );
    }

    if (problemSubmissions.length === 0) {
      return (
        <div className="lc-tab-empty">
          <div className="lc-tab-empty-icon" aria-hidden="true">
            <HistoryIcon size={20} />
          </div>
          <h3>No submissions yet</h3>
          <p>Hit Run to test, or Submit to send today&apos;s solution to LeetCode — results will appear here.</p>
        </div>
      );
    }

    return (
      <div className="lc-subs-list">
        {problemSubmissions.map((sub) => {
          const accepted = sub.status === 'Accepted';
          return (
            <div key={sub.id} className="lc-sub-row">
              <span className={`lc-sub-dot ${accepted ? 'pass' : 'fail'}`} aria-hidden="true" />
              <div className="lc-sub-main">
                <span className={`lc-sub-status ${accepted ? 'pass' : 'fail'}`}>
                  {sub.status || 'Unknown'}
                </span>
                <span className="lc-sub-meta">
                  {sub.language || '—'}
                  {sub.runtime ? ` · ${sub.runtime}` : ''}
                  {sub.memory ? ` · ${sub.memory}` : ''}
                </span>
              </div>
              <div className="lc-sub-side">
                <span className="lc-sub-time" title={sub.date || ''}>
                  <Clock size={12} />
                  {(sub.date || '').slice(0, 10) || '—'}
                </span>
                {sub.code && (
                  <button
                    type="button"
                    className="lc-sub-view"
                    onClick={() => handleViewSubmission(sub)}
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="solver-page daily-page">
      <h1 className="sr-only">Daily Challenge</h1>

      {/* ── Daily toolbar ────────────────────────────────────────────────── */}
      <div className="solver-toolbar daily-toolbar">
        <span className="daily-chip">
          <Calendar size={13} aria-hidden="true" />
          <span>Daily Challenge</span>
        </span>
        <span className="daily-date">{prettyDate}</span>
        <span className="daily-countdown" title="Time until the next daily unlocks (00:00 UTC)">
          <Clock size={13} aria-hidden="true" />
          <span>Resets in {resetCountdown} UTC</span>
        </span>

        <div className="daily-toolbar-actions">
          <button
            type="button"
            className="lc-icon-btn"
            onClick={fetchDailyQuestion}
            disabled={loading}
            title="Refresh daily challenge"
            aria-label="Refresh daily challenge"
          >
            <RotateCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
          {leetCodeUrl && (
            <a
              className="lc-icon-btn"
              href={leetCodeUrl}
              target="_blank"
              rel="noreferrer"
              title="Open on LeetCode"
              aria-label="Open problem on LeetCode"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      {loadError && !daily ? (
        <div className="lc-workspace lc-workspace-empty">
          <EmptyState
            icon={Calendar}
            title="Challenge unavailable"
            description="The LeetCode GraphQL endpoint could not be reached. Check your connection and retry."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDailyQuestion}>
                <RotateCw size={14} />
                <span>Retry</span>
              </button>
            }
          />
        </div>
      ) : (
        <div className="lc-workspace" ref={workspaceRef}>
          {/* LEFT — problem description */}
          <section
            className="lc-pane lc-pane--desc"
            style={{ width: `${splitPct}%` }}
            aria-label="Daily challenge description"
          >
            <header className="lc-desc-head">
              <div className="lc-daily-banner">
                <Zap size={13} aria-hidden="true" />
                <span>Today&apos;s Challenge</span>
                <span className="lc-daily-banner-date">{prettyDate}</span>
              </div>

              <div className="lc-desc-title-row">
                <h2 className="lc-problem-title">
                  {problemId}. {problemTitle}
                </h2>
                {daily && (
                  <span className={`lc-diff ${getDiffTextClass(daily.difficulty)}`}>
                    {daily.difficulty || '—'}
                  </span>
                )}
                {leetCodeUrl && (
                  <a
                    className="lc-ext-link"
                    href={leetCodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on LeetCode"
                    aria-label="Open problem on LeetCode"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              <div className="lc-desc-tabs" role="tablist" aria-label="Problem views">
                {DESC_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = descTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`lc-desc-tab${active ? ' active' : ''}`}
                      onClick={() => setDescTab(tab.id)}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </header>

            <div className="lc-desc-scroll">
              {loading && !daily ? (
                <div style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
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
              ) : (
                renderTabContent()
              )}
            </div>

            {descTab === 'description' && topics.length > 0 && (
              <footer className="lc-desc-topics">
                <div className="lc-tag-row">
                  {topics.map((tag) => (
                    <span key={tag} className="lc-tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </footer>
            )}
          </section>

          {/* Draggable divider */}
          <div
            className="lc-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panes"
            onMouseDown={startDrag}
          >
            <span className="lc-resizer-grip" aria-hidden="true" />
          </div>

          {/* RIGHT — code workspace */}
          <section className="lc-pane lc-pane--code" aria-label="Solution workspace">
            <div className="lc-editorbar">
              <select
                className="lc-lang-select"
                value={language}
                onChange={handleLanguageChange}
                disabled={fetchingCode}
                aria-label="Solution language"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>

              {sourceLabel && (
                <span className="badge badge-plain lc-source-badge" title={source}>
                  {sourceLabel}
                </span>
              )}

              <div className="lc-editorbar-actions">
                {isEditing && <span className="lc-editing-chip">Editing</span>}
                <button
                  type="button"
                  className="lc-icon-btn"
                  onClick={() => setIsEditing((v) => !v)}
                  aria-pressed={isEditing}
                  title={isEditing ? 'Switch to view mode' : 'Edit code'}
                  disabled={!code}
                >
                  {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                </button>
                <button
                  type="button"
                  className="lc-icon-btn"
                  onClick={handleCopyCode}
                  title="Copy code"
                  aria-label="Copy code"
                  disabled={!code}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>

                {/* LeetCode-style Run | Submit group */}
                <div className="lc-run-group" role="group" aria-label="Run and submit">
                  <button
                    type="button"
                    className="lc-run-btn"
                    onClick={handleRunTests}
                    disabled={loading || submitting || testing || !code}
                    title="Run testcases on LeetCode without submitting"
                  >
                    {testing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} aria-hidden="true" />
                    )}
                    <span>{testing ? 'Running…' : 'Run'}</span>
                  </button>
                  <span className="lc-run-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="lc-run-btn lc-run-btn--submit"
                    onClick={handleSolveSubmit}
                    disabled={loading || submitting || testing || !code}
                    title="Submit solution to LeetCode"
                  >
                    {submitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} aria-hidden="true" />
                    )}
                    <span>{submitting ? 'Judging…' : 'Submit'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={`lc-editor-wrap${isEditing ? ' editing' : ''}`}>
              {fetchingCode ? (
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} width={`${88 - (i % 4) * 14}%`} height={11} />
                  ))}
                </div>
              ) : code ? (
                isEditing ? (
                  <textarea
                    className="code-editor-textarea"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                    aria-label="Solution code editor"
                  />
                ) : (
                  <CodeBlock code={code} language={language} maxHeight="none" showLineNumbers />
                )
              ) : (
                <div className="lc-editor-empty">
                  <p>No archived solution for this language yet.</p>
                  <p>Try another language or reload from the archive.</p>
                </div>
              )}
            </div>

            <div className={`lc-console${consoleOpen ? '' : ' collapsed'}`}>
              <div className="lc-console-bar">
                <div className="lc-console-tabs" role="tablist" aria-label="Console panels">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleTab === 'testcase'}
                    className={`lc-console-tab${consoleTab === 'testcase' ? ' active' : ''}`}
                    onClick={() => {
                      setConsoleTab('testcase');
                      setConsoleOpen(true);
                    }}
                  >
                    <TerminalSquare size={14} aria-hidden="true" />
                    <span>Testcase</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleTab === 'result'}
                    className={`lc-console-tab${consoleTab === 'result' ? ' active' : ''}`}
                    onClick={() => {
                      setConsoleTab('result');
                      setConsoleOpen(true);
                    }}
                  >
                    <span>Result</span>
                    {(testing || submitting) && (
                      <Loader2 size={12} className="animate-spin lc-tab-spin" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  className="lc-icon-btn lc-console-toggle"
                  onClick={() => setConsoleOpen((v) => !v)}
                  aria-expanded={consoleOpen}
                  title={consoleOpen ? 'Collapse console' : 'Expand console'}
                  aria-label={consoleOpen ? 'Collapse console' : 'Expand console'}
                >
                  <ChevronDown
                    size={15}
                    style={{ transform: consoleOpen ? 'none' : 'rotate(180deg)' }}
                  />
                </button>
              </div>

              {consoleOpen && (
                <div className="lc-console-body">
                  {consoleTab === 'testcase' ? (
                    <div>
                      <textarea
                        className="lc-testcase-input"
                        rows={4}
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder={'nums = [2,7,11,15]\ntarget = 9'}
                        aria-label="Testcase input"
                      />
                      <p className="lc-testcase-hint">
                        One line per argument, in parameter order. Samples are pre-filled when the
                        challenge loads.
                      </p>
                    </div>
                  ) : (
                    <div className="lc-result-view">
                      {/* Judging in progress */}
                      {(testing || submitting) && (
                        <div className="lc-pending" role="status" aria-live="polite">
                          <Loader2 size={15} className="animate-spin" />
                          <span>Judging…</span>
                        </div>
                      )}

                      {/* Idle placeholder */}
                      {!testing && !submitting && !submitResult && !testResult && (
                        <p className="lc-result-placeholder">
                          Press <span className="lc-kbd">Run</span> to test against the sample
                          cases, or <span className="lc-kbd">Submit</span> for the official
                          LeetCode verdict.
                        </p>
                      )}

                      {/* Official submission verdict */}
                      {!submitting && submitResult && (
                        <div className="lc-submission">
                          <div className={`lc-verdict ${verdictClass(submitResult)}`}>
                            {submitResult.success ? (
                              <CheckCircle size={16} />
                            ) : (
                              <AlertCircle size={16} />
                            )}
                            <span>
                              {submitResult.status ||
                                (submitResult.success ? 'Accepted' : 'Submission Failed')}
                            </span>
                          </div>

                          {(submitResult.runtime || submitResult.memory) && (
                            <div className="lc-verdict-metrics">
                              {submitResult.runtime && (
                                <span className="result-metric">
                                  Runtime <strong>{submitResult.runtime}</strong>
                                </span>
                              )}
                              {submitResult.memory && (
                                <span className="result-metric">
                                  Memory <strong>{submitResult.memory}</strong>
                                </span>
                              )}
                              <span className="result-metric">
                                Pipeline <strong>{submitResult.execution_time_ms} ms</strong>
                              </span>
                            </div>
                          )}

                          {submitResult.error &&
                            (isSimulated(submitResult) ? (
                              <p className="lc-sim-note">{submitResult.error}</p>
                            ) : (
                              <pre className="result-error">{submitResult.error}</pre>
                            ))}
                        </div>
                      )}

                      {/* Test run results */}
                      {!testing && testResult && (
                        <div className="lc-testrun">
                          <div className={`lc-verdict ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success ? (
                              <CheckCircle size={16} />
                            ) : (
                              <AlertCircle size={16} />
                            )}
                            <span>
                              {testResult.status_msg ||
                                testResult.status ||
                                (testResult.success ? 'Accepted' : 'Failed')}
                            </span>
                          </div>

                          {testResult.total_testcases ? (
                            <p className="lc-cases-count">
                              <strong>{testResult.total_correct}</strong> /{' '}
                              {testResult.total_testcases} cases passed
                            </p>
                          ) : null}

                          {testResult.compile_error && (
                            <pre className="result-error">{testResult.compile_error}</pre>
                          )}
                          {testResult.runtime_error && (
                            <pre className="result-error">{testResult.runtime_error}</pre>
                          )}

                          {Array.isArray(testResult.code_answer) &&
                            testResult.code_answer.length > 0 && (
                              <>
                                {customInput && customInput.trim() && (
                                  <div className="lc-io-section">
                                    <div className="io-label">Input</div>
                                    <pre className="io-block">{customInput}</pre>
                                  </div>
                                )}

                                <div
                                  className="lc-case-chips"
                                  role="tablist"
                                  aria-label="Test cases"
                                >
                                  {testResult.code_answer.map((ans, idx) => {
                                    const expected = testResult.expected_code_answer
                                      ? testResult.expected_code_answer[idx]
                                      : null;
                                    const isMatch = expected ? ans === expected : true;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        role="tab"
                                        aria-selected={selectedCase === idx}
                                        className={`lc-case-chip${selectedCase === idx ? ' active' : ''}`}
                                        onClick={() => setSelectedCase(idx)}
                                      >
                                        <span
                                          className={`chip-dot ${isMatch ? 'pass' : 'fail'}`}
                                          aria-hidden="true"
                                        />
                                        Case {idx + 1}
                                      </button>
                                    );
                                  })}
                                </div>

                                {(() => {
                                  const idx = Math.min(
                                    selectedCase,
                                    testResult.code_answer.length - 1
                                  );
                                  const ans = testResult.code_answer[idx];
                                  const expected = testResult.expected_code_answer
                                    ? testResult.expected_code_answer[idx]
                                    : null;
                                  const isMatch = expected ? ans === expected : true;
                                  const stdout = testResult.std_output_list
                                    ? testResult.std_output_list[idx]
                                    : null;

                                  return (
                                    <div>
                                      <div className="lc-io-grid">
                                        <div>
                                          <div className="io-label">Your output</div>
                                          <pre className={`io-block ${isMatch ? 'pass' : 'fail'}`}>
                                            {ans || 'null'}
                                          </pre>
                                        </div>
                                        {expected && (
                                          <div>
                                            <div className="io-label">Expected</div>
                                            <pre className="io-block expected">{expected}</pre>
                                          </div>
                                        )}
                                      </div>

                                      {stdout && stdout.trim() ? (
                                        <div className="lc-io-section">
                                          <div className="io-label">Stdout</div>
                                          <pre className="io-block stdout">{stdout}</pre>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
