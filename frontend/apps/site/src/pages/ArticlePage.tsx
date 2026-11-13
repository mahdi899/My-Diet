import { Link, useSearchParams } from 'react-router-dom'
import { useMagazine } from './ArticlesPage'

const photos = ['salad.jpg', 'vegetables.jpg', 'breakfast.jpg', 'bowl.jpg']

interface Section {
  heading: string
  body: string
}

interface FullArticle {
  id: string
  title: string
  category: string
  image: number
  time: number
  intro: string
  sections: Section[]
}

export default function ArticlePage() {
  const [params] = useSearchParams()
  const slug = params.get('id') ?? ''
  const query = useMagazine()
  const article = query.data?.find((item) => item.id === slug) as FullArticle | undefined

  if (query.isLoading) return <p className="p-8">در حال بارگذاری…</p>
  if (!article || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return <p className="p-8">مقاله پیدا نشد. <Link to="/articles.html">بازگشت</Link></p>
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-pine">{article.category} · {article.time} دقیقه مطالعه</p>
      <h1 className="my-4 text-4xl font-bold">{article.title}</h1>
      <img src={'/assets/' + (photos[article.image] ?? photos[0])} alt="" className="mb-6 h-80 w-full rounded-3xl object-cover" />
      {article.intro.split(/\n\s*\n/).map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="mb-4 text-justify leading-8 text-[#4a5d50]">{paragraph}</p>
      ))}
      {article.sections?.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-3 mt-8 text-2xl font-bold text-[#1f4a34]">{section.heading}</h2>
          {section.body.split(/\n\s*\n/).map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mb-4 text-justify leading-8 text-[#4a5d50]">{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  )
}
