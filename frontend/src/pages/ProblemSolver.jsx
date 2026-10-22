import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Zap, 
  Play,
  FileCode, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  Edit3,
  Eye,
  Check,
  X,
  Terminal,
  Loader2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

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
  const [activeTab, setActiveTab] = useState('code'); // 'code', 'tests', 'problem'
  
  // Test run result state
  const [testResult, setTestResult] = useState(null);
  const [customInput, setCustomInput] = useState('');

  // Submit result state
  const [submitResult, setSubmitResult] = useState(null);

  // Search suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);
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
    setActiveTab('tests');
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
        <h1 style={{ fontSize: '2rem' }}>Problem Solver & Test Runner</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Search by <strong>Problem Number (#1, #42)</strong>, Title, or Slug. Run testcases before official submission.
        </p>
      </div>

      {/* Search & Configuration Card */}
      <div className="card" style={{ marginBottom: '32px' }} ref={searchDropdownRef}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
              <label>Problem Number, Title, Slug, or URL</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1, 42, two-sum, or leetcode.com URL"
                  value={inputSlug}
                  onChange={(e) => setInputSlug(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      handleInspect();
                    }
                  }}
                />
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-dropdown">
                  {suggestions.map((item) => (
                    <div
                      key={item.title_slug}
                      className="search-dropdown-item"
                      onClick={() => {
                        setInputSlug(item.question_frontend_id);
                        handleInspect(item.title_slug);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#818cf8', minWidth: '40px' }}>
                          #{item.question_frontend_id}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Language</label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  if (problemInfo) {
                    // Refetch code for new language
                    fetch(`/api/preview/${problemInfo.title_slug}?lang=${e.target.value}`)
                      .then((r) => r.json())
                      .then((data) => {
                        if (data.code) setCode(data.code);
                        if (data.source) setSource(data.source);
                      });
                  }
                }}
                className="form-select"
                style={{ minWidth: '140px' }}
              >
                <option value="python3">Python 3</option>
                <option value="rust">Rust</option>
                <option value="typescript">TypeScript</option>
                <option value="golang">Go</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '26px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleInspect()}
                disabled={previewing || submitting || testing}
                title="Search and load solution"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{previewing ? 'Loading...' : 'Inspect'}</span>
              </button>
              
              <button
                className="btn btn-secondary"
                style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}
                onClick={handleRunTests}
                disabled={previewing || submitting || testing || !code}
                title="Run testcases on LeetCode without submitting"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{testing ? 'Testing...' : 'Run Tests'}</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={previewing || submitting || testing || !code}
                title="Submit solution to LeetCode"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
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
                    setInputSlug(chip.id);
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

      {/* Main Solver Workspace */}
      {(code || problemInfo || submitResult || testResult) && (
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCode size={20} color="#818cf8" />
                <h2>
                  {problemInfo
                    ? `#${problemInfo.frontend_question_id || problemInfo.question_frontend_id} ${problemInfo.question_title || problemInfo.title}`
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
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                <span>{isEditing ? 'View Mode' : 'Edit Code'}</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                <Copy size={14} />
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <FileCode size={15} />
              <span>Solution Code ({language})</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              <Terminal size={15} />
              <span>Test Cases & Output {testResult ? (testResult.success ? '✅' : '⚠️') : ''}</span>
            </button>
            {problemInfo && problemInfo.content && (
              <button
                className={`tab-btn ${activeTab === 'problem' ? 'active' : ''}`}
                onClick={() => setActiveTab('problem')}
              >
                <Sparkles size={15} />
                <span>Problem Statement</span>
              </button>
            )}
          </div>

          <div className="card-body">
            {/* LeetCode Official Submission Result Banner */}
            {submitResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px',
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
                    <span style={{ color: '#fff' }}>{submitResult.memory}</span> | Time: {submitResult.execution_time_ms}ms
                  </div>
                )}
                {submitResult.error && (
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '4px' }}>
                    {submitResult.error}
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: CODE EDITOR & VIEWER */}
            {activeTab === 'code' && (
              <div>
                {isEditing ? (
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Editing code before test / submit
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>
                        Done Editing
                      </button>
                    </div>
                    <textarea
                      className="code-editor-textarea"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="code-container">
                    <pre>
                      <code>{code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TESTCASES & RUN RESULTS */}
            {activeTab === 'tests' && (
              <div>
                {/* Test Run Execution Result Card */}
                {testResult ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '20px',
                      background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {testResult.success ? (
                          <CheckCircle size={20} color="var(--success)" />
                        ) : (
                          <AlertCircle size={20} color="var(--danger)" />
                        )}
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: testResult.success ? 'var(--success)' : 'var(--danger)' }}>
                          {testResult.status_msg || (testResult.success ? 'Accepted' : 'Failed')}
                        </span>
                      </div>
                      {testResult.total_testcases && (
                        <span className="badge" style={{ background: testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                          {testResult.total_correct} / {testResult.total_testcases} Testcases Passed
                        </span>
                      )}
                    </div>

                    {testResult.runtime && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Runtime: <strong style={{ color: '#fff' }}>{testResult.runtime}</strong> | Memory: <strong style={{ color: '#fff' }}>{testResult.memory}</strong>
                      </div>
                    )}

                    {testResult.compile_error && (
                      <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                        {testResult.compile_error}
                      </div>
                    )}

                    {testResult.runtime_error && (
                      <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                        {testResult.runtime_error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                      Click <strong>"Run Tests"</strong> above to execute this solution against LeetCode testcases.
                    </p>
                  </div>
                )}

                {/* Individual Testcases Breakdown */}
                {testResult && testResult.code_answer && testResult.code_answer.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Testcase Outputs</h3>
                    {testResult.code_answer.map((ans, idx) => {
                      const expected = testResult.expected_code_answer ? testResult.expected_code_answer[idx] : null;
                      const isMatch = expected ? ans === expected : true;
                      const stdout = testResult.std_output_list ? testResult.std_output_list[idx] : null;

                      return (
                        <div key={idx} className={`testcase-item ${isMatch ? 'pass' : 'fail'}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Case {idx + 1}</span>
                            <span className={`badge ${isMatch ? 'badge-easy' : 'badge-hard'}`}>
                              {isMatch ? <Check size={12} style={{ display: 'inline', marginRight: '4px' }} /> : <X size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                              {isMatch ? 'Passed' : 'Mismatch'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>YOUR OUTPUT</div>
                              <pre style={{ background: '#0b0f19', padding: '8px 12px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: isMatch ? '#34d399' : '#f87171' }}>
                                {ans || 'null'}
                              </pre>
                            </div>

                            {expected && (
                              <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>EXPECTED OUTPUT</div>
                                <pre style={{ background: '#0b0f19', padding: '8px 12px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8' }}>
                                  {expected}
                                </pre>
                              </div>
                            )}
                          </div>

                          {stdout && stdout.trim() && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>STDOUT</div>
                              <pre style={{ background: '#05070c', padding: '8px 12px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8' }}>
                                {stdout}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Custom Testcase Input Area */}
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Testcase Input (Sample or Custom)
                  </label>
                  <textarea
                    className="form-input"
                    rows={4}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', resize: 'vertical' }}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter testcase inputs here, each line matching parameter order"
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleRunTests}
                      disabled={testing || !code}
                    >
                      <Play size={13} />
                      <span>{testing ? 'Testing...' : 'Run with this input'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PROBLEM STATEMENT */}
            {activeTab === 'problem' && problemInfo && (
              <div 
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: problemInfo.content || problemInfo.question_content || '<p>No description available.</p>' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
