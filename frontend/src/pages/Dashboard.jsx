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
  Code2,
  Activity,
  Inbox,
  Timer,
  Flame,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeModal from '../components/CodeModal';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonTableRows } from '../components/Skeleton';
import { getDifficultyClass, cn } from '../lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState(null);
  const [recent, setRecent] = useState(null);
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
        setStats((await statsRes.json()) || {});
      }
      if (dailyRes.ok) {
        setDaily((await dailyRes.json()) || null);
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
    showToast("Starting solver for today's challenge…", 'info');
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

  // Safe metric calculations
  const totalSubmissions = Number(stats?.total ?? 0);
  const acceptedSubmissions = Number(stats?.accepted ?? 0);
  const rawSuccessRate = Number(stats?.success_rate ?? stats?.successRate ?? 0);
  const displaySuccessRate = Number.isNaN(rawSuccessRate) ? '0.0' : rawSuccessRate.toFixed(1);
  const avgTime = Number(
    stats?.avg_execution_time_ms ?? stats?.avg_execution_time ?? stats?.avgExecutionTime ?? 0
  );

  const dailySlug = daily?.title_slug || daily?.slug;

  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="hero-card" aria-labelledby="hero-title">
        <div className="hero-content">
          <div>
            <h1 id="hero-title" className="hero-title">
              Autonomous <span className="gradient-text">LeetCode Solver</span>
            </h1>
            <p className="hero-sub">
              Ultra-lightweight Rust-native backend with a modern React control center. Solutions
              are synced from leading open-source archives and submitted to LeetCode
              automatically — every day, on schedule.
            </p>
            <div className="hero-stats-inline">
              <span className="hero-chip">
                <Flame size={13} /> Daily cron 10:00 UTC
              </span>
              <span className="hero-chip">
                <Zap size={13} /> 3,500+ problems covered
              </span>
              <span className="hero-chip">
                <Timer size={13} /> &lt; 15 MB memory
              </span>
            </div>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleQuickSolveDaily}
              disabled={solvingDaily}
            >
              <Zap size={18} />
              <span>{solvingDaily ? 'Solving in progress…' : "Solve Today's Problem"}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={fetchDashboardData}
              disabled={loading}
            >
              <RotateCw size={18} className={cn(loading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="stats-grid" aria-label="Performance metrics">
        <StatCard
          label="Total Submissions"
          value={loading ? '—' : totalSubmissions}
          sub="All recorded attempts"
          icon={BarChart2}
          accent="violet"
        />
        <StatCard
          label="Accepted Solutions"
          value={loading ? '—' : acceptedSubmissions}
          sub="Verified on LeetCode"
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          label="Success Rate"
          value={loading ? '—' : `${displaySuccessRate}%`}
          sub="Acceptance ratio"
          icon={Target}
          accent="purple"
          progress={Number(displaySuccessRate)}
        />
        <StatCard
          label="Avg Pipeline Time"
          value={loading ? '—' : avgTime > 0 ? `${avgTime} ms` : 'N/A'}
          sub="Fetch to submit duration"
          icon={Clock}
          accent="amber"
        />
      </section>

      {/* Main two-column grid */}
      <div className="grid-2-wide">
        {/* Daily challenge glance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">
                <Calendar size={18} />
              </span>
              <h2>Today's Challenge</h2>
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
                <div className="row" style={{ marginBottom: 16 }}>
                  <Skeleton width={52} height={26} radius={8} />
                  <Skeleton width="60%" height={26} />
                </div>
                <div className="row" style={{ marginBottom: 22 }}>
                  <Skeleton width={70} height={24} radius={999} />
                  <Skeleton width={90} height={24} radius={999} />
                  <Skeleton width={60} height={24} radius={999} />
                </div>
                <Skeleton width="100%" height={12} />
                <div style={{ height: 10 }} />
                <Skeleton width="82%" height={12} />
              </div>
            ) : daily ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span className="mono" style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>
                    #{daily.question_frontend_id || daily.frontend_question_id || '---'}
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{daily.title || daily.question_title || 'LeetCode Challenge'}</h3>
                </div>

                <div className="row" style={{ margin: '14px 0 18px' }}>
                  {(daily.topic_tags || []).map((tag, idx) => {
                    const tagName = typeof tag === 'string' ? tag : tag?.name || `Tag ${idx}`;
                    return (
                      <span key={tagName + idx} className="tag-chip">
                        {tagName}
                      </span>
                    );
                  })}
                </div>

                <p style={{ fontSize: '0.86rem', marginBottom: 18 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Scheduled for </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {daily.date || 'today'}
                  </span>
                </p>

                <div className="row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/daily')}>
                    <span>Open Challenge & Code</span>
                    <ArrowRight size={14} />
                  </button>
                  {(daily.link || dailySlug) && (
                    <a
                      href={`https://leetcode.com${daily.link || `/problems/${dailySlug}`}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <span>View on LeetCode</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="Challenge unavailable"
                description="Could not load today's challenge. The LeetCode GraphQL endpoint may be unreachable — try refreshing."
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDashboardData}>
                    <RotateCw size={14} />
                    <span>Retry</span>
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">
                <Activity size={18} />
              </span>
              <h2>Recent Activity</h2>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
              View all
            </button>
          </div>
          <div style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Problem</th>
                    <th>Status</th>
                    <th className="hide-sm">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recent === null ? (
                    <SkeletonTableRows rows={4} cols={4} />
                  ) : !recent || recent.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          icon={Inbox}
                          title="No submissions yet"
                          description="Run the solver to record your first automated submission."
                          action={
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={handleQuickSolveDaily}
                              disabled={solvingDaily}
                            >
                              <Zap size={14} />
                              <span>Solve today's problem</span>
                            </button>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    recent.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {item.date}
                        </td>
                        <td>
                          <div className="table-problem-title">
                            <span>{item.problem_title}</span>
                            {item.difficulty && (
                              <span
                                className={cn('badge', getDifficultyClass(item.difficulty))}
                                style={{ fontSize: '0.62rem', padding: '1px 7px' }}
                              >
                                {item.difficulty}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={cn(
                              'badge',
                              item.status === 'Accepted' ? 'badge-success' : 'badge-danger'
                            )}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="hide-sm">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            title="View submitted code"
                            aria-label={`View code for ${item.problem_title}`}
                            onClick={() =>
                              setModalData({
                                isOpen: true,
                                title: `${item.problem_title} (${item.language || 'Code'})`,
                                code: item.code || item.code_submitted,
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
