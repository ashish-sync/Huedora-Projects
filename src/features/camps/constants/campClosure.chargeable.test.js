import { describe, expect, it } from 'vitest';
import {
  buildClosureDetails,
  buildClosurePayload,
  isClosureDetailsReady,
} from './campClosure';

describe('execution cancel Chargeable Status', () => {
  const executionCamp = {
    lifecycleStage: 'execution',
    chargeableStatus: 'Chargeable',
  };

  it('prefills Chargeable Status from the camp at execution', () => {
    const details = buildClosureDetails(executionCamp, 'execution');
    expect(details.chargeableStatus).toBe('Chargeable');
  });

  it('requires Chargeable Status before confirming execution cancel', () => {
    const details = {
      closureType: 'Cancelled by Client',
      reasonCategory: 'Client Decision',
      subReason: 'client_cancelled',
      remarks: '',
      chargeableStatus: '',
    };
    expect(isClosureDetailsReady(details, executionCamp, 'execution')).toBe(false);
    expect(isClosureDetailsReady({
      ...details,
      chargeableStatus: 'Non-Chargeable',
    }, executionCamp, 'execution')).toBe(true);
  });

  it('includes Chargeable Status in the close payload', () => {
    const payload = buildClosurePayload({
      closureType: 'Cancelled by Client',
      reasonCategory: 'Client Decision',
      subReason: 'client_cancelled',
      chargeableStatus: 'Partial',
    });
    expect(payload.chargeableStatus).toBe('Partial');
  });

  it('keeps Cancelled by Tylo → Other reason when camp/stage are omitted', () => {
    // Regression: payload builder used to default stage to request, wipe Other,
    // and the API then returned "Select a reason".
    const payload = buildClosurePayload({
      closureType: 'Cancelled by Tylo',
      reasonCategory: 'Other',
      subReason: 'other_mandatory_remarks',
      remarks: 'Duplicate Camp',
      chargeableStatus: 'Non-Chargeable',
    });
    expect(payload.closureType).toBe('Cancelled by Tylo');
    expect(payload.reasonCategory).toBe('Other');
    expect(payload.subReason).toBe('other_mandatory_remarks');
    expect(payload.closureRemarks).toBe('Duplicate Camp');
    expect(payload.chargeableStatus).toBe('Non-Chargeable');
  });

  it('keeps Cancelled by Tylo → Other with execution camp context', () => {
    const payload = buildClosurePayload({
      closureType: 'Cancelled by Tylo',
      reasonCategory: 'Other',
      subReason: 'other_mandatory_remarks',
      remarks: 'Duplicate Camp',
      chargeableStatus: 'Non-Chargeable',
    }, executionCamp, 'execution');
    expect(payload.reasonCategory).toBe('Other');
    expect(payload.subReason).toBe('other_mandatory_remarks');
  });

  it('does not require Chargeable Status at assignment', () => {
    const details = {
      closureType: 'Refused',
      reasonCategory: 'Request Issue',
      subReason: 'duplicate_request',
      remarks: '',
      chargeableStatus: '',
    };
    expect(isClosureDetailsReady(details, { lifecycleStage: 'assignment' }, 'assignment')).toBe(true);
  });
});
