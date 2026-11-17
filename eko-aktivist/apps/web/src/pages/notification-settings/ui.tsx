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

export function NotificationSettings() {
  const sub = useData('/me/subscription')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [saved, setSaved] = useState(false)
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try {
      await put('/me/subscription', { city: f.get('city'), types: f.getAll('types') })
      query.invalidateQueries()
      setError(null)
      setSaved(true)
    } catch (caught) {
      setError(caught)
      setSaved(false)
    }
  }
  if (!sub.data) return <section className="page-section">Загружаем настройки…</section>
  return (
    <section className="page-section narrow">
      <Link className="back" to="/notifications">
        ← Уведомления
      </Link>
      <span className="eyebrow">ПОДПИСКА</span>
      <h1>Новые акции</h1>
      <form className="panel stacked" onSubmit={save}>
        <ErrorMessage error={error} />
        {saved && <div className="success">Подписка сохранена</div>}
        <label>
          Город
          <input name="city" defaultValue={sub.data.city} required />
        </label>
        <p>Если не выбран ни один тип, вы получите уведомления обо всех акциях города.</p>
        {Object.entries(eventTypes).map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input
              name="types"
              type="checkbox"
              value={key}
              defaultChecked={sub.data.types?.includes(key)}
            />{' '}
            {label}
          </label>
        ))}
        <button className="button">Сохранить</button>
      </form>
    </section>
  )
}
