import LocationCascade from '../../components/ui/LocationCascade.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { HEALTHCARE_WORKER_PROFESSIONS } from './contactPicklists.js';

export function emptyProviderEmployee() {
  return {
    id: crypto.randomUUID(),
    name: '',
    mobile: '',
    profession: '',
  };
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
          <div className="field">
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
              afterCity={(
                <>
                  <label>Camp Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    disabled={disabled}
                    value={form.campAmount ?? ''}
                    onChange={(e) => onChange({ campAmount: e.target.value })}
                    placeholder="Shows in Camp Payout when assigned"
                  />
                </>
              )}
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
          Map staff under this provider for reporting and assignments. Camp pickers still use full
          Healthcare Worker contacts when needed.
        </p>
        {employees.length > 0 ? (
          <ul className="cd-employee-list">
            {employees.map((emp, index) => (
              <li key={emp.id || index} className="cd-employee-row">
                <div className="cd-employee-fields">
                  <div className="field">
                    <label>Employee Name *</label>
                    <input
                      required
                      disabled={disabled}
                      value={emp.name}
                      onChange={(e) => updateEmployee(index, { name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="field">
                    <label>Mobile Number *</label>
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
                </div>
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
