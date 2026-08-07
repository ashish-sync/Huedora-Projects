import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  resolveTaxMode,
} from '../invoiceGenerator/invoiceCalculations.js';
import { MAX_INVOICE_LINE_ITEMS } from '../invoiceGenerator/invoiceStorage.js';
import { canManageOrganisationMaster } from './commercialApproval.js';
import { clampTextLines } from '../documentGenerator/inlineEdit.jsx';
import { formatStateLine, parseStateLine } from './stateLine.js';
import ClientMasterRecipientPicker from './ClientMasterRecipientPicker.jsx';
import ClientMasterPoTracker from './ClientMasterPoTracker.jsx';
import OriginalTaxInvoicePicker from './OriginalTaxInvoicePicker.jsx';

function Section({ id, title, badge, defaultOpen = false, children }) {
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

export default function InvoiceBuilderPanel({
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
  docId = '',
  panelConfig = {},
}) {
  const {
    docSectionTitle = 'Invoice',
    docNoLabel = 'Invoice no.',
    projectLabel = 'Project',
    dateLabel = 'Date',
    dueLabel = 'Due date',
    datesFromApproval = false,
    recipientTitle = 'Bill To',
    shipToTitle = 'Ship To',
    termsSectionTitle = 'Adjustments & terms',
    hideAdjustmentAmounts = false,
    /** 'default' | 'parties' | 'bos' — Header → Bill To → Ship To → Lines → Terms */
    panelLayout = 'parties',
    showOriginalInvoice = false,
    originalInvoiceLabel = 'Original invoice',
    showPoFields = false,
    showShipTo = true,
    showCreditReason = false,
    showDebitReason = false,
    showOriginalInvoiceDate = false,
    /** When true, original invoice no. is a system picker and date is read-only */
    lockOriginalInvoiceFromSystem = false,
    hideReverseCharge = false,
    hideReceiptVoucher = false,
    hideTaxColumnTitles = false,
    maxLineItems = MAX_INVOICE_LINE_ITEMS,
  } = panelConfig;
  const taxMode = resolveTaxMode(form.billTo?.stateCode, form.company?.stateCode);
  const taxLabels = resolveTaxColumnLabels(form);
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);
  const isPartiesLayout = panelLayout === 'bos' || panelLayout === 'parties';

  const recipientSection = (
      <Section id="recipient" title={recipientTitle} defaultOpen>
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
            <input className={inputCls} value={form.billTo.name} onChange={(e) => update('billTo.name', e.target.value)} />
          </Field>
          <Field label="Contact Name">
            <input
              className={inputCls}
              value={form.billTo.contactPerson || ''}
              onChange={(e) => update('billTo.contactPerson', e.target.value)}
              placeholder="—"
            />
          </Field>
          <Field label="Address" span={2}>
            <textarea
              className={`${inputCls} ib-textarea`}
              rows={2}
              value={form.billTo.address}
              onChange={(e) => update('billTo.address', e.target.value)}
            />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.billTo.gstin} onChange={(e) => update('billTo.gstin', e.target.value)} />
          </Field>
          <Field
            label="State Name / State Code"
            title="Different from your state → IGST; same state → CGST + SGST"
          >
            <input
              className={inputCls}
              value={formatStateLine(form.billTo)}
              onChange={(e) => {
                const { stateName, stateCode } = parseStateLine(e.target.value);
                update('billTo.stateName', stateName);
                update('billTo.stateCode', stateCode);
              }}
              placeholder="Maharashtra / 27"
            />
          </Field>
        </div>
      </Section>
  );

  const headerSection = (
      <Section id="invoice" title={docSectionTitle} defaultOpen>
        <div className="ib-grid">
          <Field label={docNoLabel}>
            <input
              className={`${inputCls} ib-input--mono`}
              value={form.invoice.documentNumber}
              readOnly
              placeholder="Assigned on approval"
              title="Document number is assigned when the document is approved"
            />
          </Field>
          <Field
            label={dateLabel}
            title={datesFromApproval ? 'Same as approval date' : undefined}
          >
            <input
              type="date"
              className={inputCls}
              value={form.invoice.issueDate || ''}
              onChange={(e) => update('invoice.issueDate', e.target.value)}
              readOnly={datesFromApproval}
              title={datesFromApproval ? 'Set automatically on approval' : undefined}
            />
          </Field>
          {showPoFields ? (
            <>
              {applyClientMasterRecipient && form.clientMasterId ? (
                <div className="ib-field ib-field--span">
                  <ClientMasterPoTracker
                    clientMasterId={form.clientMasterId}
                    selectedPoId={form.clientPurchaseOrderId || ''}
                    excludeDocId={docId}
                    totals={totals}
                    disabled={false}
                    onSelectPo={(po) => {
                      update('clientPurchaseOrderId', po?.id || '');
                      update('invoice.poReference', po?.poNumber || '');
                    }}
                  />
                </div>
              ) : null}
              <Field label="PO / WO No.">
                <input
                  className={inputCls}
                  value={form.invoice.poReference || ''}
                  onChange={(e) => {
                    update('invoice.poReference', e.target.value);
                    if (form.clientPurchaseOrderId) {
                      update('clientPurchaseOrderId', '');
                    }
                  }}
                  readOnly={Boolean(form.clientPurchaseOrderId)}
                  title={
                    form.clientPurchaseOrderId
                      ? 'Filled from selected Client Master PO — clear selection above to edit'
                      : undefined
                  }
                />
              </Field>
              <Field label="PO / WO Date">
                <input
                  className={inputCls}
                  value={form.invoice.poDate || ''}
                  onChange={(e) => update('invoice.poDate', e.target.value)}
                  placeholder="DD/MM/YYYY"
                />
              </Field>
            </>
          ) : null}
          <Field
            label={dueLabel}
            title={datesFromApproval ? '30 days from approval' : undefined}
          >
            <input
              type="date"
              className={inputCls}
              value={form.invoice.dueDate || ''}
              onChange={(e) => update('invoice.dueDate', e.target.value)}
              readOnly={datesFromApproval}
              title={datesFromApproval ? 'Set automatically on approval (+30 days)' : undefined}
            />
          </Field>
          <Field label={projectLabel}>
            <input
              className={inputCls}
              value={form.invoice.servicePeriod || form.invoice.projectName}
              onChange={(e) => {
                update('invoice.servicePeriod', e.target.value);
                update('invoice.projectName', e.target.value);
              }}
              placeholder="BMD Camp"
            />
          </Field>
          {showOriginalInvoice ? (
            <Field label={originalInvoiceLabel} span={showOriginalInvoiceDate ? 1 : 2}>
              {lockOriginalInvoiceFromSystem ? (
                <OriginalTaxInvoicePicker
                  value={form.invoice[panelConfig.originalInvoiceField || 'cnReference'] || ''}
                  onPick={(_row, patch) => {
                    const field = panelConfig.originalInvoiceField || 'cnReference';
                    update(`invoice.${field}`, patch.documentNumber || '');
                    update('invoice.originalInvoiceDate', patch.documentDate || '');
                  }}
                  onClear={() => {
                    const field = panelConfig.originalInvoiceField || 'cnReference';
                    update(`invoice.${field}`, '');
                    update('invoice.originalInvoiceDate', '');
                  }}
                />
              ) : (
                <input
                  className={inputCls}
                  value={form.invoice[panelConfig.originalInvoiceField || 'cnReference'] || ''}
                  onChange={(e) =>
                    update(`invoice.${panelConfig.originalInvoiceField || 'cnReference'}`, e.target.value)
                  }
                  placeholder="TYLO/26-27/0001"
                />
              )}
            </Field>
          ) : null}
          {showOriginalInvoiceDate ? (
            <Field
              label="Original invoice date"
              title={
                lockOriginalInvoiceFromSystem
                  ? 'Filled automatically from the selected Tax Invoice'
                  : undefined
              }
            >
              <input
                type="date"
                className={inputCls}
                value={form.invoice.originalInvoiceDate || ''}
                onChange={(e) => update('invoice.originalInvoiceDate', e.target.value)}
                readOnly={lockOriginalInvoiceFromSystem}
              />
            </Field>
          ) : null}
          {showCreditReason ? (
            <Field label="Reason for Credit Note" span={2}>
              <select
                className={inputCls}
                value={form.invoice.creditReason || 'Rate Revision / Cancellation / Service Adjustment'}
                onChange={(e) => update('invoice.creditReason', e.target.value)}
              >
                <option value="Rate Revision / Cancellation / Service Adjustment">
                  Rate Revision / Cancellation / Service Adjustment
                </option>
                <option value="Rate Revision">Rate Revision</option>
                <option value="Cancellation">Cancellation</option>
                <option value="Service Adjustment">Service Adjustment</option>
              </select>
            </Field>
          ) : null}
          {showDebitReason ? (
            <Field label="Reason for debit note" span={2}>
              <select
                className={inputCls}
                value={
                  form.invoice.debitReason ||
                  'Additional Service / Underbilling / Rate Revision / Tax Adjustment'
                }
                onChange={(e) => update('invoice.debitReason', e.target.value)}
              >
                <option value="Additional Service / Underbilling / Rate Revision / Tax Adjustment">
                  Additional Service / Underbilling / Rate Revision / Tax Adjustment
                </option>
                <option value="Additional Service">Additional Service</option>
                <option value="Underbilling">Underbilling</option>
                <option value="Rate Revision">Rate Revision</option>
                <option value="Tax Adjustment">Tax Adjustment</option>
              </select>
            </Field>
          ) : null}
          {!hideReverseCharge ? (
            <>
              <Field label="Place of supply" title="GST Place of Supply — State / State Code">
                <input
                  className={inputCls}
                  value={
                    form.invoice.placeOfSupplyState ||
                    [form.billTo?.stateName, form.billTo?.stateCode].filter(Boolean).join(' / ') ||
                    ''
                  }
                  onChange={(e) => update('invoice.placeOfSupplyState', e.target.value)}
                  placeholder="Maharashtra / 27"
                />
              </Field>
              <Field label="Reverse charge">
                <select className={inputCls} value={form.invoice.reverseCharge} onChange={(e) => update('invoice.reverseCharge', e.target.value)}>
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </Field>
            </>
          ) : null}
          {!hideReceiptVoucher ? (
            <Field label="Receipt voucher">
              <input className={inputCls} value={form.invoice.receiptVoucherNo || ''} onChange={(e) => update('invoice.receiptVoucherNo', e.target.value)} />
            </Field>
          ) : null}
        </div>
      </Section>
  );

  const shipToSection = showShipTo ? (
        <Section id="shipTo" title={shipToTitle} defaultOpen={isPartiesLayout}>
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
                className={inputCls}
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
  ) : null;

  const linesSection = (
      <Section id="lines" title="Line items" badge={form.lineItems.length} defaultOpen={isPartiesLayout}>
        {!hideTaxColumnTitles ? (
          <div className="ib-grid ib-grid--compact" style={{ marginBottom: 12 }}>
            <Field label="Rate column title">
              <input
                className={inputCls}
                value={form.taxColumnLabels?.rateLabel ?? taxLabels.rateLabel}
                onChange={(e) => update('taxColumnLabels.rateLabel', e.target.value)}
                placeholder="GST Rate %"
              />
            </Field>
            <Field label="Amount column title">
              <input
                className={inputCls}
                value={form.taxColumnLabels?.amountLabel ?? taxLabels.amountLabel}
                onChange={(e) => update('taxColumnLabels.amountLabel', e.target.value)}
                placeholder="GST"
              />
            </Field>
          </div>
        ) : null}
        <div className="ib-lines">
          {form.lineItems.map((line, index) => (
            <div key={line.id} className="ib-line-card">
              <div className="ib-line-head">
                <span>Line {index + 1}</span>
                {form.lineItems.length > 1 ? (
                  <button type="button" className="ib-line-remove" onClick={() => removeLine(index)}>
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
                    onChange={(e) => updateLine(index, { description: clampTextLines(e.target.value, 2) })}
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
                  <input className={inputCls} value={line.hsnSac} onChange={(e) => updateLine(index, { hsnSac: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                </Field>
                <Field label="Rate">
                  <input type="number" className={inputCls} value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                </Field>
                <Field label="GST Rate %">
                  <input
                    type="number"
                    className={inputCls}
                    value={getLineGstRateDisplay(line, taxMode)}
                    onChange={(e) => updateLine(index, patchLineGstRate(e.target.value, taxMode))}
                    placeholder="0"
                  />
                </Field>
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={form.lineItems.length >= maxLineItems}>
            + Add line {form.lineItems.length >= maxLineItems ? `(max ${maxLineItems})` : ''}
          </button>
        </div>
      </Section>
  );

  const termsSection = (
      <Section id="adjustments" title={termsSectionTitle} defaultOpen={isPartiesLayout}>
        {!hideAdjustmentAmounts ? (
          <div className="ib-grid">
            <Field label="CN amount">
              <input type="number" className={inputCls} value={form.adjustments?.cnAmount || 0} onChange={(e) => update('adjustments.cnAmount', e.target.value)} />
            </Field>
            <Field label="DN amount">
              <input type="number" className={inputCls} value={form.adjustments?.dnAmount || 0} onChange={(e) => update('adjustments.dnAmount', e.target.value)} />
            </Field>
            <Field label="Advance">
              <input type="number" className={inputCls} value={form.adjustments?.advanceReceived || 0} onChange={(e) => update('adjustments.advanceReceived', e.target.value)} />
            </Field>
          </div>
        ) : null}
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
  );

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

      {isPartiesLayout ? (
        <>
          {headerSection}
          {recipientSection}
          {shipToSection}
          {linesSection}
          {termsSection}
        </>
      ) : (
        <>
          {recipientSection}
          {headerSection}
          {shipToSection}
          {linesSection}
          {termsSection}
        </>
      )}
    </div>
  );
}
