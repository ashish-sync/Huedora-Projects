import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import ClientMasterRecipientPicker from '../builder/ClientMasterRecipientPicker.jsx';
import { canManageOrganisationMaster } from '../builder/commercialApproval.js';
import { formatStateLine, parseStateLine } from '../builder/stateLine.js';
import { clampTextLines } from '../documentGenerator/inlineEdit.jsx';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxMode,
} from '../invoiceGenerator/invoiceCalculations.js';
import { MAX_PROFORMA_LINE_ITEMS } from './proformaStorage.js';
import DateInput from '../../../components/ui/DateInput.jsx';

function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ib-section${open ? ' is-open' : ''}`}>
      <button type="button" className="ib-section-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ib-section-title">{title}</span>
        {badge != null ? <span className="ib-section-badge">{badge}</span> : null}
        <span className="ib-section-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="ib-section-body">{children}</div> : null}
    </div>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <label className={`ib-field${span === 2 ? ' ib-field--span' : ''}`}>
      <span className="ib-field-label">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'ib-input';

export default function ProformaBuilderPanel({
  form,
  totals,
  update,
  updateLine,
  addLine,
  removeLine,
  updateTerm,
  addTerm,
  applyClientMasterRecipient,
  clearClientMasterRecipient,
}) {
  const lineRows = (form.rows || []).filter((r) => r.type === 'line');
  const taxMode = resolveTaxMode(form.recipient?.stateCode, form.company?.stateCode);
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);

  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Letterhead &amp; bank come from{' '}
          {canOrgMaster ? (
            <Link to="/finance-one/organisation" className="ib-link">
              Organisation master
            </Link>
          ) : (
            'Organisation master'
          )}
          . Click the document to edit inline.
        </p>
      </div>

      <Section title="Header" defaultOpen>
        <div className="ib-grid">
          <Field label="Proforma no.">
            <input
              className={`${inputCls} ib-input--mono`}
              value={form.document.documentNumber}
              readOnly
              placeholder="Assigned on approval"
              title="Document number is assigned when the document is approved"
            />
          </Field>
          <Field label="Project / Service Period">
            <input
              className={inputCls}
              value={form.document.servicePeriod || form.recipient.projectName || ''}
              onChange={(e) => {
                update('document.servicePeriod', e.target.value);
                update('recipient.projectName', e.target.value);
              }}
            />
          </Field>
          <Field label="Proforma Date">
            <DateInput
              value={form.document.issueDate}
              onChange={(v) => update('document.issueDate', v)}
              inputClassName={inputCls}
              hideLabel
            />
          </Field>
          <Field label="Valid Until">
            <DateInput
              value={form.document.dueDate}
              onChange={(v) => update('document.dueDate', v)}
              inputClassName={inputCls}
              hideLabel
            />
          </Field>
          <Field label="PO / WO No.">
            <input className={inputCls} value={form.document.reference || ''} onChange={(e) => update('document.reference', e.target.value)} />
          </Field>
          <Field label="PO / WO Date">
            <DateInput
              value={form.document.referenceDate || ''}
              onChange={(v) => update('document.referenceDate', v)}
              inputClassName={inputCls}
              hideLabel
            />
          </Field>
        </div>
      </Section>

      <Section title="Bill To" defaultOpen>
        {applyClientMasterRecipient ? (
          <div className="ib-grid" style={{ marginBottom: 12 }}>
            <Field label="Client Master" span={2}>
              <ClientMasterRecipientPicker
                value={form.clientMasterId || ''}
                onPick={(_row, patch) => applyClientMasterRecipient(patch)}
                onClear={() => clearClientMasterRecipient?.()}
              />
            </Field>
          </div>
        ) : null}
        <div className="ib-grid">
          <Field label="Legal Name">
            <input className={inputCls} value={form.recipient.name} onChange={(e) => update('recipient.name', e.target.value)} />
          </Field>
          <Field label="Contact Name">
            <input
              className={inputCls}
              value={form.recipient.contactPerson || ''}
              onChange={(e) => update('recipient.contactPerson', e.target.value)}
              placeholder="—"
            />
          </Field>
          <Field label="Address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.recipient.placeOfSupply} onChange={(e) => update('recipient.placeOfSupply', e.target.value)} />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.recipient.recipientGstin} onChange={(e) => update('recipient.recipientGstin', e.target.value)} />
          </Field>
          <Field label="State Name / State Code" title="Different from your state → IGST; same state → CGST + SGST">
            <input
              className={inputCls}
              value={formatStateLine(form.recipient)}
              onChange={(e) => {
                const { stateName, stateCode } = parseStateLine(e.target.value);
                update('recipient.stateName', stateName);
                update('recipient.stateCode', stateCode);
              }}
              placeholder="Maharashtra / 27"
            />
          </Field>
        </div>
      </Section>

      <Section title="Ship To" defaultOpen>
          <label className="ib-check">
            <input
              type="checkbox"
              checked={Boolean(form.shipToSameAsBillTo)}
              onChange={(e) => update('shipToSameAsBillTo', e.target.checked)}
            />
            <span>Ship To details same as Bill To</span>
          </label>
        <div className={`ib-grid${form.shipToSameAsBillTo ? ' ib-grid--locked' : ''}`}>
          <Field label="Legal / Location name">
            <input
              className={inputCls}
              value={form.shipTo?.name || ''}
              onChange={(e) => update('shipTo.name', e.target.value)}
              readOnly={Boolean(form.shipToSameAsBillTo)}
            />
          </Field>
          <Field label="Contact Name">
            <input
              className={inputCls}
              value={form.shipTo?.contactPerson || ''}
              onChange={(e) => update('shipTo.contactPerson', e.target.value)}
              placeholder="—"
              readOnly={Boolean(form.shipToSameAsBillTo)}
            />
          </Field>
          <Field label="Address" span={2}>
            <textarea
              className={`${inputCls} ib-textarea`}
              rows={2}
              value={form.shipTo?.address || ''}
              onChange={(e) => update('shipTo.address', e.target.value)}
              readOnly={Boolean(form.shipToSameAsBillTo)}
            />
          </Field>
          <Field label="GSTIN">
            <input
              className={inputCls}
              value={form.shipTo?.gstin || ''}
              onChange={(e) => update('shipTo.gstin', e.target.value)}
              readOnly={Boolean(form.shipToSameAsBillTo)}
            />
          </Field>
          <Field label="State Name / State Code">
            <input
              className={inputCls}
              value={formatStateLine(form.shipTo)}
              onChange={(e) => {
                const { stateName, stateCode } = parseStateLine(e.target.value);
                update('shipTo.stateName', stateName);
                update('shipTo.stateCode', stateCode);
              }}
              readOnly={Boolean(form.shipToSameAsBillTo)}
              placeholder="Maharashtra / 27"
            />
          </Field>
        </div>
      </Section>

      <Section title="Line items" badge={lineRows.length} defaultOpen>
        <div className="ib-lines">
          {lineRows.map((line, index) => (
            <div key={line.id} className="ib-line-card">
              <div className="ib-line-head">
                <span>Line {index + 1}</span>
                {lineRows.length > 1 ? (
                  <button type="button" className="ib-line-remove" onClick={() => removeLine(line.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="ib-grid">
                <Field label="Description of Services" span={2}>
                  <textarea
                    className={`${inputCls} ib-textarea`}
                    rows={2}
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: clampTextLines(e.target.value, 2) })}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (!e.shiftKey) {
                        e.preventDefault();
                        return;
                      }
                      if (String(line.description || '').split('\n').length >= 2) e.preventDefault();
                    }}
                    placeholder="Shift+Enter for a second line"
                  />
                </Field>
                <Field label="SAC">
                  <input className={inputCls} value={line.hsnSac} onChange={(e) => updateLine(line.id, { hsnSac: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })} />
                </Field>
                <Field label="Rate">
                  <input type="number" className={inputCls} value={line.rate} onChange={(e) => updateLine(line.id, { rate: e.target.value })} />
                </Field>
                <Field label="GST Rate %">
                  <input
                    type="number"
                    className={inputCls}
                    value={getLineGstRateDisplay(line, taxMode)}
                    onChange={(e) => updateLine(line.id, patchLineGstRate(e.target.value, taxMode))}
                  />
                </Field>
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={lineRows.length >= MAX_PROFORMA_LINE_ITEMS}>
            + Add line {lineRows.length >= MAX_PROFORMA_LINE_ITEMS ? `(max ${MAX_PROFORMA_LINE_ITEMS})` : ''}
          </button>
        </div>
      </Section>

      <Section title="Terms" defaultOpen>
        <div className="ib-terms">
          {form.terms.map((term, index) => (
            <div key={index} className="ib-term-row">
              <span className="ib-term-num">{index + 1}.</span>
              <input className={inputCls} value={term} onChange={(e) => updateTerm(index, e.target.value)} />
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addTerm}>
            + Add term
          </button>
        </div>
      </Section>
    </div>
  );
}
