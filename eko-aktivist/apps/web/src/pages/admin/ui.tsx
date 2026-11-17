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

export function Admin() {
  const users = useList('/admin/users')
  const partners = useList('/admin/partners')
  const offers = useList('/admin/offers')
  const articles = useList('/admin/articles')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  async function submit(path: string, body: any, form?: HTMLFormElement) {
    try {
      await post(path, body)
      query.invalidateQueries()
      form?.reset()
      setError(null)
    } catch (e) {
      setError(e)
    }
  }
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">СЛУЖЕБНЫЙ КАБИНЕТ</span>
        <h1>Администрирование</h1>
        <Link className="button ghost" to="/admin/articles">
          Редактировать статьи ↗
        </Link>
        <Link className="button ghost" to="/admin/tools">
          Расширенные настройки и аналитика ↗
        </Link>
      </div>
      <Alert error={error} />
      <div className="admin-grid">
        <div className="panel">
          <h2>Пользователи</h2>
          {users.data?.items?.map((u: any) => (
            <div className="row-item" key={u.id}>
              <div>
                <b>{u.name}</b>
                <small>
                  {u.email} · {u.role}
                </small>
              </div>
              <select
                value={u.role}
                onChange={async (e) => {
                  try {
                    await patch(`/admin/users/${u.id}/permissions`, {
                      role: e.target.value,
                      expert_permission: u.expert_permission,
                      analytics_permission: u.analytics_permission,
                    })
                    query.invalidateQueries()
                  } catch (e) {
                    setError(e)
                  }
                }}
              >
                <option value="participant">Участник</option>
                <option value="organizer">Организатор</option>
                <option value="partner">Партнёр</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          ))}
        </div>
        <form
          className="panel stacked"
          onSubmit={(e) => {
            e.preventDefault()
            submit(
              '/admin/partners',
              Object.fromEntries(new FormData(e.currentTarget)),
              e.currentTarget,
            )
          }}
        >
          <h2>Партнёры · {partners.data?.items?.length || 0}</h2>
          <label>
            Название
            <input name="name" required />
          </label>
          <label>
            Публичный контакт
            <input name="public_contact" required />
          </label>
          <button className="button">Добавить партнёра</button>
        </form>
        <form
          className="panel stacked"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            submit(
              '/admin/offers',
              {
                ...Object.fromEntries(f),
                price: Number(f.get('price')),
                stock: Number(f.get('stock')),
                expires_at: toEkbISOString(String(f.get('expires_at'))),
                active: true,
                is_demo: true,
              },
              e.currentTarget,
            )
          }}
        >
          <h2>Предложения · {offers.data?.items?.length || 0}</h2>
          <label>
            Партнёр
            <select name="partner_id">
              {partners.data?.items?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Название
            <input name="title" required />
          </label>
          <label>
            Описание
            <textarea name="description" required />
          </label>
          <div className="form-grid">
            <label>
              Цена
              <input name="price" type="number" min="1" max="10000" required />
            </label>
            <label>
              Остаток
              <input name="stock" type="number" min="0" required />
            </label>
          </div>
          <label>
            До
            <DatePickerField name="expires_at" mode="datetime" required />
          </label>
          <button className="button">Добавить предложение</button>
        </form>
        <form
          className="panel stacked"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            submit(
              '/admin/articles',
              {
                ...Object.fromEntries(f),
                sources: String(f.get('sources') || '')
                  .split('\n')
                  .map((x) => x.trim())
                  .filter(Boolean),
                published: true,
              },
              e.currentTarget,
            )
          }}
        >
          <h2>Статьи · {articles.data?.items?.length || 0}</h2>
          <label>
            Заголовок
            <input name="title" minLength={5} required />
          </label>
          <label>
            Категория
            <input name="category" required />
          </label>
          <label>
            Текст
            <textarea name="text" minLength={50} required />
          </label>
          <label>
            URL источника
            <input name="sources" type="url" required />
          </label>
          <button className="button">Опубликовать статью</button>
        </form>
      </div>
    </section>
  )
}
