import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  RotateCw, 
  CheckCircle2, 
  BarChart2, 
  Target, 
  Clock, 
  Calendar, 
  ArrowRight,
  ExternalLink,
  Code
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeModal from '../components/CodeModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    success_rate: 0,
    avg_execution_time_ms: 0,
  });
  const [daily, setDaily] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solvingDaily, setSolvingDaily] = useState(false);
  const [modalData, setModalData] = useState({ isOpen: false, title: '', code: '', language: '' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, dailyRes, historyRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/daily'),
        fetch('/api/history?limit=5'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData || {});
      }
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        setDaily(dailyData || null);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setRecent(Array.isArray(historyData) ? historyData : []);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSolveDaily = async () => {
    setSolvingDaily(true);
    showToast("Starting solver for today's challenge...", 'info');
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python3' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Problem solved! Status: ${data.status || 'Accepted'}`, 'success');
        fetchDashboardData();
      } else {
        showToast(`Solve error: ${data.error || 'Failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setSolvingDaily(false);
    }
  };

  const getDifficultyClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'badge-easy';
    if (d === 'medium') return 'badge-medium';
    if (d === 'hard') return 'badge-hard';
    return '';
  };

  // Safe metric calculations
  const totalSubmissions = Number(stats.total ?? 0);
  const acceptedSubmissions = Number(stats.accepted ?? 0);
  const rawSuccessRate = Number(stats.success_rate ?? stats.successRate ?? 0);
  const displaySuccessRate = isNaN(rawSuccessRate) ? '0.0' : rawSuccessRate.toFixed(1);
  const avgTime = Number(stats.avg_execution_time_ms ?? stats.avg_execution_time ?? stats.avgExecutionTime ?? 0);

  return (
    <div>
      {/* Hero Section */}
      <div className="card" style={{ padding: '36px', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', marginBottom: '8px' }}>
              Autonomous <span className="gradient-text">LeetCode Solver</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px' }}>
              Ultra-lightweight Rust native backend + modern React SPA. Automatically syncs and submits solutions sourced from leading open-source repositories.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleQuickSolveDaily}
              disabled={solvingDaily}
            >
              <Zap size={18} />
              <span>{solvingDaily ? 'Solving in progress...' : "Solve Today's Problem"}</span>
            </button>
            <button className="btn btn-secondary btn-lg" onClick={fetchDashboardData} disabled={loading}>
              <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>TOTAL SUBMISSIONS</span>
            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', color: '#818cf8' }}>
              <BarChart2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{totalSubmissions}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>All recorded attempts</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>ACCEPTED SOLUTIONS</span>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#34d399' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--success)' }}>{acceptedSubmissions}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Verified on LeetCode</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>SUCCESS RATE</span>
            <div style={{ padding: '8px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', color: '#c084fc' }}>
              <Target size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc' }}>{displaySuccessRate}%</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Acceptance ratio</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>AVG PIPELINE TIME</span>
            <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', color: '#fbbf24' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24' }}>
            {avgTime > 0 ? `${avgTime} ms` : 'N/A'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Fetch to submit duration</div>
        </div>
      </div>

      {/* Main 2-column Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Daily Challenge Glance */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} color="#818cf8" />
              <h2>Today's Challenge</h2>
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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                    #{daily.question_frontend_id || daily.frontend_question_id || '---'}
                  </span>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                    {daily.title || daily.question_title || 'LeetCode Challenge'}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0' }}>
                  {(daily.topic_tags || []).map((tag, idx) => {
                    const tagName = typeof tag === 'string' ? tag : (tag?.name || `Tag ${idx}`);
                    return (
                      <span key={tagName + idx} className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {tagName}
                      </span>
                    );
                  })}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Date: <span style={{ color: 'var(--text-primary)' }}>{daily.date || 'Today'}</span>
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/daily')}>
                    <span>Open Challenge & Code</span>
                    <ArrowRight size={14} />
                  </button>
                  {daily.link && (
                    <a href={`https://leetcode.com${daily.link}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      <span>LeetCode</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Loading today's challenge...</p>
            )}
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
              View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Problem</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recent.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.problem_title}</div>
                          <span className={`badge ${getDifficultyClass(item.difficulty)}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                            {item.difficulty}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${item.status === 'Accepted' ? 'badge-success' : 'badge-danger'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="View code"
                            onClick={() =>
                              setModalData({
                                isOpen: true,
                                title: `${item.problem_title} (${item.language || 'Code'})`,
                                code: item.code || item.code_submitted,
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
