import { useEffect, useState } from 'react';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import { createPortal } from 'react-dom';
import { AutofillDecoyFields, patchAutofillContainer } from '../../../shared/suppressBrowserAutofill.js';
import { contactToHcwFields } from '../utils/campHcwContact';
import { campApi, clientMasterApi } from '../campOpsApi';
import {
  diagnoseClientMasterHcwGap,
  resolveCampClientId,
  resolveClientMasterHealthcareWorkers,
  parseClientMasterListResponse,
} from '../utils/clientMasterCascade';
import { CampHcwAssignPicker } from './CampHcwAssignPicker';
import { CampHireRequestButton } from './CampHireRequestButton';
import {
  assignmentCopySourceFromCamp,
  copyCampAssignmentDetailsFromRecord,
  formatCampAssignmentDetails,
} from '../utils/campAssignmentCopy';

export function CampAssignModal({
  camp,
  hcwContacts = [],
  contactsLoading = false,
  onClose,
  onSaved,
}) {
  const [fields, setFields] = useState(() => contactToHcwFields(
    hcwContacts.find((c) => String(c._id) === String(camp?.hcwContactId)),
  ));
  const [clientMasterProfessions, setClientMasterProfessions] = useState([]);
  const [clientMasterHcwGap, setClientMasterHcwGap] = useState('no_records');
  const [clientMasterLoading, setClientMasterLoading] = useState(false);
  const [savedCamp, setSavedCamp] = useState(null);
  const [copyState, setCopyState] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event) {
      if (event.key === 'Escape' && !saving) onClose?.();
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  useEffect(() => {
    const root = document.querySelector('.camp-assign-modal');
    if (root) patchAutofillContainer(root);
  }, [savedCamp]);

  useEffect(() => {
    const clientId = resolveCampClientId(camp);
    const clientName = String(camp?.clientName || camp?.client?.name || '').trim();
    if (!clientId && !clientName) {
      setClientMasterProfessions([]);
      setClientMasterHcwGap('no_records');
      setClientMasterLoading(false);
      return undefined;
    }

    let cancelled = false;
    setClientMasterLoading(true);
    const pathId = clientId || encodeURIComponent(clientName);
    clientMasterApi.listByClient(pathId, clientName ? { clientName } : undefined)
      .then((response) => {
        if (cancelled) return;
        const records = parseClientMasterListResponse(response);
        const filters = {
          campaignType: camp?.campaignType,
          campaignName: camp?.campaignName,
        };
        setClientMasterProfessions(resolveClientMasterHealthcareWorkers(records, filters));
        setClientMasterHcwGap(diagnoseClientMasterHcwGap(records, filters));
      })
      .catch((err) => {
        if (cancelled) return;
        setClientMasterProfessions([]);
        setClientMasterHcwGap('load_failed');
        setError(err?.message || 'Failed to load Client Master for this camp');
      })
      .finally(() => {
        if (!cancelled) setClientMasterLoading(false);
      });

    return () => { cancelled = true; };
  }, [camp?.client, camp?.clientId, camp?.clientName, camp?.campaignType, camp?.campaignName]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!fields.hcwContactId) {
      setError('Select a healthcare worker');
      return;
    }
    if (!fields.hcwCategory || !fields.hcwName || !fields.hcwContact) {
      setError('HCW Category, Name, and Contact are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await campApi.update(camp._id, {
        assignmentDecision: 'assign',
        assignmentRefusalReason: '',
        hcwContactId: fields.hcwContactId,
        hcwCategory: fields.hcwCategory,
        hcwName: fields.hcwName,
        hcwContact: fields.hcwContact,
        editingStage: 'assignment',
        lifecycleStage: 'assignment',
        lifecycleOnly: true,
      });
      setSavedCamp(data?.data || data);
    } catch (err) {
      setError(err?.message || 'Failed to assign resource');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyDetails() {
    const source = savedCamp || camp;
    const didCopy = await copyCampAssignmentDetailsFromRecord(source);
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  function handleDone() {
    onSaved?.(savedCamp);
    onClose?.();
  }

  const copyPreview = formatCampAssignmentDetails(
    assignmentCopySourceFromCamp(savedCamp || { ...camp, ...fields }),
  );

  return createPortal(
    <div className="camp-ops-root camp-info-portal-root">
      <div className="modal-overlay camp-info-modal-overlay" onClick={savedCamp ? undefined : onClose}>
        <form
          className="modal-card camp-assign-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camp-assign-modal-title"
          onClick={(event) => event.stopPropagation()}
          onSubmit={savedCamp ? (event) => event.preventDefault() : handleSubmit}
          autoComplete="off"
          data-form-type="other"
        >
          <AutofillDecoyFields />
          <header className="camp-approval-issues-header">
            <div>
              <h2 id="camp-assign-modal-title">
                {savedCamp ? 'Resource assigned' : 'Assign resource'}
              </h2>
              {camp?.campId && <p className="camp-approval-issues-subtitle">{camp.campId}</p>}
            </div>
            <button type="button" className="camp-info-modal-close" aria-label="Close" onClick={handleDone}>
              ×
            </button>
          </header>

          <div className="camp-assign-modal-body">
            {error && <FeedbackBanner variant="error" className="camp-assign-modal-error">{error}</FeedbackBanner>}
            {savedCamp ? (
              <>
                <p className="camp-approval-issues-lead">
                  Healthcare worker assigned. Copy the clinic details below to share with the field team.
                </p>
                <pre className="camp-assignment-copy-preview">{copyPreview}</pre>
                <div className="camp-assignment-copy-wrap">
                  <button
                    type="button"
                    className="btn secondary btn-compact"
                    onClick={handleCopyDetails}
                  >
                    {copyState === 'copied' ? 'Copied' : 'Copy details'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="camp-approval-issues-lead">
                  Select resource type, state, and city to find the healthcare worker configured for this Client in Client Master.
                  After assignment the camp stays in Assignment until one day before the camp date, then moves to Execution.
                </p>
                <div className="camp-assignment-toolbar camp-assign-modal-hire">
                  <CampHireRequestButton
                    form={{ ...camp, ...fields }}
                    professions={clientMasterProfessions}
                    disabled={saving}
                    variant="button"
                    label="Raise hiring request"
                  />
                </div>
                <CampHcwAssignPicker
                  hcwContacts={hcwContacts}
                  contactsLoading={contactsLoading}
                  disabled={saving}
                  selectedContactId={fields.hcwContactId}
                  clientMasterProfessions={clientMasterProfessions}
                  clientMasterLoading={clientMasterLoading}
                  clientMasterHcwGap={clientMasterHcwGap}
                  onSelect={(nextFields) => {
                    setFields(nextFields);
                    setError('');
                  }}
                />
              </>
            )}
          </div>

          <footer className="camp-assign-modal-footer">
            {savedCamp ? (
              <button type="button" className="btn btn-compact" onClick={handleDone}>
                Done
              </button>
            ) : (
              <>
                <button type="button" className="btn secondary btn-compact" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-compact" disabled={saving || contactsLoading}>
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
              </>
            )}
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
