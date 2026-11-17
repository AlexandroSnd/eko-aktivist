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

export function Notifications() {
  const list = useList('/notifications')
  const { data } = list
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  async function markRead(id: string) {
    try {
      await post('/notifications/' + id + '/read')
      query.invalidateQueries({ queryKey: ['/notifications'] })
      setError(null)
    } catch (caught) {
      setError(caught)
    }
  }
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">БУДЬТЕ В КУРСЕ</span>
        <h1>Уведомления</h1>
        <p>Новости выбранных акций и ответы эксперта.</p>
        <Link className="button ghost" to="/notifications/settings">
          Настроить подписку ↗
        </Link>
      </div>
      <Alert error={error} />
      <div className="panel">
        <h2>События</h2>
        {list.isPending ? (
          <Loading variant="list" />
        ) : list.error ? (
          <QueryState isPending={false} error={list.error} retry={list.refetch} variant="list">
            {null}
          </QueryState>
        ) : data?.items?.length ? (
          data.items.map((n: any) => (
            <div className="row-item" key={n.id}>
              <div>
                <b>{n.message || 'Новое уведомление'}</b>
                <small>{n.read_at ? 'Прочитано' : 'Новое'}</small>
                {n.event_id && <Link to={'/events/' + n.event_id}>Открыть акцию →</Link>}
              </div>
              {!n.read_at && (
                <button className="text-button" onClick={() => markRead(n.id)}>
                  Прочитано
                </button>
              )}
            </div>
          ))
        ) : (
          <EmptyState title="Уведомлений пока нет">
            Здесь появятся новости об акциях и ответы экспертов.
          </EmptyState>
        )}
      </div>
    </section>
  )
}
