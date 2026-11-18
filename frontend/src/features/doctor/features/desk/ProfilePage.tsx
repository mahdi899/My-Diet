import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiError, loadProfile, saveProfile } from '../../data/api'
import { verificationStatus } from '../../data/labels'

type Profile = Awaited<ReturnType<typeof loadProfile>>

export function ProfilePage() {
  const query = useQuery({ queryKey: ['doctor', 'profile'], queryFn: loadProfile })
  if (query.isPending) return <p role="status">در حال دریافت اطلاعات…</p>
  if (query.isError) return <p role="alert">{apiError(query.error)}</p>
  return <ProfileEditor profile={query.data} />
}

function ProfileEditor({ profile }: { profile: Profile }) {
  const client = useQueryClient()
  const [portrait, setPortrait] = useState(profile.portrait)
  const [photoError, setPhotoError] = useState('')
  const [readingPhoto, setReadingPhoto] = useState(false)
  const save = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => client.invalidateQueries({ queryKey: ['doctor', 'profile'] }),
  })

  async function choosePhoto(file?: File) {
    if (!file) return
    setPhotoError('')
    setReadingPhoto(true)
    try {
      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 132_000) {
        throw new Error('تصویر JPG یا PNG با حجم حداکثر ۱۳۲ کیلوبایت انتخاب کنید.')
      }
      const image = await createImageBitmap(file)
      image.close()
      const reader = new FileReader()
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setPortrait(data)
      save.reset()
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'خواندن تصویر ممکن نبود.')
    } finally {
      setReadingPhoto(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const read = (key: string) => String(values.get(key) ?? '').trim()
    save.mutate({
      displayName: read('displayName'), credential: read('credential'),
      education: read('education'), bio: read('bio'), portrait,
    })
  }

  return <form className="card card-pad doctor-profile-editor" onSubmit={submit} onChange={() => { if (save.isSuccess) save.reset() }}>
    <div className="doctor-profile-summary">
      <span className="doctor-profile-photo">{portrait ? <img src={portrait} alt="تصویر پروفایل" /> : profile.displayName.charAt(0)}</span>
      <div><h2>{profile.displayName}</h2><p>{verificationStatus[profile.verificationStatus] || 'ثبت نشده'}</p></div>
    </div>
    <div className="doctor-profile-fields">
      <label>نام نمایشی<input name="displayName" defaultValue={profile.displayName} maxLength={80} required /></label>
      <label>تخصص<input name="credential" defaultValue={profile.credential} maxLength={120} /></label>
      <label>تحصیلات<input name="education" defaultValue={profile.education} maxLength={120} /></label>
      <label>کد نظام پزشکی<input value={profile.councilNo || 'ثبت نشده'} readOnly /></label>
      <label>تصویر پروفایل<input type="file" accept="image/jpeg,image/png" disabled={readingPhoto || save.isPending} onChange={event => { void choosePhoto(event.target.files?.[0]); event.target.value = '' }} /></label>
      {portrait && <button className="secondary" type="button" onClick={() => { setPortrait(''); setPhotoError(''); save.reset() }}>حذف تصویر</button>}
    </div>
    {photoError && <p role="alert">{photoError}</p>}
    <label>معرفی<textarea name="bio" defaultValue={profile.bio} maxLength={1000} rows={4} /></label>
    {save.isError && <p role="alert">{apiError(save.error)}</p>}
    {save.isSuccess && <p role="status">پروفایل ذخیره شد.</p>}
    <button type="submit" disabled={save.isPending || readingPhoto}>{save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ پروفایل'}</button>
  </form>
}
