import {
  amountInWordsIndian,
  computeInvoiceTotals,
  formatDisplayDate,
  formatInr,
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveLineGstRates,
  resolveTaxMode,
} from '../invoiceGenerator/invoiceCalculations.js';
import { InlineAddChip, InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import { defaultPoLineItem, MAX_PO_LINE_ITEMS } from './purchaseOrderStorage.js';
import { formatCompanyLetterhead } from '../shared/companyLetterhead.js';
import './purchase-order.css';

function money(n) {
  return formatInr(n);
}

function MetaCell({ label, children }) {
  return (
    <td>
      <span className="po-meta-label">{label}</span>
      <span className="po-meta-value">{children}</span>
    </td>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="po-field-row">
      <span className="po-field-label">{label}</span>
      <div className="po-field-value">{children}</div>
    </div>
  );
}

function Val({ editable, value, onChange, type = 'text', placeholder = '—' }) {
  if (editable) {
    return <InlineField type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} />;
  }
  if (type === 'date') return formatDisplayDate(value) || placeholder;
  return value || placeholder;
}

export default function PurchaseOrderPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  // Seller (vendor) vs buyer/company state → IGST or CGST+SGST
  const taxMode = resolveTaxMode(form.vendor?.stateCode, form.company?.stateCode);
  const normalizedLines = (form.lineItems || []).map((line) => ({
    ...line,
    ...resolveLineGstRates(line, taxMode),
  }));
  const totals = computeInvoiceTotals(normalizedLines, taxMode, {
    roundOff: form.roundOff,
  });
  const { company, buyer, vendor, delivery, billing, commercial, po, specialTerms, authorisation, vendorAcceptance } =
    form;
  const hasLogo = Boolean(company?.logoDataUrl);
  const legal = company?.legalName || '—';
  const lines = (form.lineItems?.length > 0 ? form.lineItems : [defaultPoLineItem()]).slice(
    0,
    MAX_PO_LINE_ITEMS
  );
  const words = amountInWordsIndian(totals.grandTotal);
  const canAddLine = editable && lines.length < MAX_PO_LINE_ITEMS;

  const lineTaxable = (line) =>
    Math.round(((Number(line.qty) || 0) * (Number(line.rate) || 0) - (Number(line.discount) || 0)) * 100) / 100;
  const letterhead = formatCompanyLetterhead(company, { variant: 'po-compact' });

  const specialTermRows = [
    { key: 'deliverySchedule', label: 'Delivery Schedule:' },
    { key: 'warranty', label: 'Warranty:' },
    { key: 'replacementPolicy', label: 'Replacement Policy:' },
    { key: 'penaltyClause', label: 'Penalty Clause:' },
    { key: 'inspection', label: 'Inspection:' },
    { key: 'documentation', label: 'Documentation:' },
    { key: 'otherInstructions', label: 'Other Instructions:' },
  ];

  const summaryRows = [
    { label: 'Gross Amount', value: money(totals.totalGrossAmount) },
    { label: 'Discount', value: money(totals.totalDiscount) },
    { label: 'Taxable Amount', value: money(totals.subtotal) },
    { label: 'CGST', value: money(totals.totalCgstAmount) },
    { label: 'SGST', value: money(totals.totalSgstAmount) },
    { label: 'IGST', value: money(totals.totalIgstAmount) },
  ];

  const authRoles = [
    { key: 'preparedBy', label: 'Prepared By' },
    { key: 'checkedBy', label: 'Checked By' },
    { key: 'approvedBy', label: 'Approved By' },
  ];
  const authFields = [
    { key: 'name', label: 'Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'signature', label: 'Signature' },
    { key: 'date', label: 'Date', type: 'date' },
  ];

  return (
    <div ref={previewRef} className="po-print-root">
      <article className="po-doc" aria-label="Purchase Order">
        <header className="po-header">
          <div className="po-header-brand">
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={legal} className="po-logo" />
            ) : (
              <div className="po-logo-fallback">
                <span className="po-logo-text">TYLO</span>
                <span className="po-tagline">{company?.brandLine || ''}</span>
              </div>
            )}
          </div>
          <div className="po-company po-company--compact">
            {letterhead.legalName ? (
              <p className="po-company-line1">
                <strong className="po-company-legal">{letterhead.legalName}</strong>
              </p>
            ) : null}
            {letterhead.line2 ? (
              <p className="po-company-line2 po-company-line2--single">{letterhead.line2}</p>
            ) : null}
          </div>
          <h1 className="po-title">PURCHASE ORDER</h1>
        </header>

        <table className="po-grid">
          <tbody>
            <tr>
              <MetaCell label="Purchase Order No.">
                {po?.documentNumber || (editable ? 'Assigned on approval' : '—')}
              </MetaCell>
              <MetaCell label="Purchase Order Date">
                <Val
                  editable={editable}
                  type="date"
                  value={po?.documentDate}
                  onChange={(v) => onUpdate?.('po.documentDate', v)}
                />
              </MetaCell>
              <MetaCell label="Revision No.">
                <Val
                  editable={editable}
                  value={po?.revisionNo ?? 0}
                  onChange={(v) => onUpdate?.('po.revisionNo', v)}
                />
              </MetaCell>
            </tr>
            <tr>
              <MetaCell label="Vendor Quote Ref.">
                <Val
                  editable={editable}
                  value={po?.vendorQuoteRef}
                  onChange={(v) => onUpdate?.('po.vendorQuoteRef', v)}
                />
              </MetaCell>
              <MetaCell label="Vendor Quote Date">
                <Val
                  editable={editable}
                  type="date"
                  value={po?.vendorQuoteDate}
                  onChange={(v) => onUpdate?.('po.vendorQuoteDate', v)}
                />
              </MetaCell>
              <MetaCell label="Project / Cost Centre / Dept.">
                <Val
                  editable={editable}
                  value={po?.projectCostCentre}
                  onChange={(v) => onUpdate?.('po.projectCostCentre', v)}
                />
              </MetaCell>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>BUYER DETAILS</th>
              <th style={{ width: '50%' }}>VENDOR DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="po-party-body">
                <FieldRow label="Company Name">{buyer?.companyName || legal || '—'}</FieldRow>
                <FieldRow label="Registered Office">{buyer?.address || '—'}</FieldRow>
                <FieldRow label="GSTIN">{buyer?.gstin || '—'}</FieldRow>
                <FieldRow label="Contact Name">
                  <Val
                    editable={editable}
                    value={buyer?.contactPerson}
                    onChange={(v) => onUpdate?.('buyer.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">{buyer?.mobile || '—'}</FieldRow>
                <FieldRow label="Email">{buyer?.email || '—'}</FieldRow>
              </td>
              <td className="po-party-body">
                <FieldRow label="Vendor Name">
                  <Val editable={editable} value={vendor?.name} onChange={(v) => onUpdate?.('vendor.name', v)} />
                </FieldRow>
                <FieldRow label="Vendor Code">
                  <Val editable={editable} value={vendor?.code} onChange={(v) => onUpdate?.('vendor.code', v)} />
                </FieldRow>
                <FieldRow label="Vendor Address">
                  {editable ? (
                    <InlineTextarea
                      value={vendor?.address || ''}
                      onChange={(v) => onUpdate?.('vendor.address', v)}
                      rows={2}
                    />
                  ) : (
                    vendor?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="GSTIN">
                  <Val editable={editable} value={vendor?.gstin} onChange={(v) => onUpdate?.('vendor.gstin', v)} />
                </FieldRow>
                <FieldRow label="Contact Name">
                  <Val
                    editable={editable}
                    value={vendor?.contactPerson}
                    onChange={(v) => onUpdate?.('vendor.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val editable={editable} value={vendor?.mobile} onChange={(v) => onUpdate?.('vendor.mobile', v)} />
                </FieldRow>
                <FieldRow label="Email">
                  <Val editable={editable} value={vendor?.email} onChange={(v) => onUpdate?.('vendor.email', v)} />
                </FieldRow>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>DELIVERY DETAILS</th>
              <th style={{ width: '50%' }}>BILLING DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="po-party-body">
                <FieldRow label="Delivery Address">
                  {editable ? (
                    <InlineTextarea
                      value={delivery?.address || ''}
                      onChange={(v) => onUpdate?.('delivery.address', v)}
                      rows={2}
                    />
                  ) : (
                    delivery?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="Delivery Contact">
                  <Val
                    editable={editable}
                    value={delivery?.contact}
                    onChange={(v) => onUpdate?.('delivery.contact', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val
                    editable={editable}
                    value={delivery?.mobile}
                    onChange={(v) => onUpdate?.('delivery.mobile', v)}
                  />
                </FieldRow>
                <FieldRow label="Expected Delivery Date">
                  <Val
                    editable={editable}
                    type="date"
                    value={delivery?.expectedDate}
                    onChange={(v) => onUpdate?.('delivery.expectedDate', v)}
                  />
                </FieldRow>
                <FieldRow label="Delivery Instructions">
                  <Val
                    editable={editable}
                    value={delivery?.instructions}
                    onChange={(v) => onUpdate?.('delivery.instructions', v)}
                  />
                </FieldRow>
              </td>
              <td className="po-party-body">
                <FieldRow label="Billing Address">{billing?.address || '—'}</FieldRow>
                <FieldRow label="GSTIN">{billing?.gstin || '—'}</FieldRow>
                <FieldRow label="State">{billing?.state || '—'}</FieldRow>
                <FieldRow label="State Code">{billing?.stateCode || '—'}</FieldRow>
                <FieldRow label="Place of Supply">{billing?.placeOfSupply || '—'}</FieldRow>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th colSpan={3}>COMMERCIAL DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <MetaCell label="Payment Terms">
                <Val
                  editable={editable}
                  value={commercial?.paymentTerms}
                  onChange={(v) => onUpdate?.('commercial.paymentTerms', v)}
                />
              </MetaCell>
              <MetaCell label="Freight">
                <Val
                  editable={editable}
                  value={commercial?.freight}
                  onChange={(v) => onUpdate?.('commercial.freight', v)}
                />
              </MetaCell>
              <MetaCell label="Insurance">
                <Val
                  editable={editable}
                  value={commercial?.insurance}
                  onChange={(v) => onUpdate?.('commercial.insurance', v)}
                />
              </MetaCell>
            </tr>
            <tr>
              <MetaCell label="Delivery Terms">
                <Val
                  editable={editable}
                  value={commercial?.deliveryTerms}
                  onChange={(v) => onUpdate?.('commercial.deliveryTerms', v)}
                />
              </MetaCell>
              <MetaCell label="Warranty">
                <Val
                  editable={editable}
                  value={commercial?.warranty}
                  onChange={(v) => onUpdate?.('commercial.warranty', v)}
                />
              </MetaCell>
              <MetaCell label="Validity">
                <Val
                  editable={editable}
                  value={commercial?.validity}
                  onChange={(v) => onUpdate?.('commercial.validity', v)}
                />
              </MetaCell>
            </tr>
          </tbody>
        </table>

        <table className="po-grid po-items">
          <colgroup>
            <col className="po-col-sr" />
            <col className="po-col-desc" />
            <col className="po-col-qty" />
            <col className="po-col-unit" />
            <col className="po-col-rate" />
            <col className="po-col-taxable" />
            <col className="po-col-gstrate" />
            <col className="po-col-gstamt" />
            <col className="po-col-total" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={9}>ITEM DETAILS</th>
            </tr>
            <tr>
              <th>Sr</th>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Rate (₹)</th>
              <th>Taxable Value (₹)</th>
              <th>GST Rate %</th>
              <th>GST Amount (₹)</th>
              <th>Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const taxable = lineTaxable(line);
              const computed = totals.lines[index] || {};
              const gstAmt = computed.taxAmount || 0;
              const total = computed.totalAmount || 0;
              const hasContent = Boolean(line.description || Number(line.qty) || Number(line.rate));
              return (
                <tr key={line.id || index}>
                  <td className="po-center">{index + 1}</td>
                  <td className="po-desc">
                    {editable ? (
                      <InlineTextarea
                        rows={Math.min(2, Math.max(1, String(line.description || '').split('\n').length))}
                        maxLines={2}
                        shiftEnterNewline
                        value={line.description || ''}
                        onChange={(v) => onUpdateLine?.(index, { description: v })}
                        placeholder="Item description"
                      />
                    ) : (
                      line.description
                    )}
                  </td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={line.qty ?? ''}
                        onChange={(v) => onUpdateLine?.(index, { qty: Number(v) })}
                        align="center"
                      />
                    ) : (
                      line.qty
                    )}
                  </td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={line.unit || line.uom || ''}
                        onChange={(v) => onUpdateLine?.(index, { unit: v, uom: v })}
                        align="center"
                      />
                    ) : (
                      line.unit || line.uom
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.rate ?? ''}
                        onChange={(v) => onUpdateLine?.(index, { rate: Number(v) })}
                        align="right"
                      />
                    ) : hasContent ? (
                      money(line.rate)
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="po-num">{hasContent ? money(taxable) : ''}</td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={getLineGstRateDisplay(line, taxMode)}
                        onChange={(v) => onUpdateLine?.(index, patchLineGstRate(v, taxMode))}
                        align="center"
                      />
                    ) : hasContent ? (
                      (() => {
                        const rate = getLineGstRateDisplay(line, taxMode);
                        return rate === '' || rate == null ? '—' : `${rate}%`;
                      })()
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="po-num">{hasContent ? money(gstAmt) : ''}</td>
                  <td className="po-num">{hasContent ? money(total) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canAddLine ? (
          <div className="po-add-row">
            <InlineAddChip label="Add item row" onClick={() => onAddLine?.()} />
          </div>
        ) : null}

        <div className="po-bottom">
          <div className="po-terms-summary">
            <div className="po-special-terms">
              <div className="po-block-head">SPECIAL TERMS &amp; CONDITIONS</div>
              <div className="po-term-list">
                {specialTermRows.map((row) => (
                  <div key={row.key} className="po-term-row">
                    <span className="po-term-label">{row.label}</span>
                    <div className="po-term-value">
                      {editable ? (
                        <InlineField
                          className="po-term-input"
                          value={specialTerms?.[row.key] || ''}
                          onChange={(v) => onUpdate?.(`specialTerms.${row.key}`, v)}
                          placeholder=" "
                        />
                      ) : (
                        <span className="po-term-text">{specialTerms?.[row.key] || ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <table className="po-order-summary">
              <thead>
                <tr>
                  <th colSpan={2}>ORDER SUMMARY</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.label}>
                    <td className="po-summary-label">{row.label}</td>
                    <td className="po-num">{row.value}</td>
                  </tr>
                ))}
                <tr>
                  <td className="po-summary-label">Round Off</td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={
                          form.roundOff !== undefined &&
                          form.roundOff !== null &&
                          String(form.roundOff).trim() !== ''
                            ? form.roundOff
                            : totals.roundOff
                        }
                        onChange={(v) => onUpdate?.('roundOff', v)}
                        align="right"
                        placeholder="0.00"
                      />
                    ) : (
                      money(totals.roundOff)
                    )}
                  </td>
                </tr>
                <tr className="po-summary-grand">
                  <td className="po-summary-label">Grand Total</td>
                  <td className="po-num">{money(totals.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="po-amount-words">
            <strong>Amount In Words:</strong> Rupees{' '}
            {words || '________________________________________________'} Only.
          </div>

          <table className="po-grid po-authorisation">
            <thead>
              <tr>
                <th colSpan={4}>AUTHORISATION (For {legal})</th>
              </tr>
              <tr className="po-auth-cols">
                <th className="po-auth-corner" aria-hidden="true" />
                {authRoles.map((role) => (
                  <th key={role.key}>{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {authFields.map((field) => (
                <tr key={field.key}>
                  <td className="po-auth-row-label">{field.label}</td>
                  {authRoles.map((role) => (
                    <td key={`${role.key}-${field.key}`}>
                      <Val
                        editable={editable}
                        type={field.type || 'text'}
                        value={authorisation?.[role.key]?.[field.key]}
                        onChange={(v) => onUpdate?.(`authorisation.${role.key}.${field.key}`, v)}
                        placeholder=" "
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <table className="po-grid po-vendor-accept">
            <thead>
              <tr>
                <th colSpan={4}>VENDOR ACCEPTANCE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="po-meta-label">Accepted By</span>
                  <span className="po-meta-value">
                    <Val
                      editable={editable}
                      value={vendorAcceptance?.acceptedBy}
                      onChange={(v) => onUpdate?.('vendorAcceptance.acceptedBy', v)}
                      placeholder=" "
                    />
                  </span>
                </td>
                <td>
                  <span className="po-meta-label">Designation</span>
                  <span className="po-meta-value">
                    <Val
                      editable={editable}
                      value={vendorAcceptance?.designation}
                      onChange={(v) => onUpdate?.('vendorAcceptance.designation', v)}
                      placeholder=" "
                    />
                  </span>
                </td>
                <td>
                  <span className="po-meta-label">Signature &amp; Company Seal</span>
                  <span className="po-meta-value">
                    <Val
                      editable={editable}
                      value={vendorAcceptance?.signature}
                      onChange={(v) => onUpdate?.('vendorAcceptance.signature', v)}
                      placeholder=" "
                    />
                  </span>
                </td>
                <td>
                  <span className="po-meta-label">Date</span>
                  <span className="po-meta-value">
                    <Val
                      editable={editable}
                      type="date"
                      value={vendorAcceptance?.date}
                      onChange={(v) => onUpdate?.('vendorAcceptance.date', v)}
                      placeholder=" "
                    />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
