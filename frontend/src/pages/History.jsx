import React, { useEffect, useState } from 'react';
import {
  RotateCw,
  Search,
  Code2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Inbox,
  ListFilter,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeModal from '../components/CodeModal';
import EmptyState from '../components/EmptyState';
import { SkeletonTableRows } from '../components/Skeleton';
import { getDifficultyClass, cn } from '../lib/utils';

export default function HistoryPage() {
  const { showToast } = useToast();

  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [diffFilter, setDiffFilter] = useState('ALL');
  const [modalData, setModalData] = useState({ isOpen: false, title: '', code: '', language: '' });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history?limit=100');
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      } else {
        setHistory([]);
        showToast('Failed to load history', 'error');
      }
    } catch (err) {
      setHistory([]);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = (history || []).filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (item.problem_title || '').toLowerCase().includes(q) ||
      (item.problem_slug || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACCEPTED'
          ? item.status === 'Accepted'
          : item.status !== 'Accepted';

    const matchesDiff =
      diffFilter === 'ALL' ? true : (item.difficulty || '').toUpperCase() === diffFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesDiff;
  });

  const acceptedCount = (history || []).filter((i) => i.status === 'Accepted').length;
  const filtersActive = search !== '' || statusFilter !== 'ALL' || diffFilter !== 'ALL';

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Submission Audit & History</h1>
          <p className="page-desc">
            Complete ledger of automated daily runs and manual problem submissions
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchHistory} disabled={loading}>
          <RotateCw size={16} className={cn(loading && 'animate-spin')} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div className="history-filter-grid">
            <div className="input-icon-wrap">
              <span className="input-icon">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Search problem title or slug…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search history"
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              <span className="filter-label">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
                style={{ minWidth: 130, padding: '7px 32px 7px 10px' }}
                aria-label="Filter by status"
              >
                <option value="ALL">All Status</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="FAILED">Failed / Error</option>
              </select>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <span className="filter-label">Difficulty</span>
              <select
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                className="form-select"
                style={{ minWidth: 122, padding: '7px 32px 7px 10px' }}
                aria-label="Filter by difficulty"
              >
                <option value="ALL">All Levels</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          {history && (
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <span className="badge badge-accent">
                <ListFilter size={11} />
                {filteredHistory.length} of {history.length} records
              </span>
              <span className="badge badge-success">{acceptedCount} accepted</span>
              {filtersActive && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.74rem' }}
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setDiffFilter('ALL');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Problem</th>
                <th className="hide-md">Difficulty</th>
                <th className="hide-md">Language</th>
                <th>Status</th>
                <th className="hide-md">Runtime</th>
                <th className="hide-md">Memory</th>
                <th className="hide-sm">Pipeline</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {loading && history === null ? (
                <SkeletonTableRows rows={6} cols={9} />
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={Inbox}
                      title={history?.length ? 'No records match your filters' : 'No submissions recorded yet'}
                      description={
                        history?.length
                          ? 'Try adjusting the search term or clearing the status / difficulty filters.'
                          : 'Solve a problem from the Dashboard or the Solver to populate this ledger.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {item.date}
                    </td>
                    <td>
                      <div className="table-problem-title">
                        <span>{item.problem_title}</span>
                        {item.problem_slug && (
                          <a
                            href={`https://leetcode.com/problems/${item.problem_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open on LeetCode"
                            aria-label={`Open ${item.problem_title} on LeetCode`}
                            style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="hide-md">
                      <span className={cn('badge', getDifficultyClass(item.difficulty))}>
                        {item.difficulty || '—'}
                      </span>
                    </td>
                    <td className="hide-md" style={{ textTransform: 'capitalize', fontSize: '0.84rem' }}>
                      {item.language || 'typescript'}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'status-chip',
                          item.status === 'Accepted'
                            ? 'success'
                            : /simulated/i.test(item.status || '')
                              ? 'warning'
                              : 'danger'
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="hide-md mono">{item.runtime || '—'}</td>
                    <td className="hide-md mono">{item.memory || '—'}</td>
                    <td className="hide-sm" style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {item.execution_time_ms ? `${item.execution_time_ms} ms` : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Inspect submitted code"
                        aria-label={`Inspect code for ${item.problem_title}`}
                        onClick={() =>
                          setModalData({
                            isOpen: true,
                            title: `${item.problem_title} (${item.language || 'Code'})`,
                            code: item.code_submitted,
                            language: item.language,
                          })
                        }
                      >
                        <Code2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CodeModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData({ ...modalData, isOpen: false })}
        title={modalData.title}
        code={modalData.code}
        language={modalData.language}
      />

      <style>{`
        .filter-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 600;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .filter-label { display: none; }
        }
      `}</style>
    </div>
  );
}
