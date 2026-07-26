import { InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import { MAX_PO_LINE_ITEMS } from './purchaseOrderStorage.js';
import './purchase-order.css';

function formatInr(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrderPreview({
  form,
  totals,
  previewRef,
  editable = true,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  const company = form.company || {};
  const companyName = company.legalName || 'Your company name';
  const companyAddress = company.registeredOffice || '';
  const hasLogo = Boolean(company.logoDataUrl);

  return (
    <div ref={previewRef} className="invoice-print-root">
      <article className="po-document" aria-label="Purchase order">
        <header className="po-header">
          <div>
            {hasLogo ? (
              <img src={company.logoDataUrl} alt="" className="po-logo" />
            ) : (
              <div className="po-logo-placeholder">Add company logo</div>
            )}
            <div className="po-company-name">{companyName}</div>
            {companyAddress ? <div className="po-company-address">{companyAddress}</div> : null}
          </div>
          <div className="po-title-block">
            <h1 className="po-title">PURCHASE ORDER</h1>
            <div className="po-doc-no">
              <span className="po-meta-label">PO No</span>
              {editable ? (
                <InlineField value={form.documentNumber} onChange={(v) => onUpdate?.('documentNumber', v)} placeholder="TCPO-26-07-001" />
              ) : (
                form.documentNumber || '—'
              )}
            </div>
          </div>
        </header>

        <div className="po-vendor-block">
          <div className="po-label">Vendor</div>
          {editable ? (
            <>
              <InlineField
                value={form.vendorName}
                onChange={(v) => onUpdate?.('vendorName', v)}
                placeholder="Vendor name or company"
              />
              <InlineTextarea
                value={form.vendorAddress}
                onChange={(v) => onUpdate?.('vendorAddress', v)}
                placeholder="Vendor address"
                rows={2}
              />
              <InlineField
                value={form.vendorGstin}
                onChange={(v) => onUpdate?.('vendorGstin', v)}
                placeholder="Vendor GSTIN (optional)"
              />
            </>
          ) : (
            <>
              <div className="po-vendor-name">{form.vendorName || '—'}</div>
              <div>{form.vendorAddress}</div>
              {form.vendorGstin ? <div>GSTIN: {form.vendorGstin}</div> : null}
            </>
          )}
        </div>

        <div className="po-meta-row">
          <div>
            <span className="po-meta-label">Order date</span>
            {editable ? (
              <InlineField type="date" value={form.documentDate} onChange={(v) => onUpdate?.('documentDate', v)} />
            ) : (
              form.documentDate
            )}
          </div>
          <div>
            <span className="po-meta-label">Delivery date</span>
            {editable ? (
              <InlineField type="date" value={form.dueDate} onChange={(v) => onUpdate?.('dueDate', v)} />
            ) : (
              form.dueDate || '—'
            )}
          </div>
          <div>
            <span className="po-meta-label">Tax %</span>
            {editable ? (
              <InlineField
                value={form.purchaseTaxRate}
                onChange={(v) => onUpdate?.('purchaseTaxRate', v)}
                placeholder="18"
              />
            ) : (
              `${form.purchaseTaxRate}%`
            )}
          </div>
        </div>

        <table className="po-table">
          <thead>
            <tr>
              <th>Item description</th>
              <th className="po-num">Qty</th>
              <th className="po-num">Rate (₹)</th>
              <th className="po-num">FOC</th>
              <th className="po-num">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {form.lineItems.map((line, index) => {
              const qty = Number(line.qty) || 0;
              const rate = line.isFoc ? 0 : Number(line.rate) || 0;
              const amount = qty * rate;
              return (
                <tr key={line.id || index}>
                  <td>
                    {editable ? (
                      <InlineTableInput
                        value={line.description}
                        onChange={(v) => onUpdateLine?.(index, { description: v })}
                        placeholder="Item description"
                      />
                    ) : (
                      line.description
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.qty}
                        onChange={(v) => onUpdateLine?.(index, { qty: v })}
                        placeholder="1"
                        align="right"
                      />
                    ) : (
                      qty
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.rate}
                        onChange={(v) => onUpdateLine?.(index, { rate: v })}
                        placeholder="0.00"
                        align="right"
                      />
                    ) : (
                      formatInr(rate)
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.isFoc ? 'Yes' : 'No'}
                        onChange={(v) => onUpdateLine?.(index, { isFoc: String(v).toLowerCase().startsWith('y') })}
                        align="center"
                      />
                    ) : (
                      line.isFoc ? 'Yes' : 'No'
                    )}
                  </td>
                  <td className="po-num">{formatInr(amount)}</td>
                </tr>
              );
            })}
            {editable && form.lineItems.length < MAX_PO_LINE_ITEMS ? (
              <tr className="ei-add-line-row">
                <td colSpan={5}>
                  <button type="button" className="ei-add-line-btn" onClick={onAddLine}>
                    + Add line item
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="po-num">
                Subtotal
              </td>
              <td className="po-num">₹ {formatInr(totals.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="po-num">
                Tax
              </td>
              <td className="po-num">₹ {formatInr(totals.tax)}</td>
            </tr>
            <tr className="po-total-row">
              <td colSpan={4} className="po-num">
                <strong>Total</strong>
              </td>
              <td className="po-num">
                <strong>₹ {formatInr(totals.total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <footer className="po-footer">
          {editable ? (
            <InlineTextarea
              value={form.notes}
              onChange={(v) => onUpdate?.('notes', v)}
              placeholder="It was great doing business with you."
              rows={2}
            />
          ) : (
            form.notes
          )}
          <p className="po-terms">
            Upon accepting this purchase order, you agree to the terms &amp; conditions.
          </p>
        </footer>
      </article>
    </div>
  );
}
