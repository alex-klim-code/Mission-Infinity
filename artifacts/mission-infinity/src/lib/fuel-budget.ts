/** Build spending already includes fuel paid for during earlier pump ticks. */
export function availableFuelBudget(
  session: { finance?: { totalBudget: number } | null; build?: { spent: number } | null },
  mission?: { budget: number } | null,
) {
  return (session.finance?.totalBudget ?? mission?.budget ?? 0) - (session.build?.spent ?? 0);
}
