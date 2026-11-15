const updatedAt = '2026-11-14T06:24:00Z'

export const demoProfiles = ['سارا آزمایشی', 'زهرا نمونه', 'مهین نمونه', 'ملیکا آزمایشی', 'محمد نمونه', 'مهدی آزمایشی'].map((name, index) => {
  const doctorOnly = index === 1 || index === 5
  return {
    userId: `preview-profile-${index + 1}`, name, phone: `+989***000${index + 1}`,
    track: index === 4 ? 'detox' : 'weight_loss', source: 'demo', age: 24 + index * 4,
    bmi: 24 + index / 2, targetKcal: 1600 + index * 55, safetyTier: doctorOnly ? 'doctor_only' : 'ai_ok',
    riskFlags: doctorOnly ? ['eating_disorder_history'] : [], allergens: index === 0 ? ['gluten'] : [],
    consented: index === 0, updatedAt,
  }
})

export const demoFunnel = {
  stages: { onboardingLeads: 15, onboardingVerified: 12, onboardingClaimed: 10, drafts: 0, profiles: 6, consented: 1, requests: 1, published: 0, doctorOnly: 2 },
  daily: [
    { day: '2026-11-14', track: 'weight_loss', source: 'demo', profiles: 4, avg_bmi: 24.1, doctor_only: 1 },
    { day: '2026-11-13', track: 'weight_loss', source: 'demo', profiles: 1, avg_bmi: 25, doctor_only: 1 },
    { day: '2026-11-13', track: 'detox', source: 'demo', profiles: 1, avg_bmi: 26, doctor_only: 0 },
  ],
}

export const demoLeads = Array.from({ length: 15 }, (_, index) => ({
  id: `preview-lead-${index + 1}`, phone: `+989***${String(index + 1).padStart(4, '0')}`,
  goal: index % 5 === 4 ? 'detox' : 'weight_loss', phoneVerified: index < 12,
  claimedUserId: index < 10 ? `preview-user-${index + 1}` : null, createdAt: updatedAt,
}))
