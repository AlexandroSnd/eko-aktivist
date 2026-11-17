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

export function OrganizerDetail() {
  const { id } = useParams()
  const { data } = useList('/organizer/events')
  const event = data?.items?.find((x: any) => x.id === id)
  const participants = useList(`/events/${id}/participants`)
  const stats = useList(`/events/${id}/stats`)
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  async function action(path: string, body: any = {}) {
    try {
      await post(path, body)
      query.invalidateQueries()
      setError(null)
    } catch (e) {
      setError(e)
    }
  }
  async function result(p: any, form: HTMLFormElement) {
    const f = new FormData(form)
    const body: any = {
      status: f.get('status'),
      hours: f.get('hours') ? Number(f.get('hours')) : null,
      waste_kg: f.get('waste_kg') ? Number(f.get('waste_kg')) : null,
      trees: f.get('trees') ? Number(f.get('trees')) : null,
      reason: f.get('reason') || null,
    }
    try {
      await put(`/participations/${p.id}/result`, body)
      query.invalidateQueries()
    } catch (e) {
      setError(e)
    }
  }
  if (!event) return <Loading />
  return (
    <section className="page-section">
      <Link className="back" to="/organizer/events">
        ← Мои акции
      </Link>
      <span className="eyebrow">{event.status.toUpperCase()}</span>
      <h1>{event.title}</h1>
      <p className="lead">
        {formatDate(event.start_at)} · {event.address}
      </p>
      <Alert error={error} />
      <div className="toolbar">
        <Link className="button ghost" to={`/organizer/events/${id}/edit`}>
          Изменить карточку и фото
        </Link>
        {event.status === 'draft' && (
          <button className="button" onClick={() => action(`/events/${id}/publish`)}>
            Опубликовать
          </button>
        )}
        {event.status === 'published' && (
          <>
            <button className="button" onClick={() => action(`/events/${id}/complete`)}>
              Завершить
            </button>
            <button
              className="button ghost"
              onClick={() => {
                const reason = prompt('Причина отмены (от 5 символов)')
                if (reason) action(`/events/${id}/cancel`, { reason })
              }}
            >
              Отменить событие
            </button>
          </>
        )}
      </div>
      <div className="dashboard-stats">
        <div>
          <span>Записаны</span>
          <strong>{stats.data?.registered ?? '—'}</strong>
        </div>
        <div>
          <span>Подтверждены</span>
          <strong>{stats.data?.attended ?? '—'}</strong>
        </div>
        <div>
          <span>Неявка</span>
          <strong>{stats.data?.no_show ?? '—'}</strong>
        </div>
        <div>
          <span>Вторсырьё</span>
          <strong>{stats.data?.waste_kg ?? '—'}</strong>
          <small>кг</small>
        </div>
      </div>
      <div className="panel">
        <h2>Участники</h2>
        {participants.data?.items?.map((p: any) => (
          <form
            className="participant-form"
            key={p.id}
            onSubmit={(e) => {
              e.preventDefault()
              result(p, e.currentTarget)
            }}
          >
            <div>
              <b>{p.user.name}</b>
              <small>
                {p.user.email} · {p.status}
              </small>
            </div>
            <label>
              Статус
              <select name="status" defaultValue={p.status === 'attended' ? 'attended' : 'no_show'}>
                <option value="attended">Был</option>
                <option value="no_show">Не явился</option>
              </select>
            </label>
            <label>
              Часы
              <input
                name="hours"
                type="number"
                step="0.01"
                min="0"
                max="24"
                defaultValue={p.hours || ''}
              />
            </label>
            <label>
              Кг
              <input
                name="waste_kg"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                defaultValue={p.waste_kg || ''}
              />
            </label>
            <label>
              Деревья
              <input name="trees" type="number" min="0" max="1000" defaultValue={p.trees || ''} />
            </label>
            <label>
              Причина исправления
              <input name="reason" />
            </label>
            <button className="button small">Сохранить</button>
          </form>
        ))}
      </div>
    </section>
  )
}
