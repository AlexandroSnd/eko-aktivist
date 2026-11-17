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

export function EventEditor() {
  const { id } = useParams()
  const list = useData('/organizer/events')
  const event = list.data?.items?.find((item: any) => item.id === id)
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [message, setMessage] = useState('')
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try {
      await patch(`/events/${id}`, { description: values.description, inventory: values.inventory })
      query.invalidateQueries({ queryKey: ['/organizer/events'] })
      setError(null)
      setMessage('Изменения сохранены')
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  async function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const body = {
      title: String(f.get('title')),
      type: String(f.get('type')),
      city: String(f.get('city')),
      address: String(f.get('address')),
      contact: String(f.get('contact')),
      lat: Number(f.get('lat')),
      lon: Number(f.get('lon')),
      start_at: toEkbISOString(String(f.get('start_at'))),
      end_at: toEkbISOString(String(f.get('end_at'))),
      capacity: Number(f.get('capacity')),
      competition_enabled: !!f.get('competition_enabled'),
    }
    try {
      await patch(`/events/${id}`, body)
      query.invalidateQueries({ queryKey: ['/organizer/events'] })
      setError(null)
      setMessage('Параметры обновлены')
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const body = new FormData(form)
    const kind = String(body.get('kind'))
    body.delete('kind')
    try {
      await api(`/events/${id}/photos?kind=${kind}`, { method: 'POST', body })
      setError(null)
      setMessage('Фото загружено')
      form.reset()
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  if (!event) return <section className="page-section">Загружаем карточку…</section>
  return (
    <section className="page-section narrow">
      <Link className="back" to={`/organizer/events/${id}`}>
        ← К событию
      </Link>
      <span className="eyebrow">РЕДАКТИРОВАНИЕ</span>
      <h1>{event.title}</h1>
      <p className="lead">После первой записи можно изменить только описание и инвентарь.</p>
      <ErrorMessage error={error} />
      {message && <div className="success">{message}</div>}
      <form className="panel stacked" onSubmit={save}>
        <h2>Описание акции</h2>
        <label>
          Описание
          <textarea
            name="description"
            defaultValue={event.description}
            minLength={20}
            maxLength={3000}
            required
          />
        </label>
        <label>
          Инвентарь
          <textarea name="inventory" defaultValue={event.inventory} maxLength={500} />
        </label>
        <button className="button">Сохранить</button>
      </form>
      <form className="panel stacked" onSubmit={saveDetails}>
        <h2>Основные параметры</h2>
        <p>Доступны до первой записи.</p>
        <label>
          Название
          <input name="title" defaultValue={event.title} minLength={5} maxLength={120} required />
        </label>
        <label>
          Тип
          <select name="type" defaultValue={event.type}>
            {Object.entries(eventTypes).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Город
          <input name="city" defaultValue={event.city} required />
        </label>
        <label>
          Адрес
          <input name="address" defaultValue={event.address} required />
        </label>
        <label>
          Контакт
          <input name="contact" defaultValue={event.contact} required />
        </label>
        <div className="form-grid">
          <label>
            Широта
            <input name="lat" type="number" step="any" defaultValue={event.lat} required />
          </label>
          <label>
            Долгота
            <input name="lon" type="number" step="any" defaultValue={event.lon} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Начало
            <DatePickerField
              name="start_at"
              mode="datetime"
              defaultValue={toEkbInput(event.start_at)}
              required
            />
          </label>
          <label>
            Конец
            <DatePickerField
              name="end_at"
              mode="datetime"
              defaultValue={toEkbInput(event.end_at)}
              required
            />
          </label>
        </div>
        <label>
          Мест
          <input
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={event.capacity}
            required
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="competition_enabled"
            defaultChecked={event.competition_enabled}
          />{' '}
          Командное соревнование
        </label>
        <button className="button ghost">Сохранить параметры</button>
      </form>
      <form className="panel stacked" onSubmit={upload}>
        <h2>Фото акции</h2>
        <label>
          Вид
          <select name="kind">
            <option value="before">До</option>
            <option value="after">После</option>
          </select>
        </label>
        <label>
          Файл JPEG или PNG до 5 МБ
          <input name="file" type="file" accept="image/jpeg,image/png" required />
        </label>
        <button className="button">Загрузить</button>
      </form>
    </section>
  )
}
