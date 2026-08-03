/** Hidden username/password pair to absorb Google Password Manager on business forms. */
export function AutofillDecoyFields() {
  return (
    <div className="autofill-decoy-fields" aria-hidden="true">
      <input
        type="text"
        name="username"
        autoComplete="username"
        tabIndex={-1}
        data-autofill-decoy="true"
        readOnly
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        tabIndex={-1}
        data-autofill-decoy="true"
        readOnly
      />
    </div>
  );
}
