import {
  GOODS_ISSUE_PIPELINE_STAGES,
  resolveGoodsIssuePipelineStage,
} from './logisticsTxnShared.jsx';

/**
 * Compact horizontal stepper for Goods Issuance lifecycle.
 * currentIndex = next action stage (completed stages are 0..index-1).
 * Pass `legend` to show the full pipeline as a reference (no active step).
 */
export default function GoodsIssuePipeline({
  requestStatus = '',
  packageStatus = '',
  dispatchStatus = '',
  podBookedAt = '',
  deliveryOutcome = '',
  allLinesPacked = false,
  pipeline = null,
  compact = false,
  legend = false,
}) {
  const stage = legend
    ? { index: -1, id: '', label: '', outcome: '' }
    : resolveGoodsIssuePipelineStage({
        requestStatus,
        packageStatus,
        dispatchStatus,
        podBookedAt,
        deliveryOutcome,
        allLinesPacked,
        pipeline,
      });
  const currentIndex = stage.index;

  return (
    <div
      className={`gi-pipeline${compact ? ' gi-pipeline--compact' : ''}`}
      role="list"
      aria-label="Goods Issuance pipeline"
    >
      {GOODS_ISSUE_PIPELINE_STAGES.map((step, index) => {
        const done = !legend && index < currentIndex;
        const active = !legend && index === currentIndex;
        const label =
          index === 5 && stage.outcome
            ? stage.outcome
            : step.label;
        return (
          <div
            key={step.id}
            role="listitem"
            className={`gi-pipeline-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}${legend ? ' is-legend' : ''}`}
            title={label}
          >
            <span className="gi-pipeline-dot" aria-hidden="true">
              {done ? '✓' : index + 1}
            </span>
            <span className="gi-pipeline-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
