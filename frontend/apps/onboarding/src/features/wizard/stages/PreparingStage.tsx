import { useEffect, useState } from 'react'
import { assetUrl } from '../../../engine'

export function PreparingStage({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(100, value + 4))
    }, 110)
    const done = window.setTimeout(onDone, 3000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(done)
    }
  }, [onDone])

  return (
    <div id="aiPreparingPhase" className="ai-prep-phase">
      <div className="analysis-visual" aria-hidden="true">
        <span className="analysis-orbit analysis-orbit--outer"><span className="analysis-ring ring-outer" /></span>
        <span className="analysis-orbit analysis-orbit--inner"><span className="analysis-ring ring-inner" /></span>
        <span className="analysis-spark spark-outer">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.2 13.7 8.8 21.6 12 13.7 15.2 12 22.8 10.3 15.2 2.4 12 10.3 8.8Z" /></svg>
        </span>
        <span className="analysis-spark analysis-spark--sm spark-inner">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.2 13.7 8.8 21.6 12 13.7 15.2 12 22.8 10.3 15.2 2.4 12 10.3 8.8Z" /></svg>
        </span>
        <span className="analysis-core"><img src={assetUrl('assets/logo.png')} alt="" width={58} height={58} /></span>
      </div>
      <h2 className="ai-prep-title">اطلاعات شما<br />در حال آنالیز است</h2>
      <div className="ai-prep-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="پیشرفت آنالیز">
        <div id="aiPrepProgressFill" className="ai-prep-progress-fill" style={{ width: progress + '%' }} />
      </div>
      <p className="analysis-wait-hint">صبر کنید</p>
    </div>
  )
}
