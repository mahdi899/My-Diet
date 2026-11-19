import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { plans, specialists, type PlanId } from '../../../domain/questionnaire'
import { useWizard } from '../../../application/wizard-store'
import { StageAction } from '../StageAction'
import { StageBack } from '../StageBack'

const planPhotography: Record<PlanId, string> = {
  weekly: '/src/assets/images/real_plan_start_15d_1794961796046.webp',
  monthly: '/src/assets/images/real_plan_companion_30d_1794961796182.webp',
  quarterly: '/src/assets/images/real_plan_vip_90d_1794961801753.webp',
}

function Feature({ text, doctor }: { text: string; doctor: string }) {
  const [before, after] = text.split('{doctor}')
  return (
    <li>
      <Check size={15} aria-hidden="true" />
      <span>{before}{after != null && <strong>{doctor}</strong>}{after}</span>
    </li>
  )
}

export function PlansStage({ onBuy }: { onBuy: () => void }) {
  const plan = useWizard((state) => state.plan)
  const setPlan = useWizard((state) => state.setPlan)
  const setStage = useWizard((state) => state.setStage)
  const specialistId = useWizard((state) => state.specialistId)
  const doctor = specialists.find((person) => person.id === specialistId)?.name ?? 'متخصص منتخب شما'
  const selected = plans.find((item) => item.id === plan)

  return (
    <div id="twoStepModalBackdrop" className="flex">
      <div id="twoStepModalCard" data-plan={plan}>
        <div className="modal-topbar plans-topbar">
          <StageBack label="بازگشت به متخصص‌ها" onClick={() => setStage('specialists')} />
        </div>
        <div className="modal-scroll-body">
          <div id="modalStep1Content">
            <div className="plans-intro">
              <h2>پلن مناسب خودت رو انتخاب کن</h2>
            </div>
            <div className="plans-stack">
              {plans.map((item) => {
                const expanded = plan === item.id
                const detailsId = `plan-details-${item.id}`
                return (
                  <section key={item.id} className={'plan-tier' + (expanded ? ' is-open' : '')} data-tier={item.id}>
                    <button
                      type="button"
                      className="plan-option-card"
                      aria-expanded={expanded}
                      aria-pressed={expanded}
                      aria-controls={detailsId}
                      onClick={() => setPlan(item.id)}
                    >
                      <span className="plan-art">
                        <img src={planPhotography[item.id]} alt="" width={960} height={717} decoding="async" />
                      </span>
                      <span className="plan-summary">
                        <span className="plan-heading">
                          <strong>{item.title}</strong>
                          <span className="plan-duration">{item.days}</span>
                        </span>
                        {item.id === 'monthly' && <span className="plan-recommendation"><Sparkles size={12} aria-hidden="true" />پیشنهاد ما</span>}
                        <span className="plan-price"><strong>{item.price}</strong><span>تومان</span></span>
                      </span>
                      <span className="plan-chevron" aria-hidden="true">{expanded ? <Check size={15} /> : <ChevronDown size={17} />}</span>
                    </button>
                    <div id={detailsId} className="plan-details" hidden={!expanded}>
                      <p>{item.description}</p>
                      <ul>
                        {item.features.map((feature) => <Feature key={feature} text={feature} doctor={doctor} />)}
                      </ul>
                    </div>
                  </section>
                )
              })}
            </div>
            <StageAction id="buySelectedPlan" disabled={!selected} onClick={onBuy}>
              {selected ? 'خرید پلن ' + selected.title : 'خرید پلن'}
            </StageAction>
          </div>
        </div>
      </div>
    </div>
  )
}
