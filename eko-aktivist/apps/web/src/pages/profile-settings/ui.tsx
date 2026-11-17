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

export function ProfileSettings() {
  const me = useData('/me')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [saved, setSaved] = useState(false)
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try {
      await patch('/me', { name: f.get('name'), city: f.get('city') })
      query.invalidateQueries()
      setError(null)
      setSaved(true)
    } catch (caught) {
      setError(caught)
      setSaved(false)
    }
  }
  if (!me.data) return <section className="page-section">Загружаем профиль…</section>
  return (
    <section className="page-section narrow">
      <Link className="back" to="/profile">
        ← Профиль
      </Link>
      <span className="eyebrow">МОИ ДАННЫЕ</span>
      <h1>Настройки профиля</h1>
      <form className="panel stacked" onSubmit={save}>
        <ErrorMessage error={error} />
        {saved && <div className="success">Профиль сохранён</div>}
        <label>
          Имя
          <input name="name" defaultValue={me.data.name} minLength={2} maxLength={80} required />
        </label>
        <label>
          Город
          <input name="city" defaultValue={me.data.city} minLength={2} maxLength={120} required />
        </label>
        <p>Email: {me.data.email}. Роль назначает администратор.</p>
        <button className="button">Сохранить</button>
      </form>
    </section>
  )
}
