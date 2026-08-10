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
