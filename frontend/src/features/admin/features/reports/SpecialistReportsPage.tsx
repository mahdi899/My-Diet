import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { staff } from '../../session'
import { sampleSpecialistReport, specialistReportFromApi, specialistSorts, type SpecialistSort } from './specialist-report'
import './user-reports.css'

function isSort(value: string): value is SpecialistSort {
  return value in specialistSorts
}

function Meter({ text, ratio }: { text: string; ratio: number }) {
  const width = Math.max(0, Math.min(100, ratio))
  return (
    <div className="user-report-metric">
      <p>{text}</p>
      <div className="user-report-meter" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
    </div>
  )
}

export function SpecialistReportsPage({ preview }: { preview: boolean }) {
  const [sort, setSort] = useState<SpecialistSort>('rating')
  const live = useQuery({
    queryKey: ['admin', 'specialist-reports', sort],
    queryFn: async () => specialistReportFromApi(await staff.api(`admin/reports/specialists?sort=${sort}`)),
    enabled: !preview,
  })
  const rows = preview ? sampleSpecialistReport(sort) : live.data

  return (
    <div className="specialist-reports">
      <h2>گزارش متخصصان</h2>
      {preview && <p className="user-report-note">فاز ۹ · نمونهٔ طراحی برای بازهٔ ۱ تا ۳۰ مهر ۱۴۰۵. زمان پاسخ پیام، فاصله تا اولین پاسخ متخصص است. زمان بررسی تغییر برنامه، فاصله تا تصمیم متخصص است و با هم جمع نمی‌شوند.</p>}
      <div className="user-report-filters">
        <select aria-label="ترتیب رتبه‌بندی" value={sort} onChange={(event) => { if (isSort(event.target.value)) setSort(event.target.value) }}>
          {Object.entries(specialistSorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {!preview && live.isLoading && <p>در حال آماده‌سازی گزارش</p>}
      {!preview && live.isError && <p>{live.error instanceof StaffError ? live.error.message : 'گزارش دریافت نشد.'}</p>}
      {rows && rows.length === 1 && <p>با یک متخصص هم رتبه‌بندی معنی دارد؛ مقایسهٔ نسبی تا آمدن نفر دوم نشان داده نمی‌شود.</p>}
      {rows?.map((row) => (
        <section className="user-report-card" key={row.id}>
          <h3>{row.name}</h3>
          <p>{row.rating}</p>
          {row.smallSample && <p>کمتر از ۵ امتیاز؛ میانگین را با احتیاط بخوان.</p>}
          {row.stars.map((star) => <Meter key={star.star} text={star.label} ratio={star.ratio} />)}
          <p>{row.message}</p>
          <p>{row.review}</p>
          <p>{row.pending}</p>
        </section>
      ))}
    </div>
  )
}
