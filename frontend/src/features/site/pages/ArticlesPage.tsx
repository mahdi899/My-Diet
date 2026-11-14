import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

const photos = ['salad.jpg', 'vegetables.jpg', 'breakfast.jpg', 'bowl.jpg']

interface ArticleItem {
  id: string
  title: string
  category: string
  image: number
  intro: string
}

async function loadMagazine() {
  const response = await fetch('/v1/public/articles')
  if (!response.ok) throw new Error('دریافت مقالات ممکن نشد.')
  const body = (await response.json()) as { items?: ArticleItem[] }
  return body.items ?? []
}

export function useMagazine() {
  return useQuery({ queryKey: ['magazine'], queryFn: loadMagazine, staleTime: 60_000 })
}

export function ArticleCard({ item }: { item: ArticleItem }) {
  const photo = photos[item.image] ?? photos[0]
  return (
    <Link to={'/article.html?id=' + encodeURIComponent(item.id)} className="overflow-hidden rounded-[22px] border border-[#d5e2cb] bg-white shadow-sm">
      <img src={'/assets/' + photo} alt="" className="h-52 w-full object-cover" />
      <div className="p-4">
        <span className="text-xs text-pine">{item.category}</span>
        <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-[#667566]">{item.intro.split('\n')[0]}</p>
      </div>
    </Link>
  )
}

export default function ArticlesPage() {
  const query = useMagazine()
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold text-pine">مجله رژیم من</h1>
      {query.isLoading && <p>در حال بارگذاری مقاله‌ها…</p>}
      {query.isError && <p className="text-danger">دریافت مقالات ممکن نشد.</p>}
      <div className="grid gap-6 md:grid-cols-3">
        {query.data?.map((item) => <ArticleCard key={item.id} item={item} />)}
      </div>
    </section>
  )
}
