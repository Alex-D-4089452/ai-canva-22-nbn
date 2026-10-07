// Pure run-status label for the strip every run-able box shows above its
// footer (BoxNode.tsx): "Not run yet" until the box has finished a run,
// "Ran at <date, time>" once `BoxData.ranAt` exists (stamped by runBox /
// runAgentLoop in boardStore.ts), and a bare "Ran" for boards saved before
// ranAt was introduced (their boxes have status "done" and/or the legacy
// handoffGeneratedAt / alignmentRanAt timestamps, but no generic stamp).
export function runStatusLabel(ranAt: number | undefined, hasRun: boolean): string {
  if (ranAt) {
    const d = new Date(ranAt);
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Ran at ${d.toLocaleDateString()}, ${time}`;
  }
  return hasRun ? "Ran" : "Not run yet";
}
