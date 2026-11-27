import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import { campApi } from '../campOpsApi.js';
import { apiErrorMessage } from '../useCampOpsAuth.js';
import { apiFetch } from '../../../shared/api.js';

/**
 * Admin-only Deleted / Recovery panel for Camp One Manage.
 */
export function CampRecoveryPanel({ enabled = false, onRestored }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletedRows, setDeletedRows] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [selected, setSelected] = useState([]);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!enabled || !open) return;
    setLoading(true);
    setError('');
    try {
      const [deletedRes, invRes] = await Promise.all([
        campApi.list({ deleted: '1', limit: 100, page: 1 }),
        campApi.recoveryInventory(),
      ]);
      const deletedBody = deletedRes?.data;
      const rows = deletedBody?.data || deletedBody?.rows || deletedBody || [];
      setDeletedRows(Array.isArray(rows) ? rows : []);
      setInventory(invRes?.data?.data || invRes?.data || null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load recovery data'));
    } finally {
      setLoading(false);
    }
  }, [enabled, open]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openRestore = (ids) => {
    setRestoreTarget({ ids: ids.map(String) });
    setRestoreReason('');
  };

  const confirmRestore = async () => {
    const reason = String(restoreReason || '').trim();
    if (!reason || !restoreTarget?.ids?.length) return;
    setConfirmLoading(true);
    setError('');
    try {
      if (restoreTarget.ids.length === 1) {
        await campApi.restore(restoreTarget.ids[0], { reason });
      } else {
        await campApi.restoreBatch({ ids: restoreTarget.ids, reason, dryRun: false });
      }
      setMessage(`Restored ${restoreTarget.ids.length} camp(s).`);
      setRestoreTarget(null);
      setSelected([]);
      await load();
      onRestored?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Restore failed'));
    } finally {
      setConfirmLoading(false);
    }
  };

  const exportInventory = async () => {
    try {
      const res = await apiFetch('/camp-ops/camps/recovery/inventory?format=csv');
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'camp-recovery-inventory.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Export failed'));
    }
  };

  const missing = inventory?.missing || [];
  const summary = inventory?.summary || {};

  return (
    <div className="card camps-recovery-panel">
      <div className="camps-recovery-panel__header bulk-bar camps-manage-bulk-bar">
        <Button variant="secondary" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide Deleted / Recovery' : 'Deleted / Recovery'}
        </Button>
        {open ? (
          <>
            <Button variant="secondary" type="button" onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button variant="secondary" type="button" onClick={exportInventory}>
              Export inventory
            </Button>
            {selected.length > 0 ? (
              <Button
                variant="primary"
                type="button"
                onClick={() => openRestore(selected)}
              >
                Restore selected ({selected.length})
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {open ? (
        <div className="camps-recovery-panel__body">
          {message ? <p className="text-success">{message}</p> : null}
          {error ? <p className="text-danger">{error}</p> : null}
          {loading ? <p>Loading recovery data…</p> : null}

          {summary ? (
            <p className="camps-recovery-summary">
              Soft-deleted: {summary.softDeletedCount ?? deletedRows.length}
              {' · '}
              Rehydrate candidates: {summary.rehydrateFreeIdCount ?? 0}
              {' · '}
              Evidence-only: {summary.evidenceOnlyCount ?? 0}
              {' · '}
              Unrecoverable: {summary.unrecoverableCount ?? 0}
            </p>
          ) : null}

          <h3 className="camps-recovery-heading">Soft-deleted camps</h3>
          {deletedRows.length === 0 ? (
            <p className="camps-cell-empty">No soft-deleted camps in the database.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th />
                    <th>Camp ID</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Deleted</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deletedRows.map((camp) => {
                    const id = String(camp._id || camp.id);
                    return (
                      <tr key={id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(id)}
                            onChange={() => toggleSelect(id)}
                            aria-label={`Select ${camp.campId}`}
                          />
                        </td>
                        <td>{camp.campId}</td>
                        <td>{camp.clientName || '—'}</td>
                        <td>{camp.campDate || '—'}</td>
                        <td>{camp.status || '—'}</td>
                        <td>{camp.deletedAt ? String(camp.deletedAt).slice(0, 19) : '—'}</td>
                        <td>{camp.deletionReason || '—'}</td>
                        <td>
                          <Button
                            variant="primary"
                            type="button"
                            onClick={() => openRestore([id])}
                          >
                            Restore
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="camps-recovery-heading">Historical / missing evidence</h3>
          {missing.length === 0 ? (
            <p className="camps-cell-empty">No missing-camp evidence in inventory.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Camp ID</th>
                    <th>Feasibility</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Blockers</th>
                    <th>Uploads</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.slice(0, 50).map((row) => (
                    <tr key={`${row.campId}-${row._id}`}>
                      <td>{row.campId || '—'}</td>
                      <td>{row.feasibility}</td>
                      <td>{row.clientName || '—'}</td>
                      <td>{row.campDate || '—'}</td>
                      <td>{(row.blockers || []).join('; ') || '—'}</td>
                      <td>{(row.uploads || []).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="Restore camp(s)"
        message="Restored camps keep their original Camp ID, documents, and financial fields. Soft-delete history is retained in audit."
        confirmLabel="Restore"
        confirmVariant="primary"
        loading={confirmLoading}
        onCancel={() => (!confirmLoading ? setRestoreTarget(null) : null)}
        onConfirm={confirmRestore}
      >
        <label className="field">
          <span className="field-label">Reason (required)</span>
          <Input
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
            placeholder="Why are these camps being restored?"
            disabled={confirmLoading}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
