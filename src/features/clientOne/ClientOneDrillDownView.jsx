import { useId, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Layers,
  MapPin,
  Search,
  Stethoscope,
  Tent,
  Timer,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function formatStatus(value) {
  const raw = String(value || '').replace(/_/g, ' ').trim();
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDisplayDate(isoStr) {
  if (!isoStr) return '—';
  const parts = String(isoStr).slice(0, 10).split('-');
  if (parts.length !== 3) return isoStr;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(m, 10) - 1;
  return `${d}-${months[monthIdx] || m}-${y}`;
}

function resolveMrName(camp = {}) {
  const contacts = Array.isArray(camp.contactPersons) ? camp.contactPersons : [];
  const tm = contacts.find((person) => {
    const level = String(person?.level || person?.role || person?.code || '').toLowerCase();
    return (
      level.includes('territory')
      || level.includes('manager')
      || level === 'tm'
      || level === 'mr'
      || level.includes('tbm')
    );
  });
  return String(tm?.name || camp.fieldPersonName || '').trim();
}

function getLeadDays(camp = {}) {
  const reqAnchor = camp.requestDate || String(camp.submittedAt || '').slice(0, 10);
  const campDate = String(camp.campDate || '').slice(0, 10);
  if (!reqAnchor || !campDate) return null;
  const d1 = Date.parse(reqAnchor);
  const d2 = Date.parse(campDate);
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86400000);
}

function getExecutionHours(camp = {}) {
  if (camp.extraHours != null && Number.isFinite(Number(camp.extraHours))) {
    return Number(camp.extraHours);
  }
  if (camp.inTime && camp.outTime) {
    const [h1, m1] = String(camp.inTime).split(':').map(Number);
    const [h2, m2] = String(camp.outTime).split(':').map(Number);
    if (Number.isFinite(h1) && Number.isFinite(h2)) {
      const diff = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
      return diff > 0 ? Math.round((diff / 60) * 10) / 10 : null;
    }
  }
  return null;
}

export function filterDrillDownCamps(camps = [], drillDown = {}) {
  if (!drillDown) return camps;
  const { source, key, label } = drillDown;

  return camps.filter((camp) => {
    // 1. Hero KPIs
    if (source === 'hero') {
      if (key === 'camps') {
        if (!label || label === 'total' || label === 'All' || label === 'Total Camps' || label === 'Camp Count') {
          return true;
        }
        const status = String(camp.status || '').toLowerCase();
        const execStatus = String(camp.executionStatus || camp.effectiveExecutionStatus || '').toLowerCase();
        if (label === 'Executed') {
          return status === 'executed' || execStatus === 'executed';
        }
        if (label === 'Planned') {
          return !['executed', 'cancelled', 'rejected'].includes(status);
        }
        if (label === 'Cancelled') {
          return status === 'cancelled' || status === 'rejected' || Boolean(camp.cancellationBy);
        }
        return true;
      }
      if (key === 'patients') {
        const patients = Number(camp.actualPatients ?? camp.patientsCount);
        return Number.isFinite(patients) && patients > 0;
      }
      if (key === 'doctors') {
        return Boolean(String(camp.doctorName || '').trim());
      }
    }

    // 2. Camp Operations Analysis (Charts)
    if (source === 'chart') {
      if (!label || label === 'All') {
        if (key === 'extraHours') {
          const status = String(camp.status || '').toLowerCase();
          const execStatus = String(camp.executionStatus || camp.effectiveExecutionStatus || '').toLowerCase();
          return status === 'executed' || execStatus === 'executed';
        }
        if (key === 'tyloCancellation') {
          const by = String(camp.cancellationBy || camp.cancelledBy || '').toLowerCase();
          return by.includes('tylo') || String(camp.closureReasonCategory || '').toLowerCase().includes('tylo');
        }
        return true;
      }

      if (key === 'requestTimeline') {
        const days = getLeadDays(camp);
        if (days == null) return false;
        if (label === '≥ 5 Days' || label === '5 or more Days' || label === '>= 5 Days') {
          return days >= 5;
        }
        if (label === '< 5 Days' || label === 'Less than 5 Days') {
          return days < 5;
        }
        return true;
      }

      if (key === 'extraHours') {
        const status = String(camp.status || '').toLowerCase();
        const execStatus = String(camp.executionStatus || camp.effectiveExecutionStatus || '').toLowerCase();
        if (status !== 'executed' && execStatus !== 'executed') return false;

        const hours = getExecutionHours(camp) ?? 0;
        if (label === 'Within 4 hours' || label === '≤ 4 Hours' || label === '<= 4 Hours') {
          return hours <= 4;
        }
        if (label === 'More than 4 hours' || label === '4 – 8 Hours' || label === '4-8 Hours') {
          return hours > 4 && hours <= 8;
        }
        if (label === '> 8 Hours' || label === 'More than 8 hours') {
          return hours > 8;
        }
        return true;
      }

      if (key === 'finalBilling') {
        const billing = String(camp.chargeableStatus || '').trim().toLowerCase();
        if (label === 'Chargeable') return billing === 'chargeable';
        if (label === 'Non-Chargeable' || label === 'Non Chargeable') return billing.includes('non');
        if (label === 'Planned' || label === 'Pending') {
          return !billing || billing === 'planned' || billing === 'pending';
        }
        return true;
      }

      if (key === 'executedClinics') {
        const status = String(camp.status || '').toLowerCase();
        const execStatus = String(camp.executionStatus || camp.effectiveExecutionStatus || '').toLowerCase();
        const cancelBy = String(camp.cancellationBy || camp.cancelledBy || '').toLowerCase();
        if (label === 'Executed') return status === 'executed' || execStatus === 'executed';
        if (label === 'Cancelled by Client') return cancelBy.includes('client');
        if (label === 'Cancelled by Tylo') return cancelBy.includes('tylo');
        if (label === 'Planned') return !['executed', 'cancelled', 'rejected'].includes(status);
        return true;
      }

      if (key === 'punctuality') {
        const punct = String(camp.punctuality || '').toLowerCase();
        const target = label.toLowerCase();
        if (target === 'pending') return !punct || punct === 'pending';
        return punct === target;
      }

      if (key === 'tyloCancellation') {
        const cancelBy = String(camp.cancellationBy || camp.cancelledBy || '').toLowerCase();
        const reason = String(
          camp.closureSubReason || camp.closureReasonCode || camp.cancellationReason || camp.closureSubReasonLabel || '',
        ).toLowerCase();
        const labelLower = label.toLowerCase();
        return cancelBy.includes('tylo') && (reason.includes(labelLower) || labelLower.includes('other'));
      }
    }

    // 3. Top Performers / Leaderboard
    if (source === 'performer') {
      const mode = drillDown.mode;
      const targetName = String(drillDown.name || '').trim().toLowerCase();
      if (mode === 'doctors') {
        return String(camp.doctorName || '').trim().toLowerCase() === targetName;
      }
      if (mode === 'mrs') {
        const mr = resolveMrName(camp).toLowerCase();
        return mr === targetName;
      }
    }

    return true;
  });
}

function exportCampsToCsv(camps = [], fileName = 'drilldown-records.csv') {
  if (!camps.length) return;
  const headers = [
    'Camp ID',
    'Date',
    'Doctor Name',
    'MR Name',
    'City',
    'State',
    'Status',
    'Chargeability',
    'Punctuality',
    'Patients Screened',
    'HCW Name',
  ];

  const rows = camps.map((c) => [
    `"${c.campId || ''}"`,
    `"${c.campDate || ''}"`,
    `"${(c.doctorName || '').replace(/"/g, '""')}"`,
    `"${resolveMrName(c).replace(/"/g, '""')}"`,
    `"${(c.city || '').replace(/"/g, '""')}"`,
    `"${(c.state || '').replace(/"/g, '""')}"`,
    `"${c.status || ''}"`,
    `"${c.chargeableStatus || ''}"`,
    `"${c.punctuality || ''}"`,
    Number(c.actualPatients ?? c.patientsCount ?? 0),
    `"${(c.hcwName || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ClientOneDrillDownView({
  drillDown,
  camps = [],
  range = {},
  client = {},
  onBack,
  onSelectCamp,
  selectedCampId = '',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputId = useId();

  const matchingCamps = useMemo(
    () => filterDrillDownCamps(camps, drillDown),
    [camps, drillDown],
  );

  const filteredCamps = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return matchingCamps;
    return matchingCamps.filter((c) => {
      const campId = String(c.campId || '').toLowerCase();
      const doc = String(c.doctorName || '').toLowerCase();
      const mr = resolveMrName(c).toLowerCase();
      const city = String(c.city || '').toLowerCase();
      const state = String(c.state || '').toLowerCase();
      const hcw = String(c.hcwName || '').toLowerCase();
      return (
        campId.includes(q)
        || doc.includes(q)
        || mr.includes(q)
        || city.includes(q)
        || state.includes(q)
        || hcw.includes(q)
      );
    });
  }, [matchingCamps, searchTerm]);

  const summary = useMemo(() => {
    let patients = 0;
    const docs = new Set();
    const mrs = new Set();
    for (const c of filteredCamps) {
      const p = Number(c.actualPatients ?? c.patientsCount);
      if (Number.isFinite(p) && p > 0) patients += p;
      if (c.doctorName?.trim()) docs.add(c.doctorName.trim().toLowerCase());
      const mr = resolveMrName(c);
      if (mr) mrs.add(mr.toLowerCase());
    }
    return {
      totalCamps: filteredCamps.length,
      totalPatients: patients,
      uniqueDoctors: docs.size,
      uniqueMrs: mrs.size,
    };
  }, [filteredCamps]);

  const metricContextTitle = drillDown?.title || 'Metric Records';
  const metricCategory = drillDown?.label || 'All';
  const metricKey = drillDown?.key || '';

  const getMetricDetailCell = (camp) => {
    if (drillDown?.source === 'hero' && metricKey === 'patients') {
      const p = camp.actualPatients ?? camp.patientsCount;
      return <strong className="c1-table-num">{p != null ? formatCount(p) : '—'}</strong>;
    }

    if (metricKey === 'requestTimeline') {
      const days = getLeadDays(camp);
      const isQuick = days != null && days < 5;
      return (
        <span className={`c1-metric-pill c1-metric-pill--${isQuick ? 'sky' : 'blue'}`}>
          {days != null ? `${days} Days` : '—'}
        </span>
      );
    }

    if (metricKey === 'extraHours') {
      const hrs = getExecutionHours(camp);
      return (
        <span className="c1-table-text">
          {hrs != null ? `${hrs} hrs` : 'Standard'}
          {camp.inTime && camp.outTime ? ` (${camp.inTime}–${camp.outTime})` : ''}
        </span>
      );
    }

    if (metricKey === 'finalBilling') {
      return (
        <span className={`c1-metric-pill c1-metric-pill--${String(camp.chargeableStatus).toLowerCase().includes('non') ? 'slate' : 'teal'}`}>
          {formatStatus(camp.chargeableStatus || 'Planned')}
        </span>
      );
    }

    if (metricKey === 'punctuality') {
      const p = String(camp.punctuality || 'pending').toLowerCase();
      const tone = p === 'good' ? 'emerald' : p === 'average' ? 'amber' : p === 'poor' ? 'slate' : 'grey';
      return (
        <span className={`c1-metric-pill c1-metric-pill--${tone}`}>
          {formatStatus(camp.punctuality || 'Pending')}
        </span>
      );
    }

    if (metricKey === 'tyloCancellation') {
      return (
        <span className="c1-table-text c1-table-text--muted" title={camp.cancellationReason || camp.closureSubReasonLabel}>
          {camp.closureSubReasonLabel || camp.cancellationReason || 'Cancelled by Tylo'}
        </span>
      );
    }

    // Default: show patients count
    const p = camp.actualPatients ?? camp.patientsCount;
    return <span className="c1-table-num">{p != null ? formatCount(p) : '—'}</span>;
  };

  const getMetricColumnHeader = () => {
    if (drillDown?.source === 'hero' && metricKey === 'patients') return 'Patients Screened';
    if (metricKey === 'requestTimeline') return 'Lead Time';
    if (metricKey === 'extraHours') return 'Duration / Timing';
    if (metricKey === 'finalBilling') return 'Chargeability';
    if (metricKey === 'punctuality') return 'Punctuality';
    if (metricKey === 'tyloCancellation') return 'Cancellation Reason';
    return 'Patients';
  };

  return (
    <section className="c1-drilldown-view" aria-label="Drill-down Table View">
      {/* ── Top Navigation & Back Action ── */}
      <header className="c1-drilldown-header">
        <div className="c1-drilldown-header__left">
          <button
            type="button"
            className="c1-drilldown-back-btn"
            onClick={onBack}
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>

          <div className="c1-drilldown-breadcrumbs">
            <span className="c1-drilldown-crumb">Dashboard</span>
            <span className="c1-drilldown-sep">/</span>
            <span className="c1-drilldown-crumb">
              {drillDown?.source === 'performer'
                ? 'Top Performers'
                : drillDown?.source === 'hero'
                  ? 'Key Metrics'
                  : 'Operations Analysis'}
            </span>
            <span className="c1-drilldown-sep">/</span>
            <span className="c1-drilldown-crumb c1-drilldown-crumb--active">
              {metricContextTitle}
            </span>
          </div>
        </div>

        <div className="c1-drilldown-header__right">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => exportCampsToCsv(filteredCamps, `drilldown-${metricKey || 'records'}.csv`)}
            disabled={!filteredCamps.length}
            title="Export filtered records to CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span>Export CSV</span>
          </Button>

          <button
            type="button"
            className="c1-drilldown-close-btn"
            onClick={onBack}
            aria-label="Close drill-down"
            title="Close drill-down"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Context & Statistics Summary Strip ── */}
      <div className="c1-drilldown-banner">
        <div className="c1-drilldown-banner__main">
          <div className="c1-drilldown-badge">
            <Filter size={13} aria-hidden="true" />
            <span>POWER BI DRILL-DOWN</span>
          </div>
          <h2 className="c1-drilldown-title">{metricContextTitle}</h2>
          <p className="c1-drilldown-desc">
            Showing {filteredCamps.length} underlying camp records for category{' '}
            <strong>{metricCategory}</strong> within{' '}
            {formatDisplayDate(range.from)} – {formatDisplayDate(range.to)}.
          </p>
        </div>

        <div className="c1-drilldown-stats">
          <div className="c1-drilldown-stat">
            <span className="c1-drilldown-stat__label">Total Camps</span>
            <strong className="c1-drilldown-stat__val">{formatCount(summary.totalCamps)}</strong>
          </div>
          <div className="c1-drilldown-stat">
            <span className="c1-drilldown-stat__label">Patients Screened</span>
            <strong className="c1-drilldown-stat__val">{formatCount(summary.totalPatients)}</strong>
          </div>
          <div className="c1-drilldown-stat">
            <span className="c1-drilldown-stat__label">Unique Doctors</span>
            <strong className="c1-drilldown-stat__val">{summary.uniqueDoctors}</strong>
          </div>
          {summary.uniqueMrs > 0 ? (
            <div className="c1-drilldown-stat">
              <span className="c1-drilldown-stat__label">Active MRs</span>
              <strong className="c1-drilldown-stat__val">{summary.uniqueMrs}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Filter Search Control ── */}
      <div className="c1-drilldown-toolbar">
        <div className="c1-drilldown-search-wrap">
          <Search size={14} className="c1-drilldown-search-icon" aria-hidden="true" />
          <input
            id={searchInputId}
            type="text"
            placeholder="Search records by ID, Doctor, MR, or City..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="c1-drilldown-search-input"
            aria-label="Filter drill-down records"
          />
          {searchTerm ? (
            <button
              type="button"
              className="c1-drilldown-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        <span className="c1-drilldown-count-note">
          Showing <strong>{filteredCamps.length}</strong> of {matchingCamps.length} camps
        </span>
      </div>

      {/* ── Records Table ── */}
      <div className="c1-drilldown-table-wrap">
        <table className="c1-drilldown-table" aria-label="Drill-down records">
          <thead>
            <tr>
              <th scope="col" style={{ width: '44px' }}>#</th>
              <th scope="col" style={{ width: '130px' }}>Camp ID</th>
              <th scope="col" style={{ width: '115px' }}>Date</th>
              <th scope="col">Doctor</th>
              <th scope="col">MR / Field Rep</th>
              <th scope="col">Location</th>
              <th scope="col">{getMetricColumnHeader()}</th>
              <th scope="col" style={{ width: '110px' }}>Status</th>
              <th scope="col" style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCamps.map((camp, idx) => {
              const isSelected = selectedCampId === camp._id;
              const statusRaw = String(camp.status || '').toLowerCase();
              const statusTone = statusRaw === 'executed' ? 'executed' : statusRaw === 'cancelled' || statusRaw === 'rejected' ? 'cancelled' : 'planned';
              const mrName = resolveMrName(camp);

              return (
                <tr
                  key={camp._id || `row-${idx}`}
                  className={`c1-drilldown-row${isSelected ? ' is-selected' : ''}`}
                  onClick={() => onSelectCamp?.(camp._id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full camp details"
                >
                  <td className="c1-drilldown-idx">{idx + 1}</td>
                  <td>
                    <span className="c1-camp-code">{camp.campId || '—'}</span>
                  </td>
                  <td>
                    <span className="c1-date-cell">{formatDisplayDate(camp.campDate)}</span>
                  </td>
                  <td>
                    <span className="c1-person-name" title={camp.doctorName}>
                      {camp.doctorName || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="c1-person-name" title={mrName}>
                      {mrName || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="c1-location-cell" title={[camp.city, camp.state].filter(Boolean).join(', ')}>
                      {[camp.city, camp.state].filter(Boolean).join(', ') || '—'}
                    </span>
                  </td>
                  <td>{getMetricDetailCell(camp)}</td>
                  <td>
                    <span className={`c1-status-badge c1-status-badge--${statusTone}`}>
                      {formatStatus(camp.status || 'Pending')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="c1-row-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCamp?.(camp._id);
                      }}
                      title="Inspect camp details"
                    >
                      <Eye size={13} aria-hidden="true" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {!filteredCamps.length ? (
              <tr>
                <td colSpan={9} className="c1-table-empty-cell">
                  <div className="c1-empty-drilldown">
                    <p className="c1-empty-title">No matching records found</p>
                    <p className="c1-empty-desc">
                      {searchTerm
                        ? `No camps matched the search filter "${searchTerm}".`
                        : 'There are no individual camp records logged for this metric slice in the selected date range.'}
                    </p>
                    <Button type="button" variant="secondary" size="compact" onClick={onBack}>
                      Return to Dashboard
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* ── Footer Navigation ── */}
      <footer className="c1-drilldown-footer">
        <span className="c1-drilldown-footer-info">
          Showing {filteredCamps.length} records matching <strong>{metricContextTitle}</strong>
        </span>
        <Button type="button" variant="secondary" size="compact" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Button>
      </footer>
    </section>
  );
}
