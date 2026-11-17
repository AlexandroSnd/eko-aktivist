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
import {
  Alert,
  DatePickerField,
  ErrorMessage,
  Loading,
  useData,
  useList,
  useMe,
} from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

const marker = L.divIcon({ className: 'map-pin', html: '<span>✳</span>', iconSize: [36, 36] })

export function Events() {
  const [type, setType] = useState('')
  const [date, setDate] = useState('')
  const [until, setUntil] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [page, setPage] = useState(1)
  const [bbox, setBBox] = useState('')
  const [mapOpen, setMapOpen] = useState(true)
  const [center, setCenter] = useState<[number, number]>([56.8389, 60.6057])
  const [geoMessage, setGeoMessage] = useState('')
  const [tileReady, setTileReady] = useState(false)
  const [tileProblem, setTileProblem] = useState(false)
  const tileErrors = useRef(0)
  useEffect(() => {
    if (!mapOpen || tileReady) return
    const timer = window.setTimeout(() => setTileProblem(true), 3000)
    return () => window.clearTimeout(timer)
  }, [mapOpen, tileReady])
  const leaders = useList('/leaders')
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (date) params.set('from', toEkbISOString(date + 'T00:00'))
  if (until) params.set('to', new Date(until + 'T23:59:59+05:00').toISOString())
  if (organizer) params.set('organizer', organizer)
  if (bbox && mapOpen) params.set('bbox', bbox)
  const mapPath = '/events/map?' + params.toString()
  params.set('page', String(page))
  const path = '/events?' + params.toString()
  const { data, isLoading, error } = useList(path)
  const mapData = useList(mapPath)
  const mapEvents = (mapData.data?.items ?? []).filter(
    (event: any) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lon)),
  )
  function reset() {
    setType('')
    setDate('')
    setUntil('')
    setOrganizer('')
    setBBox('')
    setPage(1)
  }
  function locate() {
    if (!navigator.geolocation) {
      setGeoMessage('Геолокация недоступна. Выберите область карты вручную.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter([position.coords.latitude, position.coords.longitude])
        setMapOpen(true)
        setGeoMessage('')
      },
      () => setGeoMessage('Геолокация недоступна. Выберите область карты вручную.'),
    )
  }
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">ДЕЙСТВУЙТЕ РЯДОМ</span>
        <h1>Экологические акции</h1>
        <p>Выберите дело, которое подходит вашему расписанию.</p>
      </div>
      <div className="filters">
        <label>
          Тип акции
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Все направления</option>
            {Object.entries(eventTypes).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          С даты
          <DatePickerField
            value={date}
            onChange={(value) => {
              setDate(value)
              setPage(1)
            }}
          />
        </label>
        <label>
          По дату
          <DatePickerField
            value={until}
            onChange={(value) => {
              setUntil(value)
              setPage(1)
            }}
          />
        </label>
        <label>
          Организатор
          <select
            value={organizer}
            onChange={(e) => {
              setOrganizer(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Все организаторы</option>
            {leaders.data?.items?.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button ghost filter-button" onClick={reset}>
          Сбросить
        </button>
        <button
          className="button ghost filter-button"
          onClick={() => {
            setMapOpen(!mapOpen)
            setBBox('')
            setPage(1)
          }}
        >
          {mapOpen ? 'Скрыть карту' : 'Показать карту'}
        </button>
        <button className="button ghost filter-button" onClick={locate}>
          Моё местоположение
        </button>
      </div>
      {geoMessage && (
        <p className="muted" role="status">
          {geoMessage}
        </p>
      )}
      <Alert error={error} />
      {isLoading ? (
        <Loading />
      ) : (
        <div className={mapOpen ? 'events-layout' : ''}>
          <p className="results-label">Найдено акций: {data?.total || 0}</p>
          <div className="event-results">
            {data?.items?.length ? (
              <div className="list-cards">
                {data.items.map((event: any) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <h2>Пока ничего не найдено</h2>
                <p>Попробуйте изменить фильтры или посмотреть все акции.</p>
                <button className="button" onClick={reset}>
                  Сбросить фильтры
                </button>
              </div>
            )}
            <div className="pagination">
              <button
                className="button ghost small"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ← Назад
              </button>
              <span>Страница {page}</span>
              <button
                className="button ghost small"
                disabled={!data || page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Дальше →
              </button>
            </div>
          </div>
          {mapOpen && (
            <div className="map-wrap">
              <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom={false}
                attributionControl={false}
                className="map"
              >
                <MapFocus center={center} />
                <MapBounds
                  onChange={(value) => {
                    setBBox(value)
                    setPage(1)
                  }}
                />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  eventHandlers={{
                    loading: () => {
                      tileErrors.current = 0
                      setTileReady(false)
                      setTileProblem(false)
                    },
                    load: () => {
                      if (tileErrors.current > 0) {
                        setTileProblem(true)
                        return
                      }
                      setTileReady(true)
                      setTileProblem(false)
                    },
                    tileerror: () => {
                      tileErrors.current += 1
                      setTileProblem(true)
                    },
                  }}
                />
                {mapEvents.map((e: any) => (
                  <Marker key={e.id} position={[Number(e.lat), Number(e.lon)]} icon={marker}>
                    <Popup>
                      <b>{e.title || 'Экологическая акция'}</b>
                      <br />
                      <Link to={'/events/' + e.id}>Подробнее →</Link>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              <a
                className="map-attribution"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap
              </a>
              {tileProblem && (
                <p className="map-fallback" role="status">
                  Подложка карты недоступна. Список акций остаётся рабочим.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
