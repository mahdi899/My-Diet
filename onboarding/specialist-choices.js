const onboardingSpecialists = [
  { id: 'sara', name: 'دکتر سارا محمدی', focus: 'کاهش وزن پایدار', sprite: 0 },
  { id: 'amir', name: 'دکتر امیر حسینی', focus: 'متابولیسم و تغذیه', sprite: 1 },
  { id: 'nazanin', name: 'دکتر نازنین کریمی', focus: 'افزایش وزن سالم', sprite: 2 },
  { id: 'reza', name: 'دکتر رضا احمدی', focus: 'عضله‌سازی و انرژی', sprite: 3 },
  { id: 'maryam', name: 'دکتر مریم نوری', focus: 'تغذیه بارداری', sprite: 4 },
  { id: 'elham', name: 'دکتر الهام صادقی', focus: 'تغذیه شیردهی', sprite: 5 },
  { id: 'parsa', name: 'دکتر پارسا کیانی', focus: 'تغذیه و سلامت گوارش', sprite: 6 },
  { id: 'hanieh', name: 'دکتر هانیه مرادی', focus: 'تغذیه متعادل', sprite: 7 },
  { id: 'niloofar', name: 'دکتر نیلوفر فرهمند', focus: 'اصلاح عادت‌های غذایی', sprite: 8 },
  { id: 'kian', name: 'دکتر کیان شریفی', focus: 'تغذیه ورزشی', sprite: 9 },
];

function sampleOnboardingSpecialists() {
  const first = Math.floor(Math.random() * onboardingSpecialists.length);
  const second = Math.floor(Math.random() * (onboardingSpecialists.length - 1));
  return [onboardingSpecialists[first], onboardingSpecialists[second >= first ? second + 1 : second]];
}

function onboardingPortrait(person) {
  const x = (person.sprite % 5) * 25;
  const y = person.sprite < 5 ? 0 : 100;
  return `<span class="specialist-portrait specialist-portrait--generated" style="background-position:${x}% ${y}%" aria-hidden="true"></span>`;
}
