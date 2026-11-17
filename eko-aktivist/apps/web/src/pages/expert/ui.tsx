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

export function Expert() {
  const { data: me, isPending: mePending, error: meError } = useMe()
  const list = useList('/expert/questions')
  const { data } = list
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  if (mePending) return <Loading />
  if (meError)
    return (
      <QueryState isPending={false} error={meError}>
        {null}
      </QueryState>
    )
  if (!me?.expert_permission && me?.role !== 'admin')
    return (
      <div className="empty">
        <h2>Нет доступа</h2>
        <p>Для этого раздела нужна роль эксперта.</p>
      </div>
    )
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">ЭКСПЕРТ</span>
        <h1>Вопросы участников</h1>
      </div>
      <Alert error={error} />
      {list.isPending ? (
        <Loading variant="list" />
      ) : list.error ? (
        <QueryState isPending={false} error={list.error} retry={list.refetch}>
          {null}
        </QueryState>
      ) : data?.items?.length ? (
        data.items.map((q: any) => (
          <form
            className="panel stacked"
            key={q.id}
            onSubmit={async (e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              try {
                await put(`/expert/questions/${q.id}/answer`, { answer: f.get('answer') })
                query.invalidateQueries()
              } catch (e) {
                setError(e)
              }
            }}
          >
            <span className="eyebrow">{q.category || 'Без категории'}</span>
            <h2>{q.text || 'Вопрос без текста'}</h2>
            <label>
              Ваш ответ
              <textarea name="answer" minLength={10} maxLength={5000} required />
            </label>
            <button className="button">Ответить ↗</button>
          </form>
        ))
      ) : (
        <EmptyState title="Новых вопросов нет">Новые вопросы появятся здесь.</EmptyState>
      )}
    </section>
  )
}
