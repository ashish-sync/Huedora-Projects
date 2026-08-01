import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';

/** Camp form text/number/time input with password-manager autofill suppression. */
export function CampFormInput(props) {
  return <input {...bindAutofillBlock(props)} />;
}
