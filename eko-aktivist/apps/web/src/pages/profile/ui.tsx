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
import {
  Alert,
  EmptyState,
  ErrorMessage,
  Loading,
  QueryState,
  useData,
  useList,
  useMe,
} from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

export function Profile() {
  const { data: me } = useMe()
  const participations = useList('/me/participations')
  const impact = useList('/me/impact')
  const points = useList('/me/points')
  const achievements = useList('/me/achievements')
  const redemptions = useList('/me/redemptions')
  const [error, setError] = useState<any>()
  const query = useQueryClient()
  async function cancel(id: string) {
    try {
      await post(`/participations/${id}/cancel`)
      query.invalidateQueries({ queryKey: ['/me/participations'] })
    } catch (e) {
      setError(e)
    }
  }
  if (!me) return <Loading />
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">МОЯ ИСТОРИЯ</span>
        <h1>Привет, {me.name}</h1>
        <p>Здесь собраны ваши действия и подтверждённые результаты.</p>
      </div>
      <div className="dashboard-stats">
        <div>
          <span>Баланс</span>
          <strong>{me.balance}</strong>
          <small>ЭкоБаллов</small>
        </div>
        <div>
          <span>Участий</span>
          <strong>{impact.data?.participations ?? '—'}</strong>
          <small>подтверждено</small>
        </div>
        <div>
          <span>Вторсырьё</span>
          <strong>{impact.data?.waste_kg ?? '—'}</strong>
          <small>кг</small>
        </div>
        <div>
          <span>Деревья</span>
          <strong>{impact.data?.trees ?? '—'}</strong>
          <small>посажено</small>
        </div>
      </div>
      <div className="two-cols">
        <div className="panel">
          <h2>Мои акции</h2>
          <Alert error={error} />
          {participations.data?.items?.length ? (
            participations.data.items.map((x: any) => (
              <div className="row-item" key={x.participation.id}>
                <div>
                  <Link to={`/events/${x.event.id}`}>
                    <b>{x.event.title}</b>
                  </Link>
                  <small>
                    {formatDate(x.event.start_at)} · {x.participation.status}
                  </small>
                </div>
                {x.participation.status === 'registered' &&
                  new Date(x.event.start_at) > new Date() && (
                    <button className="text-button" onClick={() => cancel(x.participation.id)}>
                      Отменить
                    </button>
                  )}
              </div>
            ))
          ) : (
            <p className="muted">
              Вы ещё не записались на акцию. <Link to="/events">Найти акцию →</Link>
            </p>
          )}
        </div>
        <div className="panel">
          <h2>Достижения</h2>
          <p>
            Уровень: <b>{achievements.data?.level || 'новичок'}</b>
          </p>
          <div className="chips">
            {achievements.data?.badges?.map((b: string) => (
              <span className="chip" key={b}>
                {b.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
          <h3>Мои коды</h3>
          {redemptions.data?.items?.map((r: any) => (
            <div className="row-item" key={r.id}>
              <div>
                <b>{r.code || 'Код использован'}</b>
                <small>
                  {r.status} · {r.price_snapshot} баллов
                </small>
              </div>
            </div>
          ))}
          <h3>История баллов</h3>
          {points.data?.items?.slice(0, 10).map((p: any) => (
            <div className="row-item" key={p.id}>
              <span>{p.kind}</span>
              <b>
                {p.delta > 0 ? '+' : ''}
                {p.delta}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className="quick-links">
        <Link to="/profile/edit">Изменить профиль ↗</Link>
        <Link to="/notifications">Уведомления ↗</Link>
        <Link to="/questions">Мои вопросы ↗</Link>
        {me.role === 'organizer' && <Link to="/organizer/events">Кабинет организатора ↗</Link>}
        {me.role === 'admin' && <Link to="/admin">Администрирование ↗</Link>}
        {me.role === 'partner' && <Link to="/partner">Кабинет партнёра ↗</Link>}
        {me.expert_permission && <Link to="/expert">Вопросы эксперту ↗</Link>}
      </div>
    </section>
  )
}
