import React, { useEffect, useState } from 'react';
import { 
  RotateCw, 
  Search, 
  Filter, 
  Code, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  ExternalLink 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeModal from '../components/CodeModal';

export default function HistoryPage() {
  const { showToast } = useToast();

  const [history, setHistory] = useState([]);
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
        setHistory(data);
      } else {
        showToast('Failed to load history', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'badge-easy';
    if (d === 'medium') return 'badge-medium';
    if (d === 'hard') return 'badge-hard';
    return '';
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      (item.problem_title || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.problem_slug || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACCEPTED'
        ? item.status === 'Accepted'
        : item.status !== 'Accepted';

    const matchesDiff =
      diffFilter === 'ALL'
        ? true
        : (item.difficulty || '').toUpperCase() === diffFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesDiff;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Submission Audit & History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Complete ledger of automated daily runs and manual problem submissions
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchHistory} disabled={loading}>
          <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search problem title or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
                style={{ minWidth: '130px', padding: '8px 12px' }}
              >
                <option value="ALL">All Status</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="FAILED">Failed / Error</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Difficulty:</span>
              <select
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                className="form-select"
                style={{ minWidth: '130px', padding: '8px 12px' }}
              >
                <option value="ALL">All Levels</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Problem</th>
                  <th>Difficulty</th>
                  <th>Language</th>
                  <th>Status</th>
                  <th>Runtime</th>
                  <th>Memory</th>
                  <th>Pipeline</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      {loading ? 'Loading records...' : 'No submission records match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{item.id}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{item.date}</td>
                      <td>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.problem_title}</span>
                          {item.problem_slug && (
                            <a
                              href={`https://leetcode.com/problems/${item.problem_slug}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getDifficultyClass(item.difficulty)}`}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                        {item.language || 'typescript'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === 'Accepted' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {item.status === 'Accepted' ? (
                            <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                          ) : (
                            <XCircle size={12} style={{ marginRight: '4px' }} />
                          )}
                          {item.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{item.runtime || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{item.memory || '-'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {item.execution_time_ms ? `${item.execution_time_ms} ms` : '-'}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Inspect submitted code"
                          onClick={() =>
                            setModalData({
                              isOpen: true,
                              title: `${item.problem_title} (${item.language || 'Code'})`,
                              code: item.code_submitted,
                              language: item.language,
                            })
                          }
                        >
                          <Code size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CodeModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData({ ...modalData, isOpen: false })}
        title={modalData.title}
        code={modalData.code}
        language={modalData.language}
      />
    </div>
  );
}
