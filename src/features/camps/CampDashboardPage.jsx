import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { DateRangeFilters } from './components/DateRangeFilters';
import { ChartPanel, HierarchyCard, StatWidget } from './components/DashboardWidgets';
import { dashboardApi } from './campOpsApi.js';
import { getDefaultMonthDateRange } from './utils/dateRange';

function buildClientMastersLink({ tab = 'clients', search } = {}) {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (search) params.set('search', search);
  const query = params.toString();
  return `/camps/client-masters${query ? `?${query}` : ''}`;
}

function buildCampsLink({
  status,
  overdue,
  reactionRequired,
  offHours,
  weekendAttention,
  dateFrom,
  dateTo,
  client,
  campaign,
  campaignType,
} = {}) {
  const params = new URLSearchParams();
  if (reactionRequired) params.set('reactionRequired', '1');
  else if (offHours) params.set('offHours', '1');
  else if (weekendAttention) params.set('weekendAttention', '1');
  else if (overdue) params.set('overdue', '1');
  else if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (client) params.set('client', client);
  if (campaign) params.set('campaign', campaign);
  if (campaignType) params.set('campaignType', campaignType);
  const query = params.toString();
  return `/camps/manage${query ? `?${query}` : ''}`;
}

const statusCards = [
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'executed', label: 'Executed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'overdue_not_executed', label: 'Overdue', overdue: true },
];

const alertCards = [
  {
    key: 'reaction_required',
    label: 'Reaction Required',
    subtitle: 'Pending 6+ working hours',
    reactionRequired: true,
    cardClass: 'alert-card-reaction',
  },
  {
    key: 'off_hours_pending',
    label: 'Off-Hours Submissions',
    subtitle: 'Submitted outside 8 AM – 8 PM',
    offHours: true,
    cardClass: 'alert-card-off-hours',
  },
  {
    key: 'weekend_attention_pending',
    label: 'Weekend / Late Saturday',
    subtitle: 'Needs extra employee follow-up',
    weekendAttention: true,
    cardClass: 'alert-card-weekend',
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showCharts = false } = useOutletContext() || {};
  const defaults = getDefaultMonthDateRange();
  const [stats, setStats] = useState(null);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [appliedRange, setAppliedRange] = useState(defaults);
  const [error, setError] = useState('');

  async function loadStats(range = appliedRange) {
    try {
      const { data } = await dashboardApi.stats(range);
      setStats(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard');
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  function applyRange(range) {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setAppliedRange(range);
    loadStats(range);
  }

  function applyDateRange() {
    applyRange({ dateFrom, dateTo });
  }

  function clearDateRange() {
    applyRange({ dateFrom: '', dateTo: '' });
  }

  const linkParams = {
    dateFrom: appliedRange.dateFrom || undefined,
    dateTo: appliedRange.dateTo || undefined,
  };

  if (error && !stats) return <div className="error-banner">{error}</div>;
  if (!stats) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <>
      <div className="dashboard-toolbar">
        <div className="dashboard-filter-panel panel">
          <DateRangeFilters
            idPrefix="dashboard-date"
            dateFrom={dateFrom}
            dateTo={dateTo}
            appliedFrom={appliedRange.dateFrom}
            appliedTo={appliedRange.dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onApply={applyDateRange}
            onQuickSelect={applyRange}
            onClear={clearDateRange}
            showClear={Boolean(appliedRange.dateFrom || appliedRange.dateTo)}
          />
        </div>
      </div>

      {error && (
        <div className="page-alerts">
          <div className="error-banner">{error}</div>
        </div>
      )}

      <div className="dashboard-hierarchy-note">
        Brand → Campaign / Division → Camp
      </div>

      <div className="dashboard-camps-panel panel">
        <div className="dashboard-camps-header">
          <div>
            <p className="panel-subtitle">Camps in selected date range</p>
            <h3>Total Camps</h3>
          </div>
          <StatWidget
            label="All camps"
            value={stats.camps.total}
            onClick={() => navigate(buildCampsLink(linkParams))}
            compact
          />
        </div>
        <div className="grid-status-cards">
          {statusCards.map(({ key, label, overdue }) => (
            <StatWidget
              key={key}
              label={label}
              value={stats.camps.byStatus[key] || 0}
              onClick={() => navigate(
                buildCampsLink({
                  ...linkParams,
                  status: overdue ? undefined : key,
                  overdue,
                })
              )}
              compact
            />
          ))}
        </div>
      </div>

      <div className="dashboard-alerts-panel panel">
        <div className="dashboard-alerts-header">
          <div>
            <p className="panel-subtitle">Working hours: 8 AM – 8 PM (Mon – Sat)</p>
            <h3>Campaign Reaction Alerts</h3>
          </div>
          <div className="alert-legend">
            <span className="alert-legend-item alert-legend-reaction">Reaction required</span>
            <span className="alert-legend-item alert-legend-weekend">Weekend / late Sat</span>
            <span className="alert-legend-item alert-legend-off-hours">Off-hours</span>
          </div>
        </div>
        <div className="grid-alert-cards">
          {alertCards.map(({ key, label, subtitle, reactionRequired, offHours, weekendAttention, cardClass }) => (
            <button
              key={key}
              type="button"
              className={`widget-card widget-card-clickable alert-widget-card ${cardClass}`}
              onClick={() => navigate(buildCampsLink({
                ...linkParams,
                reactionRequired,
                offHours,
                weekendAttention,
              }))}
            >
              <span>{label}</span>
              <small>{subtitle}</small>
              <strong>{stats.camps.alerts[key] || 0}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="grid-hierarchy-cards">
        <HierarchyCard
          title="Brands"
          // subtitle="Clients e.g. Sun Pharma"
          total={stats.hierarchy.brands.total}
          items={stats.hierarchy.brands.items}
          onTotalClick={() => navigate(buildClientMastersLink())}
          onItemClick={(item) => navigate(buildClientMastersLink({ search: item.label }))}
        />
        <HierarchyCard
          title="Campaigns / Divisions"
          // subtitle="e.g. Classic, Premium"
          total={stats.hierarchy.campaigns.total}
          items={stats.hierarchy.campaigns.items}
          onTotalClick={() => navigate(buildCampsLink(linkParams))}
          onItemClick={(item) => navigate(buildCampsLink({ ...linkParams, campaign: item.id }))}
        />
      </div>

      {showCharts && (
        <div className="charts-grid">
          <ChartPanel title="Camps by Brand" data={stats.charts.byClient} />
          <ChartPanel title="Camps by State" data={stats.charts.byState} />
          <ChartPanel title="Camps by Camp Type" data={stats.charts.byCampaignType} />
          <ChartPanel title="Monthly Trends" data={stats.charts.monthlyTrends} type="line" />
        </div>
      )}
    </>
  );
}
