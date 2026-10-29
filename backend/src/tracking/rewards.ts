export interface RewardView {
  id: string;
  requestId: string;
  weekStart: string;
  amountToman: number;
  acknowledgedAt: string | null;
}

/** Recording that the user saw a reward keeps the credited amount. */
export function acknowledgedReward(reward: RewardView, at: string): RewardView {
  if (reward.acknowledgedAt) return reward;
  return { ...reward, amountToman: reward.amountToman, acknowledgedAt: at };
}
