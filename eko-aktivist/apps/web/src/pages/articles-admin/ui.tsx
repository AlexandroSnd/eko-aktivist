import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import {
  api,
  eventTypes,
  formatDate,
  initCsrf,
  patch,
  post,
  put,
  toEkbInput,
  toEkbISOString,
} from '../../shared/api'
import { Alert, ErrorMessage, Loading, useData, useList, useMe } from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

export function ArticlesAdmin() {
  const list = useData('/admin/articles')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [message, setMessage] = useState('')
  async function save(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const sources = String(f.get('sources') || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    try {
      await patch(`/admin/articles/${id}`, {
        title: f.get('title'),
        text: f.get('text'),
        category: f.get('category'),
        sources,
        published: !!f.get('published'),
      })
      query.invalidateQueries()
      setError(null)
      setMessage('Статья сохранена')
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  return (
    <section className="page-section narrow">
      <Link className="back" to="/admin">
        ← Администрирование
      </Link>
      <span className="eyebrow">КОНТЕНТ</span>
      <h1>Статьи</h1>
      <ErrorMessage error={error} />
      {message && <div className="success">{message}</div>}
      {list.data?.items?.map((item: any) => (
        <form className="panel stacked" key={item.id} onSubmit={(e) => save(e, item.id)}>
          <label>
            Заголовок
            <input name="title" defaultValue={item.title} minLength={5} maxLength={150} required />
          </label>
          <label>
            Категория
            <input name="category" defaultValue={item.category} required />
          </label>
          <label>
            Текст
            <textarea
              name="text"
              defaultValue={item.text}
              minLength={50}
              maxLength={10000}
              required
            />
          </label>
          <label>
            Источники — один URL в строке
            <textarea name="sources" defaultValue={item.sources?.join('\n')} />
          </label>
          <label className="checkbox">
            <input name="published" type="checkbox" defaultChecked={item.published} /> Опубликована
          </label>
          <button className="button">Сохранить статью</button>
        </form>
      ))}
    </section>
  )
}
