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
  DatePickerField,
  ErrorMessage,
  Loading,
  useData,
  useList,
  useMe,
} from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

export function Organizer() {
  const { data } = useList('/organizer/events')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const element = e.currentTarget
    const form = new FormData(element)
    const body: any = {
      ...Object.fromEntries(form),
      lat: Number(form.get('lat')),
      lon: Number(form.get('lon')),
      capacity: Number(form.get('capacity')),
      start_at: toEkbISOString(String(form.get('start_at'))),
      end_at: toEkbISOString(String(form.get('end_at'))),
      competition_enabled: !!form.get('competition_enabled'),
    }
    try {
      await post('/events', body)
      query.invalidateQueries({ queryKey: ['/organizer/events'] })
      element.reset()
    } catch (e) {
      setError(e)
    }
  }
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">КАБИНЕТ ОРГАНИЗАТОРА</span>
        <h1>Ваши акции</h1>
        <p>Создавайте события и подтверждайте вклад участников.</p>
      </div>
      <div className="two-cols">
        <div className="panel">
          <h2>События</h2>
          {data?.items?.map((e: any) => (
            <div className="row-item" key={e.id}>
              <Link to={`/organizer/events/${e.id}`}>
                <b>{e.title}</b>
                <small>
                  {e.status} · {formatDate(e.start_at)}
                </small>
              </Link>
              <span>↗</span>
            </div>
          ))}
        </div>
        <form className="panel stacked" onSubmit={create}>
          <h2>Новая акция</h2>
          <Alert error={error} />
          <label>
            Название
            <input name="title" minLength={5} maxLength={120} required />
          </label>
          <label>
            Описание
            <textarea name="description" minLength={20} maxLength={3000} required />
          </label>
          <label>
            Тип
            <select name="type">
              {Object.entries(eventTypes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Город
            <input name="city" defaultValue="Екатеринбург" required />
          </label>
          <label>
            Адрес
            <input name="address" minLength={5} required />
          </label>
          <div className="form-grid">
            <label>
              Широта
              <input name="lat" type="number" step="any" defaultValue={56.8389} required />
            </label>
            <label>
              Долгота
              <input name="lon" type="number" step="any" defaultValue={60.6057} required />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Начало
              <DatePickerField name="start_at" mode="datetime" required />
            </label>
            <label>
              Конец
              <DatePickerField name="end_at" mode="datetime" required />
            </label>
          </div>
          <label>
            Мест
            <input name="capacity" type="number" min={1} max={500} defaultValue={20} required />
          </label>
          <label>
            Контакт
            <input name="contact" minLength={5} required />
          </label>
          <label>
            Инвентарь
            <textarea name="inventory" maxLength={500} />
          </label>
          <label className="checkbox">
            <input name="competition_enabled" type="checkbox" /> Командное соревнование
          </label>
          <button className="button">Создать черновик ↗</button>
        </form>
      </div>
    </section>
  )
}
