import React, { useEffect, useRef, useState } from 'react'
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

const eventPin = L.divIcon({
  className: 'map-pin',
  html: '<span>✳</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

export function EventDetail() {
  const { id } = useParams()
  const { data: event, isLoading, error, refetch } = useList('/events/' + id)
  const { data: me } = useMe()
  const mine = useQuery({
    queryKey: ['my-event-participations'],
    queryFn: () => api('/me/participations'),
    enabled: !!me,
    retry: false,
  })
  const myTeam = useQuery({
    queryKey: ['my-team'],
    queryFn: () => api('/me/team'),
    enabled: !!me,
    retry: false,
  })
  const [teamEnabled, setTeamEnabled] = useState(false)
  const current = mine.data?.items?.find((item: any) => item.event.id === id)?.participation
  const query = useQueryClient()
  const [actionError, setActionError] = useState<any>()
  const [busy, setBusy] = useState(false)
  const [mapTilesUnavailable, setMapTilesUnavailable] = useState(false)
  const mapTileErrors = useRef(0)
  async function join() {
    setBusy(true)
    try {
      await post('/events/' + id + '/participations', {
        team_id: teamEnabled ? myTeam.data?.team?.id : null,
      })
      query.invalidateQueries({ queryKey: ['my-event-participations'] })
      query.invalidateQueries({ queryKey: ['/events/' + id] })
      setActionError(null)
    } catch (caught) {
      setActionError(caught)
    } finally {
      setBusy(false)
    }
  }
  async function cancel() {
    if (!current) return
    setBusy(true)
    try {
      await post('/participations/' + current.id + '/cancel')
      query.invalidateQueries({ queryKey: ['my-event-participations'] })
      query.invalidateQueries({ queryKey: ['/events/' + id] })
      setActionError(null)
    } catch (caught) {
      setActionError(caught)
    } finally {
      setBusy(false)
    }
  }
  async function changeTeam(teamId: string | null) {
    if (!current) return
    try {
      await put('/participations/' + current.id + '/team', { team_id: teamId })
      query.invalidateQueries({ queryKey: ['my-event-participations'] })
      setActionError(null)
    } catch (caught) {
      setActionError(caught)
    }
  }
  if (isLoading) return <Loading />
  if (error)
    return (
      <div className="empty">
        <h2>Не удалось загрузить акцию</h2>
        <p>Проверьте подключение и попробуйте ещё раз.</p>
        <button className="button" onClick={() => refetch()}>
          Повторить
        </button>
      </div>
    )
  if (!event)
    return (
      <div className="empty">
        <h2>Акция не найдена</h2>
        <p>Возможно, ссылка устарела или акция была удалена.</p>
        <Link className="button" to="/events">
          К списку акций
        </Link>
      </div>
    )
  const canJoin = event.status === 'published' && new Date(event.start_at) > new Date()
  const latitude = Number(event.lat)
  const longitude = Number(event.lon)
  const hasMapLocation =
    event.lat !== null &&
    event.lat !== undefined &&
    String(event.lat).trim() !== '' &&
    event.lon !== null &&
    event.lon !== undefined &&
    String(event.lon).trim() !== '' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  return (
    <section className="page-section detail">
      <Link className="back" to="/events">
        ← Все акции
      </Link>
      <div className="detail-grid">
        <div>
          <span className="eyebrow">
            {eventTypes[event.type] || 'ЭКОЛОГИЧЕСКАЯ АКЦИЯ'} · ЕКАТЕРИНБУРГ
          </span>
          <h1>{event.title || 'Акция без названия'}</h1>
          <p className="lead">{event.description || 'Описание акции пока не добавлено.'}</p>
          <div className="info-grid">
            <div>
              <span>Когда</span>
              <strong>{formatDate(event.start_at)}</strong>
            </div>
            <div>
              <span>Где</span>
              <strong>{event.address || 'Адрес уточняется'}</strong>
            </div>
            <div>
              <span>Мест осталось</span>
              <strong>
                {event.places_left ?? '—'}
                {event.capacity != null ? ` из ${event.capacity}` : ''}
              </strong>
            </div>
            <div>
              <span>Контакт</span>
              <strong>{event.contact || 'Уточните у организатора'}</strong>
            </div>
          </div>
          <div className="panel event-location">
            <h2>Место проведения</h2>
            <p className="event-location-address">{event.address || 'Адрес уточняется'}</p>
            {hasMapLocation ? (
              <>
                <div className="event-map-frame">
                  <MapContainer
                    center={[latitude, longitude]}
                    zoom={15}
                    scrollWheelZoom={false}
                    attributionControl={false}
                    className="event-map"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      eventHandlers={{
                        loading: () => {
                          mapTileErrors.current = 0
                          setMapTilesUnavailable(false)
                        },
                        tileerror: () => {
                          mapTileErrors.current += 1
                          setMapTilesUnavailable(true)
                        },
                        load: () => {
                          if (mapTileErrors.current === 0) setMapTilesUnavailable(false)
                        },
                      }}
                    />
                    <Marker position={[latitude, longitude]} icon={eventPin}>
                      <Popup>
                        <b>{event.title || 'Экологическая акция'}</b>
                        <br />
                        {event.address || 'Адрес уточняется'}
                      </Popup>
                    </Marker>
                  </MapContainer>
                  <a
                    className="map-attribution"
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    © OpenStreetMap
                  </a>
                </div>
                {mapTilesUnavailable && (
                  <p className="map-fallback" role="status">
                    Подложка карты недоступна, но отметка места сохранена.
                  </p>
                )}
              </>
            ) : (
              <div className="event-map-empty" role="status">
                Координаты места проведения пока не указаны.
              </div>
            )}
          </div>
          <div className="panel">
            <h2>Что взять с собой</h2>
            <p>{event.inventory || 'Уточните у организатора.'}</p>
          </div>
          <div className="panel">
            <h2>Как начисляются баллы</h2>
            <p>
              {
                (
                  {
                    cleanup: '10 баллов за каждый подтверждённый час уборки.',
                    recycling: '5 баллов за каждый подтверждённый килограмм.',
                    planting: '15 баллов за каждое посаженное дерево.',
                    lecture: '10 баллов за подтверждённое участие.',
                    quest: '10 баллов за подтверждённое участие.',
                  } as any
                )[event.type]
              }
            </p>
          </div>
          {event.status === 'cancelled' && (
            <div className="alert">Акция отменена. {event.cancel_reason}</div>
          )}
        </div>
        <aside className="action-card">
          <span className="eyebrow">ВАШ СЛЕДУЮЩИЙ ШАГ</span>
          <h2>{current?.status === 'registered' ? 'Вы записаны' : 'Присоединиться к акции'}</h2>
          <p>Запись бесплатна. Перед началом вам придёт напоминание.</p>
          <Alert error={actionError} />
          {event.competition_enabled && myTeam.data?.team && current?.status !== 'registered' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={teamEnabled}
                onChange={(e) => setTeamEnabled(e.target.checked)}
              />{' '}
              Участвовать от команды «{myTeam.data.team.name}»
            </label>
          )}
          {event.competition_enabled && myTeam.data?.team && current?.status === 'registered' && (
            <div className="team-choice">
              <p>
                {current.team_id
                  ? `Вы участвуете от команды «${myTeam.data.team.name}»`
                  : 'Вы записаны без команды'}
              </p>
              <button
                className="text-button"
                onClick={() => changeTeam(current.team_id ? null : myTeam.data.team.id)}
              >
                {current.team_id ? 'Убрать команду' : 'Добавить команду'}
              </button>
            </div>
          )}
          {current?.status === 'registered' && canJoin ? (
            <button className="button ghost wide" onClick={cancel} disabled={busy}>
              Отменить запись
            </button>
          ) : !canJoin ? (
            <p>Запись на эту акцию закрыта.</p>
          ) : me ? (
            <button
              className="button wide"
              onClick={join}
              disabled={busy || event.places_left <= 0}
            >
              {busy ? 'Записываем…' : event.places_left <= 0 ? 'Мест нет' : 'Записаться ↗'}
            </button>
          ) : (
            <Link className="button wide" to="/login">
              Войти и записаться ↗
            </Link>
          )}
          <small>Баллы появляются только после подтверждения организатором.</small>
        </aside>
      </div>
      <div className="quick-links">
        <Link to={'/events/' + id + '/community'}>Результаты и отзывы ↗</Link>
      </div>
    </section>
  )
}
