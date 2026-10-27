import LocationCascade from '../../components/ui/LocationCascade.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { HEALTHCARE_WORKER_PROFESSIONS } from './contactPicklists.js';

export function emptyProviderEmployee() {
  return {
    id: crypto.randomUUID(),
    name: '',
    mobile: '',
    profession: '',
    campAmount: '',
  };
}

/** Copy a legacy agency-level Camp Amount onto employees that do not have their own rate. */
export function hydrateProviderEmployeesForForm(employees = [], providerCampAmount) {
  const list = Array.isArray(employees) ? employees : [];
  const inherited = Number(providerCampAmount);
  const carry = Number.isFinite(inherited) && inherited > 0 ? inherited : 0;
  return list.map((emp) => {
    const own = Number(emp?.campAmount);
    const amount = Number.isFinite(own) && own > 0 ? own : carry;
    return {
      ...emp,
      campAmount: amount ? String(amount) : (emp?.campAmount === 0 || emp?.campAmount === '0' ? '0' : ''),
    };
  });
}

export default function ServiceProviderProfile({
  form,
  onChange,
  onEmployeesChange,
  professionOptions = HEALTHCARE_WORKER_PROFESSIONS,
  disabled = false,
}) {
  const employees = Array.isArray(form.providerEmployees) ? form.providerEmployees : [];

  const updateEmployee = (index, patch) => {
    const next = employees.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onEmployeesChange(next);
  };

  const addEmployee = () => {
    onEmployeesChange([...employees, emptyProviderEmployee()]);
  };

  const removeEmployee = (index) => {
    onEmployeesChange(employees.filter((_, i) => i !== index));
  };

  return (
    <>
      <section className="cd-section">
        <h4 className="cd-section-title">Provider profile</h4>
        <p className="cd-form-hint">Service provider agency details.</p>
        <div className="cd-form-grid">
          <div className="field cd-span-2">
            <label>Name *</label>
            <input
              required
              disabled={disabled}
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Agency / provider name"
            />
          </div>
          <div className="field cd-span-2">
            <label>Mobile Number *</label>
            <input
              required
              disabled={disabled}
              inputMode="tel"
              value={form.contact}
              onChange={(e) => onChange({ contact: e.target.value })}
              placeholder="10-digit mobile"
            />
          </div>
          <div className="cd-span-2 cd-provider-state">
            <LocationCascade
              value={{
                stateId: form.stateId || '',
                districtId: form.districtId || '',
                cityId: form.cityId || '',
                state: form.state || '',
                district: form.district || '',
                city: form.city || '',
                pinCode: form.pinCode || '',
              }}
              onChange={(loc) =>
                onChange({
                  stateId: loc.stateId ?? '',
                  districtId: loc.districtId ?? '',
                  cityId: loc.cityId ?? '',
                  state: loc.state ?? '',
                  district: loc.district ?? '',
                  city: loc.city ?? '',
                  pinCode: loc.pinCode ?? '',
                })
              }
              showDistrict={false}
              showPin
              pinFirst
              pinInputOnly
              disabled={disabled}
              required
              labels={{ state: 'State', city: 'City / District' }}
            />
          </div>
        </div>
      </section>

      {/* Address, banking, and KYC live in Contact Directory "Address & banking"
          so Service Providers do not see those fields twice. */}

      <section className="cd-section">
        <div className="cd-employee-head">
          <h4 className="cd-section-title">Employees</h4>
          {!disabled && (
            <button type="button" className="btn btn-secondary btn-compact" onClick={addEmployee}>
              + Add employee
            </button>
          )}
        </div>
        <p className="cd-form-hint">
          Camp Amount becomes Camp Payout in Camp One when this person is assigned.
        </p>
        {employees.length > 0 ? (
          <ul className="cd-employee-list">
            {employees.map((emp, index) => (
              <li key={emp.id || index} className="cd-employee-card">
                <div className="cd-employee-card-head">
                  <span className="cd-employee-card-title">
                    {emp.name?.trim() || `Employee ${index + 1}`}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      className="inv-link cd-employee-remove"
                      onClick={() => removeEmployee(index)}
                      aria-label={`Remove employee ${emp.name || index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="cd-employee-fields">
                  <div className="field">
                    <label>Name *</label>
                    <input
                      required
                      disabled={disabled}
                      value={emp.name}
                      onChange={(e) => updateEmployee(index, { name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="field">
                    <label>Mobile *</label>
                    <input
                      required
                      disabled={disabled}
                      inputMode="tel"
                      value={emp.mobile}
                      onChange={(e) => updateEmployee(index, { mobile: e.target.value })}
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div className="field">
                    <label>Profession / Role</label>
                    <OtherAwareSelect
                      disabled={disabled}
                      picklistKey="contact.profession.healthcareWorker"
                      source="contact-directory"
                      options={professionOptions}
                      value={emp.profession}
                      onChange={(e) => updateEmployee(index, { profession: e.target.value })}
                    />
                  </div>
                  <div className="field cd-employee-amount">
                    <label>Camp Amount</label>
                    <div className="cd-amount-input">
                      <span className="cd-amount-prefix" aria-hidden="true">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={disabled}
                        value={emp.campAmount ?? ''}
                        onChange={(e) => updateEmployee(index, { campAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted cd-staff-empty">No employees added yet.</p>
        )}
        {employees.length > 0 ? (
          <p className="cd-staff-count">{employees.length} employee(s)</p>
        ) : null}
      </section>
    </>
  );
}
