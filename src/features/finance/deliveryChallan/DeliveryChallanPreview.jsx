import { formatDisplayDate } from '../invoiceGenerator/invoiceCalculations.js';
import { InlineAddChip, InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import {
  defaultDeliveryChallanLine,
  DELIVERY_CHALLAN_DECLARATION,
  MAX_DELIVERY_CHALLAN_LINE_ITEMS,
} from './deliveryChallanStorage.js';
import './delivery-challan.css';

function FieldRow({ label, children }) {
  return (
    <div className="dc-field-row">
      <span className="dc-field-label">{label}</span>
      <div className="dc-field-value">{children}</div>
    </div>
  );
}

function Val({ editable, value, onChange, type = 'text', placeholder = '—' }) {
  if (editable) {
    return <InlineField type={type} value={value || ''} onChange={onChange} placeholder={placeholder} />;
  }
  if (type === 'date') return formatDisplayDate(value) || placeholder;
  return value || placeholder;
}

function digitsOnly(value, maxLen) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, maxLen);
}

function SigRow({ label, children }) {
  return (
    <div className="dc-sig-row">
      <span className="dc-sig-label">{label}</span>
      <div className="dc-sig-value">{children}</div>
    </div>
  );
}

export default function DeliveryChallanPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  const { company, invoice, from, deliverTo, courier, dispatch, acknowledgement } = form;
  const hasLogo = Boolean(company?.logoDataUrl);
  const legal = company?.legalName || '—';
  const lines =
    form.lineItems?.length > 0 ? form.lineItems : [defaultDeliveryChallanLine()];
  const canAddLine = lines.length < MAX_DELIVERY_CHALLAN_LINE_ITEMS;

  return (
    <div ref={previewRef} className="dc-print-root">
      <article className="dc-doc" aria-label="Delivery Challan">
        <div className="dc-aligned-top">
          <div className="dc-header-brand">
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={legal} className="dc-logo" />
            ) : (
              <div className="dc-logo-fallback">
                <span className="dc-logo-text">TYLO</span>
                <span className="dc-tagline">{company?.brandLine || ''}</span>
              </div>
            )}
          </div>
          <div className="dc-meta-stack dc-meta-stack--left">
            <div className="dc-header-meta-cell">
              <span className="dc-meta-label">Delivery Challan No.</span>
              <span className="dc-meta-value">
                {invoice?.documentNumber || (editable ? 'Assigned on approval' : '—')}
              </span>
            </div>
            <div className="dc-header-meta-cell">
              <span className="dc-meta-label">Dispatch Date</span>
              <span className="dc-meta-value">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.dispatchDate}
                  onChange={(v) => onUpdate?.('invoice.dispatchDate', v)}
                />
              </span>
            </div>
          </div>
          <div className="dc-meta-stack dc-meta-stack--right">
            <div className="dc-header-meta-cell">
              <span className="dc-meta-label">Delivery Challan Date</span>
              <span className="dc-meta-value">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.issueDate}
                  onChange={(v) => onUpdate?.('invoice.issueDate', v)}
                />
              </span>
            </div>
            <div className="dc-header-meta-cell">
              <span className="dc-meta-label">Expected Delivery Date</span>
              <span className="dc-meta-value">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.expectedDeliveryDate}
                  onChange={(v) => onUpdate?.('invoice.expectedDeliveryDate', v)}
                />
              </span>
            </div>
          </div>
          <h1 className="dc-title">DELIVERY CHALLAN</h1>

          <div className="dc-party-block dc-party-block--from">
            <div className="dc-party-head">FROM</div>
            <div className="dc-party-body">
              <FieldRow label="Company Name">{from?.companyName || legal || '—'}</FieldRow>
              <FieldRow label="Registered Office">{from?.address || '—'}</FieldRow>
              <FieldRow label="GSTIN">{from?.gstin || '—'}</FieldRow>
              <FieldRow label="Contact Name">
                <Val
                  editable={editable}
                  value={from?.contactPerson}
                  onChange={(v) => onUpdate?.('from.contactPerson', v)}
                />
              </FieldRow>
              <FieldRow label="Mobile">{from?.mobile || '—'}</FieldRow>
              <FieldRow label="Email">{from?.email || '—'}</FieldRow>
            </div>
          </div>
          <div className="dc-party-block dc-party-block--to">
            <div className="dc-party-head">DELIVER TO</div>
            <div className="dc-party-body">
              <FieldRow label="Recipient Type">
                <Val
                  editable={editable}
                  value={deliverTo?.recipientType}
                  onChange={(v) => onUpdate?.('deliverTo.recipientType', v)}
                />
              </FieldRow>
              <FieldRow label="Name">
                <Val
                  editable={editable}
                  value={deliverTo?.name}
                  onChange={(v) => onUpdate?.('deliverTo.name', v)}
                />
              </FieldRow>
              <FieldRow label="Company (if applicable)">
                <Val
                  editable={editable}
                  value={deliverTo?.company}
                  onChange={(v) => onUpdate?.('deliverTo.company', v)}
                />
              </FieldRow>
              <FieldRow label="Contact Name">
                <Val
                  editable={editable}
                  value={deliverTo?.contactPerson}
                  onChange={(v) => onUpdate?.('deliverTo.contactPerson', v)}
                />
              </FieldRow>
              <FieldRow label="Mobile">
                <Val
                  editable={editable}
                  value={deliverTo?.mobile}
                  onChange={(v) => onUpdate?.('deliverTo.mobile', v)}
                />
              </FieldRow>
              <FieldRow label="Address">
                {editable ? (
                  <InlineTextarea
                    value={deliverTo?.address || ''}
                    onChange={(v) => onUpdate?.('deliverTo.address', v)}
                    rows={2}
                  />
                ) : (
                  deliverTo?.address || '—'
                )}
              </FieldRow>
            </div>
          </div>
        </div>

        <table className="dc-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>COURIER DETAILS</th>
              <th style={{ width: '50%' }}>PURPOSE OF MOVEMENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <FieldRow label="Courier Name">
                  <Val
                    editable={editable}
                    value={courier?.name}
                    onChange={(v) => onUpdate?.('courier.name', v)}
                  />
                </FieldRow>
                <FieldRow label="AWB / Consignment No.">
                  <Val
                    editable={editable}
                    value={courier?.awbNo}
                    onChange={(v) => onUpdate?.('courier.awbNo', v)}
                  />
                </FieldRow>
                <FieldRow label="Mode (Air / Surface)">
                  <Val
                    editable={editable}
                    value={courier?.mode}
                    onChange={(v) => onUpdate?.('courier.mode', v)}
                  />
                </FieldRow>
                <FieldRow label="No. of Packages">
                  <Val
                    editable={editable}
                    value={courier?.packageCount}
                    onChange={(v) => onUpdate?.('courier.packageCount', v)}
                  />
                </FieldRow>
                <FieldRow label="Origin / Dispatch City">
                  <Val
                    editable={editable}
                    value={courier?.originCity}
                    onChange={(v) => onUpdate?.('courier.originCity', v)}
                  />
                </FieldRow>
                <FieldRow label="Destination City">
                  <Val
                    editable={editable}
                    value={courier?.destinationCity}
                    onChange={(v) => onUpdate?.('courier.destinationCity', v)}
                  />
                </FieldRow>
              </td>
              <td className="dc-purpose-cell">
                {editable ? (
                  <InlineTextarea
                    value={form.purposeOfMovement || ''}
                    onChange={(v) => onUpdate?.('purposeOfMovement', v)}
                    rows={3}
                    placeholder="Purpose of movement…"
                  />
                ) : (
                  form.purposeOfMovement || '—'
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid dc-items">
          <colgroup>
            <col className="dc-col-sr" />
            <col className="dc-col-asset" />
            <col className="dc-col-desc" />
            <col className="dc-col-make" />
            <col className="dc-col-model" />
            <col className="dc-col-serial" />
            <col className="dc-col-qty" />
            <col className="dc-col-accessories" />
            <col className="dc-col-condition" />
            <col className="dc-col-remarks" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={10}>ITEM DETAILS</th>
            </tr>
            <tr>
              <th>Sr</th>
              <th>Asset ID</th>
              <th>Description</th>
              <th>Make</th>
              <th>Model</th>
              <th>Manufacturer Serial No.</th>
              <th>Qty</th>
              <th>Accessories Supplied</th>
              <th>Condition</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="dc-center">{index + 1}</td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.assetId || ''}
                      onChange={(v) => onUpdateLine?.(index, { assetId: v })}
                    />
                  ) : (
                    line.assetId
                  )}
                </td>
                <td className="dc-desc">
                  {editable ? (
                    <InlineTextarea
                      rows={2}
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
                <td>
                  {editable ? (
                    <InlineTableInput value={line.make || ''} onChange={(v) => onUpdateLine?.(index, { make: v })} />
                  ) : (
                    line.make
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.model || ''}
                      onChange={(v) => onUpdateLine?.(index, { model: v })}
                    />
                  ) : (
                    line.model
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.manufacturerSerialNo || ''}
                      onChange={(v) => onUpdateLine?.(index, { manufacturerSerialNo: v })}
                    />
                  ) : (
                    line.manufacturerSerialNo
                  )}
                </td>
                <td className="dc-center">
                  {editable ? (
                    <InlineTableInput
                      value={line.qty ?? ''}
                      onChange={(v) => onUpdateLine?.(index, { qty: v })}
                      align="center"
                    />
                  ) : (
                    line.qty
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.accessories || ''}
                      onChange={(v) => onUpdateLine?.(index, { accessories: v })}
                    />
                  ) : (
                    line.accessories
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.condition || ''}
                      onChange={(v) => onUpdateLine?.(index, { condition: v })}
                    />
                  ) : (
                    line.condition
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.remarks || ''}
                      onChange={(v) => onUpdateLine?.(index, { remarks: v })}
                    />
                  ) : (
                    line.remarks
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && canAddLine ? (
          <div className="dc-add-row">
            <InlineAddChip label="Add item row" onClick={() => onAddLine?.()} />
          </div>
        ) : null}

        <table className="dc-grid">
          <thead>
            <tr>
              <th>DECLARATION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dc-declaration">{form.declaration || DELIVERY_CHALLAN_DECLARATION}</td>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th colSpan={3}>DISPATCH DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {[
                ['Packed By', 'dispatch.packedBy', dispatch?.packedBy],
                ['Checked By', 'dispatch.checkedBy', dispatch?.checkedBy],
                ['Dispatched By', 'dispatch.dispatchedBy', dispatch?.dispatchedBy],
              ].map(([label, path, value]) => (
                <td key={path} className="dc-dispatch-cell" style={{ width: '33.33%' }}>
                  <div className="dc-sig-row">
                    <span className="dc-sig-label">{label}</span>
                    <div className="dc-sig-value">
                      <Val editable={editable} value={value} onChange={(v) => onUpdate?.(path, v)} />
                    </div>
                  </div>
                  <div className="dc-sig-row">
                    <span className="dc-sig-label">Signature</span>
                    <div className="dc-sig-value dc-sig-line" aria-hidden="true" />
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th colSpan={3}>RECEIVER ACKNOWLEDGEMENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dc-dispatch-cell" style={{ width: '36%' }}>
                <SigRow label="Received By">
                  <Val
                    editable={editable}
                    value={acknowledgement?.receivedBy}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedBy', v)}
                  />
                </SigRow>
              </td>
              <td className="dc-dispatch-cell" style={{ width: '36%' }}>
                <SigRow label="Mobile">
                  <Val
                    editable={editable}
                    value={acknowledgement?.receivedMobile}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedMobile', digitsOnly(v, 10))}
                    placeholder="10 digits"
                  />
                </SigRow>
              </td>
              <td rowSpan={2} className="dc-qr" style={{ width: '28%' }}>
                QR CODE
                <br />
                (Future Use)
              </td>
            </tr>
            <tr>
              <td className="dc-dispatch-cell">
                <SigRow label="Condition on Receipt">
                  <Val
                    editable={editable}
                    value={acknowledgement?.conditionOnReceipt}
                    onChange={(v) => onUpdate?.('acknowledgement.conditionOnReceipt', v)}
                  />
                </SigRow>
              </td>
              <td className="dc-dispatch-cell">
                <SigRow label="Date">
                  <Val
                    editable={editable}
                    type="date"
                    value={acknowledgement?.receivedDate}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedDate', v)}
                  />
                </SigRow>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}
