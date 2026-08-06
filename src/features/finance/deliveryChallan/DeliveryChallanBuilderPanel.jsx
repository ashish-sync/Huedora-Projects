import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { canManageOrganisationMaster } from '../builder/commercialApproval.js';
import ClientMasterRecipientPicker from '../builder/ClientMasterRecipientPicker.jsx';
import { MAX_DELIVERY_CHALLAN_LINE_ITEMS } from './deliveryChallanStorage.js';

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

export default function DeliveryChallanBuilderPanel({
  form,
  update,
  updateLine,
  addLine,
  removeLine,
  applyClientMasterRecipient,
  clearClientMasterRecipient,
}) {
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);
  const lines = form.lineItems || [];

  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Letterhead comes from{' '}
          {canOrgMaster ? (
            <Link to="/finance-one/organisation" className="ib-link">
              Organisation master
            </Link>
          ) : (
            'Organisation master'
          )}
          . Edit the document on the preview, or use the fields below.
        </p>
      </div>

      <Section title="Delivery challan" defaultOpen>
        <div className="ib-fields">
          <Field label="Delivery challan no.">
            <input
              className={inputCls}
              value={form.invoice?.documentNumber || ''}
              readOnly
              placeholder="Assigned on approval"
            />
          </Field>
          <Field label="Challan date">
            <input
              type="date"
              className={inputCls}
              value={form.invoice?.issueDate || ''}
              onChange={(e) => update('invoice.issueDate', e.target.value)}
            />
          </Field>
          <Field label="Dispatch date">
            <input
              type="date"
              className={inputCls}
              value={form.invoice?.dispatchDate || ''}
              onChange={(e) => update('invoice.dispatchDate', e.target.value)}
            />
          </Field>
          <Field label="Expected delivery">
            <input
              type="date"
              className={inputCls}
              value={form.invoice?.expectedDeliveryDate || ''}
              onChange={(e) => update('invoice.expectedDeliveryDate', e.target.value)}
            />
          </Field>
          <Field label="Purpose of movement" span={2}>
            <textarea
              className={inputCls}
              rows={3}
              value={form.purposeOfMovement || ''}
              onChange={(e) => update('purposeOfMovement', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Deliver to" defaultOpen badge={form.deliverTo?.name ? 1 : 0}>
        <ClientMasterRecipientPicker
          value={form.clientMasterId || ''}
          onPick={(_row, patch) => applyClientMasterRecipient(patch)}
          onClear={() => clearClientMasterRecipient?.()}
        />
        <div className="ib-fields">
          <Field label="Recipient type">
            <input
              className={inputCls}
              value={form.deliverTo?.recipientType || ''}
              onChange={(e) => update('deliverTo.recipientType', e.target.value)}
            />
          </Field>
          <Field label="Name">
            <input
              className={inputCls}
              value={form.deliverTo?.name || ''}
              onChange={(e) => update('deliverTo.name', e.target.value)}
            />
          </Field>
          <Field label="Company">
            <input
              className={inputCls}
              value={form.deliverTo?.company || ''}
              onChange={(e) => update('deliverTo.company', e.target.value)}
            />
          </Field>
          <Field label="Contact person">
            <input
              className={inputCls}
              value={form.deliverTo?.contactPerson || ''}
              onChange={(e) => update('deliverTo.contactPerson', e.target.value)}
            />
          </Field>
          <Field label="Mobile">
            <input
              className={inputCls}
              value={form.deliverTo?.mobile || ''}
              onChange={(e) => update('deliverTo.mobile', e.target.value)}
            />
          </Field>
          <Field label="Address" span={2}>
            <textarea
              className={inputCls}
              rows={2}
              value={form.deliverTo?.address || ''}
              onChange={(e) => update('deliverTo.address', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Courier" badge={form.courier?.name || form.courier?.awbNo ? 1 : 0}>
        <div className="ib-fields">
          <Field label="Courier name">
            <input
              className={inputCls}
              value={form.courier?.name || ''}
              onChange={(e) => update('courier.name', e.target.value)}
            />
          </Field>
          <Field label="AWB / Consignment no.">
            <input
              className={inputCls}
              value={form.courier?.awbNo || ''}
              onChange={(e) => update('courier.awbNo', e.target.value)}
            />
          </Field>
          <Field label="Mode">
            <input
              className={inputCls}
              value={form.courier?.mode || ''}
              onChange={(e) => update('courier.mode', e.target.value)}
              placeholder="Air / Surface"
            />
          </Field>
          <Field label="No. of packages">
            <input
              className={inputCls}
              value={form.courier?.packageCount ?? ''}
              onChange={(e) => update('courier.packageCount', e.target.value)}
            />
          </Field>
          <Field label="Origin city">
            <input
              className={inputCls}
              value={form.courier?.originCity || ''}
              onChange={(e) => update('courier.originCity', e.target.value)}
            />
          </Field>
          <Field label="Destination city">
            <input
              className={inputCls}
              value={form.courier?.destinationCity || ''}
              onChange={(e) => update('courier.destinationCity', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Items" defaultOpen badge={lines.length}>
        {lines.map((line, index) => (
          <div key={index} className="ib-line-card">
            <div className="ib-line-card-head">
              <span>Item {index + 1}</span>
              {lines.length > 1 ? (
                <button type="button" className="ib-text-btn" onClick={() => removeLine(index)}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="ib-fields">
              <Field label="Asset ID">
                <input
                  className={inputCls}
                  value={line.assetId || ''}
                  onChange={(e) => updateLine(index, { assetId: e.target.value })}
                />
              </Field>
              <Field label="Qty">
                <input
                  className={inputCls}
                  value={line.qty ?? ''}
                  onChange={(e) => updateLine(index, { qty: e.target.value })}
                />
              </Field>
              <Field label="Description" span={2}>
                <input
                  className={inputCls}
                  value={line.description || ''}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                />
              </Field>
              <Field label="Make">
                <input
                  className={inputCls}
                  value={line.make || ''}
                  onChange={(e) => updateLine(index, { make: e.target.value })}
                />
              </Field>
              <Field label="Model">
                <input
                  className={inputCls}
                  value={line.model || ''}
                  onChange={(e) => updateLine(index, { model: e.target.value })}
                />
              </Field>
              <Field label="Manufacturer serial no." span={2}>
                <input
                  className={inputCls}
                  value={line.manufacturerSerialNo || ''}
                  onChange={(e) => updateLine(index, { manufacturerSerialNo: e.target.value })}
                />
              </Field>
              <Field label="Accessories">
                <input
                  className={inputCls}
                  value={line.accessories || ''}
                  onChange={(e) => updateLine(index, { accessories: e.target.value })}
                />
              </Field>
              <Field label="Condition">
                <input
                  className={inputCls}
                  value={line.condition || ''}
                  onChange={(e) => updateLine(index, { condition: e.target.value })}
                />
              </Field>
              <Field label="Remarks" span={2}>
                <input
                  className={inputCls}
                  value={line.remarks || ''}
                  onChange={(e) => updateLine(index, { remarks: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        {lines.length < MAX_DELIVERY_CHALLAN_LINE_ITEMS ? (
          <button type="button" className="ib-add-line" onClick={addLine}>
            + Add item {lines.length >= MAX_DELIVERY_CHALLAN_LINE_ITEMS ? `(max ${MAX_DELIVERY_CHALLAN_LINE_ITEMS})` : ''}
          </button>
        ) : null}
      </Section>

      <Section title="Dispatch & acknowledgement">
        <div className="ib-fields">
          <Field label="Packed by">
            <input
              className={inputCls}
              value={form.dispatch?.packedBy || ''}
              onChange={(e) => update('dispatch.packedBy', e.target.value)}
            />
          </Field>
          <Field label="Checked by">
            <input
              className={inputCls}
              value={form.dispatch?.checkedBy || ''}
              onChange={(e) => update('dispatch.checkedBy', e.target.value)}
            />
          </Field>
          <Field label="Dispatched by">
            <input
              className={inputCls}
              value={form.dispatch?.dispatchedBy || ''}
              onChange={(e) => update('dispatch.dispatchedBy', e.target.value)}
            />
          </Field>
          <Field label="Received by">
            <input
              className={inputCls}
              value={form.acknowledgement?.receivedBy || ''}
              onChange={(e) => update('acknowledgement.receivedBy', e.target.value)}
            />
          </Field>
          <Field label="Received mobile">
            <input
              className={inputCls}
              value={form.acknowledgement?.receivedMobile || ''}
              onChange={(e) => update('acknowledgement.receivedMobile', e.target.value)}
            />
          </Field>
          <Field label="Condition on receipt">
            <input
              className={inputCls}
              value={form.acknowledgement?.conditionOnReceipt || ''}
              onChange={(e) => update('acknowledgement.conditionOnReceipt', e.target.value)}
            />
          </Field>
          <Field label="Received date">
            <input
              type="date"
              className={inputCls}
              value={form.acknowledgement?.receivedDate || ''}
              onChange={(e) => update('acknowledgement.receivedDate', e.target.value)}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
