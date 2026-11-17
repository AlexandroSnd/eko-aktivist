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

export function Teams() {
  const list = useList('/teams')
  const data = list.data
  const items = data?.items ?? []
  const { data: me } = useMe()
  const [error, setError] = useState<any>()
  const query = useQueryClient()
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await post('/teams', Object.fromEntries(form))
      query.invalidateQueries({ queryKey: ['/teams'] })
      ;(e.currentTarget as HTMLFormElement).reset()
    } catch (e) {
      setError(e)
    }
  }
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">ВМЕСТЕ СИЛЬНЕЕ</span>
        <h1>Команды</h1>
        <p>Объединяйтесь с людьми, которым тоже важен город.</p>
      </div>
      <Alert error={error} />
      <div className="two-cols">
        <div className="panel">
          <h2>Все команды</h2>
          {list.isPending ? (
            <Loading variant="list" />
          ) : list.error ? (
            <QueryState isPending={false} error={list.error} retry={list.refetch} variant="list">
              {null}
            </QueryState>
          ) : items.length ? (
            items.map((t: any) => (
              <div className="row-item" key={t.id}>
                <Link to={`/teams/${t.id}`}>
                  <b>{t.name || 'Команда без названия'}</b>
                  <small>{t.description || 'Описание пока не добавлено.'}</small>
                </Link>
                <span>↗</span>
              </div>
            ))
          ) : (
            <EmptyState title="Команд пока нет">
              Создайте первую команду и пригласите участников.
            </EmptyState>
          )}
        </div>
        {me && (
          <form className="panel stacked" onSubmit={create}>
            <h2>Создать команду</h2>
            <label>
              Название
              <input name="name" minLength={3} maxLength={60} required />
            </label>
            <label>
              Описание
              <textarea name="description" maxLength={500} />
            </label>
            <button className="button">Создать ↗</button>
          </form>
        )}
      </div>
    </section>
  )
}
