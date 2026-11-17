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

export function AdminTools() {
  const users = useData('/admin/users')
  const partners = useData('/admin/partners')
  const offers = useData('/admin/offers')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [message, setMessage] = useState('')
  const [report, setReport] = useState<any>()
  async function doAction(action: () => Promise<any>, success = 'Сохранено') {
    try {
      const result = await action()
      query.invalidateQueries()
      setError(null)
      setMessage(success)
      return result
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  async function retention(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const from = toEkbISOString(String(form.get('from')) + 'T00:00')
    const to = new Date(String(form.get('to')) + 'T23:59:59+05:00').toISOString()
    const result = await doAction(
      () =>
        api(`/organizer/retention?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      'Отчёт рассчитан',
    )
    if (result) setReport(result)
  }
  return (
    <section className="page-section">
      <Link className="back" to="/admin">
        ← Администрирование
      </Link>
      <span className="eyebrow">СЛУЖЕБНЫЕ ОПЕРАЦИИ</span>
      <h1>Управление и аналитика</h1>
      <ErrorMessage error={error} />
      {message && <div className="success">{message}</div>}
      <div className="admin-grid">
        <div className="panel">
          <h2>Права пользователей</h2>
          {users.data?.items?.map((user: any) => (
            <form
              className="permission-row"
              key={user.id}
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                doAction(() =>
                  patch(`/admin/users/${user.id}/permissions`, {
                    role: f.get('role'),
                    expert_permission: !!f.get('expert_permission'),
                    analytics_permission: !!f.get('analytics_permission'),
                  }),
                )
              }}
            >
              <b>{user.name}</b>
              <small>{user.email}</small>
              <label>
                Роль
                <select name="role" defaultValue={user.role}>
                  <option value="participant">Участник</option>
                  <option value="organizer">Организатор</option>
                  <option value="partner">Партнёр</option>
                  <option value="admin">Администратор</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="expert_permission"
                  defaultChecked={user.expert_permission}
                />{' '}
                Эксперт
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="analytics_permission"
                  defaultChecked={user.analytics_permission}
                />{' '}
                Аналитика
              </label>
              <button className="button small">Сохранить</button>
            </form>
          ))}
        </div>
        <div className="panel">
          <h2>Партнёры</h2>
          {partners.data?.items?.map((partner: any) => (
            <form
              className="stacked"
              key={partner.id}
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                doAction(() =>
                  patch(`/admin/partners/${partner.id}`, {
                    name: f.get('name'),
                    public_contact: f.get('public_contact'),
                    operator_user_id: f.get('operator_user_id') || null,
                  }),
                )
              }}
            >
              <label>
                Название
                <input name="name" defaultValue={partner.name} required />
              </label>
              <label>
                Публичный контакт
                <input name="public_contact" defaultValue={partner.public_contact} required />
              </label>
              <label>
                Оператор
                <select name="operator_user_id" defaultValue={partner.operator_user_id || ''}>
                  <option value="">Не назначен</option>
                  {users.data?.items
                    ?.filter((u: any) => u.role === 'partner')
                    .map((u: any) => (
                      <option value={u.id} key={u.id}>
                        {u.name} · {u.email}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button small">Сохранить партнёра</button>
            </form>
          ))}
        </div>
        <div className="panel">
          <h2>Предложения</h2>
          {offers.data?.items?.map((offer: any) => (
            <form
              className="stacked"
              key={offer.id}
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                doAction(() =>
                  patch(`/admin/offers/${offer.id}`, {
                    partner_id: offer.partner_id,
                    title: f.get('title'),
                    description: f.get('description'),
                    price: Number(f.get('price')),
                    stock: Number(f.get('stock')),
                    expires_at: toEkbISOString(String(f.get('expires_at'))),
                    active: !!f.get('active'),
                    is_demo: !!f.get('is_demo'),
                  }),
                )
              }}
            >
              <label>
                Название
                <input name="title" defaultValue={offer.title} required />
              </label>
              <label>
                Описание
                <textarea name="description" defaultValue={offer.description} required />
              </label>
              <div className="form-grid">
                <label>
                  Цена
                  <input name="price" type="number" defaultValue={offer.price} min={1} required />
                </label>
                <label>
                  Остаток
                  <input name="stock" type="number" defaultValue={offer.stock} min={0} required />
                </label>
              </div>
              <label>
                До
                <DatePickerField
                  name="expires_at"
                  mode="datetime"
                  defaultValue={toEkbInput(offer.expires_at)}
                  required
                />
              </label>
              <label className="checkbox">
                <input name="active" type="checkbox" defaultChecked={offer.active} /> Активно
              </label>
              <label className="checkbox">
                <input name="is_demo" type="checkbox" defaultChecked={offer.is_demo} /> Учебное
              </label>
              <button className="button small">Сохранить предложение</button>
            </form>
          ))}
        </div>
        <div className="panel">
          <h2>Возврат обмена</h2>
          <form
            className="stacked"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              doAction(
                () => post(`/admin/redemptions/${f.get('id')}/refund`, { reason: f.get('reason') }),
                'Баллы возвращены',
              )
            }}
          >
            <label>
              ID обмена
              <input name="id" required />
            </label>
            <label>
              Причина
              <textarea name="reason" minLength={5} maxLength={500} required />
            </label>
            <button className="button">Вернуть непогашенный обмен</button>
          </form>
          <h2>Возвращаемость за 14 дней</h2>
          <form className="stacked" onSubmit={retention}>
            <label>
              Начало когорты
              <DatePickerField name="from" required />
            </label>
            <label>
              Конец когорты
              <DatePickerField name="to" required />
            </label>
            <button className="button">Рассчитать</button>
          </form>
          {report && (
            <p>
              Наблюдаемых: {report.n}. Повторных записей: {report.returned_n}. Доля:{' '}
              {report.rate === null ? 'нет данных' : `${Math.round(report.rate * 100)}%`}.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
