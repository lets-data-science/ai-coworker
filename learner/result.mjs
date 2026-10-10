/** A partial reply or tool failure must never look like a completed job. */
export function classifyResult(result, reportCount) {
  if (result.interrupted) return 'cancelled';
  if (result.error || result.completed !== true || result.partial) return 'failed';
  if (reportCount !== 1) return 'failed';
  return 'completed';
}
