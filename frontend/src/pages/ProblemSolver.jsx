import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  Copy,
  CheckCircle,
  AlertCircle,
  Edit3,
  Eye,
  Loader2,
  ExternalLink,
  Code2,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeBlock from '../components/CodeBlock';

export default function ProblemSolver() {
  const { showToast } = useToast();

  const [inputSlug, setInputSlug] = useState('');
  const [language, setLanguage] = useState('python3');
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problemInfo, setProblemInfo] = useState(null);
  const [code, setCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [source, setSource] = useState('');

  // LeetCode-style console: 'testcase' | 'result'
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [selectedCase, setSelectedCase] = useState(0);

  // Test run result state
  const [testResult, setTestResult] = useState(null);
  const [customInput, setCustomInput] = useState('');

  // Submit result state
  const [submitResult, setSubmitResult] = useState(null);

  // Search suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimeoutRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const searchDropdownRef = useRef(null);

  const popularChips = [
    { title: '#1 Two Sum', id: '1', slug: 'two-sum' },
    { title: '#20 Valid Parentheses', id: '20', slug: 'valid-parentheses' },
    { title: '#42 Trapping Rain Water', id: '42', slug: 'trapping-rain-water' },
    { title: '#146 LRU Cache', id: '146', slug: 'lru-cache' },
    { title: '#23 Merge k Sorted Lists', id: '23', slug: 'merge-k-sorted-lists' },
    { title: '#3942 Min Ops Permutation', id: '3942', slug: 'minimum-operations-to-sort-a-permutation' },
  ];

  // Helper to extract clean slug or number from input or URL
  const cleanInput = (input) => {
    let s = input.trim();
    if (s.includes('leetcode.com/problems/')) {
      const match = s.match(/leetcode\.com\/problems\/([^/?#]+)/);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    // If it's a number like "#1" or "1"
    if (s.startsWith('#')) {
      s = s.slice(1).trim();
    }
    return s;
  };

  // Real-time search suggestions debouncer
  useEffect(() => {
    const q = inputSlug.trim();
    if (!q || q.length < 1 || q.includes('leetcode.com/')) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setSuggestions(list);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }
      } catch {
        // silent fail for suggestions
      }
    }, 250);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [inputSlug]);

  // Click outside to close search suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInspect = async (target = null) => {
    setShowSuggestions(false);
    const identifier = cleanInput(target || inputSlug);
    if (!identifier) {
      showToast('Please enter a problem number, slug, or URL', 'error');
      return;
    }

    setPreviewing(true);
    setSubmitResult(null);
    setTestResult(null);
    setSelectedCase(0);
    setConsoleTab('testcase');
    setIsEditing(false);
    showToast(`Loading problem #${identifier}...`, 'info');

    try {
      // 1. Fetch problem metadata from API (supports number and slug)
      const probRes = await fetch(`/api/problem/${encodeURIComponent(identifier)}`);
      let loadedSlug = identifier;
      if (probRes.ok) {
        const probData = await probRes.json();
        setProblemInfo(probData);
        loadedSlug = probData.title_slug;
        if (probData.sample_test_case) {
          setCustomInput(probData.sample_test_case);
        } else if (probData.example_testcase_list && probData.example_testcase_list.length > 0) {
          setCustomInput(probData.example_testcase_list.join('\n'));
        }
      }

      // 2. Fetch code from GitHub archive
      const prevRes = await fetch(`/api/preview/${encodeURIComponent(loadedSlug)}?lang=${language}`);
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

  const handleRunTests = async () => {
    const identifier = problemInfo ? problemInfo.title_slug : cleanInput(inputSlug);
    if (!identifier) {
      showToast('Please load a problem first', 'error');
      return;
    }

    setTesting(true);
    setConsoleTab('result');
    showToast(`Testing solution against example testcases...`, 'info');

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_slug: identifier,
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

  const handleSubmit = async () => {
    const identifier = problemInfo ? problemInfo.title_slug : cleanInput(inputSlug);
    if (!identifier) {
      showToast('Please load a problem first', 'error');
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    setConsoleTab('result');
    showToast(`Submitting to LeetCode...`, 'info');

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_slug: identifier,
          language: language,
          code: code,
        }),
      });

      const data = await res.json();
      setSubmitResult(data);

      if (data.success) {
        showToast(`LeetCode Result: ${data.status || 'Accepted'}`, 'success');
        if (data.code) {
          setCode(data.code);
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

  const handleLanguageChange = (e) => {
    const next = e.target.value;
    setLanguage(next);
    if (problemInfo) {
      // Refetch code for the new language
      fetch(`/api/preview/${problemInfo.title_slug}?lang=${next}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.code) setCode(data.code);
          if (data.source) setSource(data.source);
        })
        .catch(() => {
          /* keep current code on refetch failure */
        });
    }
  };

  const getDifficultyClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'badge-easy';
    if (d === 'medium') return 'badge-medium';
    if (d === 'hard') return 'badge-hard';
    return '';
  };

  const getDiffTextClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'd-easy';
    if (d === 'medium') return 'd-medium';
    if (d === 'hard') return 'd-hard';
    return '';
  };

  const isSimulated = (r) => (r?.status || '').startsWith('Simulated');
  const verdictClass = (r) =>
    r?.success ? (isSimulated(r) ? 'warning' : 'success') : 'error';

  // Prettify solution source (raw URLs → friendly label)
  const sourceLabel = source
    ? source.startsWith('http')
      ? source.includes('github')
        ? 'GitHub Archive'
        : 'External'
      : source
    : '';

  // LeetCode HTML injects <p>&nbsp;</p> spacer paragraphs that waste vertical
  // space in the description pane — strip them (and any blank <p><br></p>).
  const cleanDescription = (html) =>
    (html || '')
      .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
      .replace(/(?:\s|&nbsp;|<br\s*\/?>)*$/i, '');

  const hasWorkspace = Boolean(code || problemInfo || submitResult || testResult);
  const problemId = problemInfo
    ? problemInfo.frontend_question_id || problemInfo.question_frontend_id
    : null;
  const problemTitle = problemInfo
    ? problemInfo.question_title || problemInfo.title
    : null;
  const problemUrl = problemInfo
    ? `https://leetcode.com/problems/${problemInfo.title_slug}/`
    : null;
  const topics = Array.isArray(problemInfo?.topic_tags) ? problemInfo.topic_tags : [];

  return (
    <div className="solver-page">
      <h1 className="sr-only">Problem Solver</h1>

      {/* ── Problem picker toolbar ───────────────────────────────────────── */}
      <div className="solver-toolbar" ref={searchDropdownRef}>
        <div className="solver-toolbar-search">
          <Search size={15} className="solver-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="form-input solver-search-input"
            placeholder="Search problems — 1, two-sum, or a leetcode.com URL"
            aria-label="Search problems by number, title, slug, or URL"
            value={inputSlug}
            onChange={(e) => setInputSlug(e.target.value)}
            onFocus={() => {
              clearTimeout(blurTimeoutRef.current);
              setSearchFocused(true);
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => {
              // Delay so suggestion clicks (mousedown → blur → click) still land
              blurTimeoutRef.current = setTimeout(() => setSearchFocused(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                handleInspect();
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
          />

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && searchFocused && (
            <div className="search-dropdown" role="listbox" aria-label="Problem suggestions">
              {suggestions.map((item) => (
                <div
                  key={item.title_slug}
                  className="search-dropdown-item"
                  role="option"
                  aria-selected="false"
                  tabIndex={0}
                  onClick={() => {
                    setInputSlug(item.question_frontend_id);
                    handleInspect(item.title_slug);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInputSlug(item.question_frontend_id);
                      handleInspect(item.title_slug);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span className="search-id">#{item.question_frontend_id}</span>
                    <span
                      className="search-title"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span className={`badge ${getDifficultyClass(item.difficulty)}`} style={{ fontSize: '0.75rem' }}>
                    {item.difficulty}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary solver-load-btn"
          onClick={() => handleInspect()}
          disabled={previewing || submitting || testing}
        >
          {previewing ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
          <span>{previewing ? 'Loading…' : 'Load'}</span>
        </button>
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      {hasWorkspace ? (
        <div className="lc-split">
          {/* LEFT — problem description */}
          <section className="lc-pane lc-pane--desc" aria-label="Problem description">
            {problemInfo ? (
              <>
                <header className="lc-desc-head">
                  <div className="lc-desc-title-row">
                    <h2 className="lc-problem-title">
                      {problemId}. {problemTitle}
                    </h2>
                    <span className={`lc-diff ${getDiffTextClass(problemInfo.difficulty)}`}>
                      {problemInfo.difficulty}
                    </span>
                    <a
                      className="lc-ext-link"
                      href={problemUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open on LeetCode"
                      aria-label="Open problem on LeetCode"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </header>

                <div
                  className="lc-desc-body markdown-body"
                  dangerouslySetInnerHTML={{
                    __html:
                      cleanDescription(problemInfo.content || problemInfo.question_content) ||
                      '<p>No description available.</p>',
                  }}
                />

                {topics.length > 0 && (
                  <footer className="lc-desc-topics">
                    <span className="lc-topics-label">Related Topics</span>
                    <div className="lc-tag-row">
                      {topics.map((tag) => (
                        <span key={tag} className="lc-tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </footer>
                )}
              </>
            ) : (
              <div className="lc-desc-placeholder">
                <p>Problem description unavailable — the solution archive was loaded instead.</p>
              </div>
            )}
          </section>

          {/* RIGHT — code workspace */}
          <section className="lc-pane lc-pane--code" aria-label="Solution workspace">
            <div className="lc-editorbar">
              <select
                className="lc-lang-select"
                value={language}
                onChange={handleLanguageChange}
                aria-label="Solution language"
              >
                <option value="python3">Python 3</option>
                <option value="rust">Rust</option>
                <option value="typescript">TypeScript</option>
                <option value="golang">Go</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
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
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className={`lc-editor-wrap${isEditing ? ' editing' : ''}`}>
              {isEditing ? (
                <textarea
                  className="code-editor-textarea"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  aria-label="Solution code editor"
                />
              ) : (
                <CodeBlock code={code} language={language} maxHeight="none" showLineNumbers />
              )}
            </div>

            <div className="lc-console">
              <div className="lc-console-bar">
                <div className="lc-console-tabs" role="tablist" aria-label="Console panels">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleTab === 'testcase'}
                    className={`lc-console-tab${consoleTab === 'testcase' ? ' active' : ''}`}
                    onClick={() => setConsoleTab('testcase')}
                  >
                    Testcase
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleTab === 'result'}
                    className={`lc-console-tab${consoleTab === 'result' ? ' active' : ''}`}
                    onClick={() => setConsoleTab('result')}
                  >
                    Result
                    {(testing || submitting) && (
                      <Loader2 size={12} className="animate-spin lc-tab-spin" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div className="lc-console-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleRunTests}
                    disabled={previewing || submitting || testing || !code}
                    title="Run testcases on LeetCode without submitting"
                  >
                    {testing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>{testing ? 'Running…' : 'Run'}</span>
                  </button>

                  <button
                    className="btn btn-submit btn-sm"
                    onClick={handleSubmit}
                    disabled={previewing || submitting || testing || !code}
                    title="Submit solution to LeetCode"
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    <span>{submitting ? 'Judging…' : 'Submit'}</span>
                  </button>
                </div>
              </div>

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
                      One line per argument, in parameter order. Samples are pre-filled when a
                      problem loads.
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
                        Press <span className="lc-kbd">Run</span> to test against the sample cases,
                        or <span className="lc-kbd">Submit</span> for the official LeetCode verdict.
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
                          {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                          <span>
                            {testResult.status_msg ||
                              testResult.status ||
                              (testResult.success ? 'Accepted' : 'Failed')}
                          </span>
                        </div>

                        {testResult.total_testcases ? (
                          <p className="lc-cases-count">
                            <strong>{testResult.total_correct}</strong> / {testResult.total_testcases}{' '}
                            cases passed
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
            </div>
          </section>
        </div>
      ) : (
        /* Empty state — nothing loaded yet */
        <div className="lc-split lc-split-empty">
          <div className="lc-empty">
            <div className="lc-empty-icon" aria-hidden="true">
              <Code2 size={22} />
            </div>
            <h2>Load a problem to get started</h2>
            <p>
              Search by problem number (<strong>#1</strong>, <strong>#42</strong>), title, slug, or
              paste a leetcode.com URL — then run testcases and submit, right from here.
            </p>
            <div className="lc-empty-chips">
              {popularChips.map((chip) => (
                <button
                  key={chip.slug}
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setInputSlug(chip.id);
                    handleInspect(chip.slug);
                  }}
                >
                  {chip.title}
                </button>
              ))}
            </div>
            <p className="lc-empty-hint">
              Press <span className="lc-kbd">Enter</span> in the search box to load
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
