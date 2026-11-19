import { StageAction } from '../StageAction'

const features = [
  ['home_doctors_meal_design_1794961844022.webp', 'نظارت متخصص'],
  ['bmi_result_body_analysis_1794962102772.webp', 'رژیم هوشمند'],
  ['home_coach_live_support_1794961838974.webp', 'پشتیبانی همراه'],
  ['hero_persian_healthy_bowl_1794952764202.webp', 'پلن‌های متنوع'],
] as const

export function IntroStage({ onStart }: { onStart: () => void }) {
  return (
    <div id="sloganStage" className="w-full max-w-2xl mx-auto text-center">
      <h1 id="sloganHeading" className="hero-title flex flex-wrap items-center justify-center">
        <span className="slogan-word revealed">رژیم</span>
        <span className="slogan-word revealed slogan-highlight">اختصاصی</span>
        <span className="slogan-line-break" aria-hidden="true" />
        <span className="slogan-word revealed">خودتو</span>
        <span className="slogan-word revealed slogan-highlight">بساز!</span>
      </h1>
      <div id="heroFeatureStrip" className="grid grid-cols-2 sm:grid-cols-4">
        {features.map(([file, label]) => (
          <div key={label} className="hero-feature-card">
            <img className="hero-feature-photo" src={'/src/assets/images/' + file} alt="" width={960} height={716} />
            <span className="hero-feature-text">{label}</span>
          </div>
        ))}
      </div>
      <StageAction id="letsGoBtn" onClick={onStart}>بزن بریم</StageAction>
    </div>
  )
}
