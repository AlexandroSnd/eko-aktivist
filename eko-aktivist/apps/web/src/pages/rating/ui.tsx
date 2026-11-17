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

export function Rating() {
  const query = useList('/rating')
  const items = query.data?.items ?? []
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">ЛЮДИ, КОТОРЫЕ ДЕЙСТВУЮТ</span>
        <h1>Рейтинг участников</h1>
        <p>Учитываются заработанные баллы. Обмен на награды не меняет место.</p>
      </div>
      {query.isPending ? (
        <Loading variant="list" />
      ) : query.error ? (
        <QueryState isPending={false} error={query.error} retry={query.refetch} variant="list">
          {null}
        </QueryState>
      ) : items.length ? (
        <div className="panel">
          {items.map((u: any, i: number) => (
            <div className="rating-row" key={u.id}>
              <b className="rank">{String(i + 1).padStart(2, '0')}</b>
              <span>
                {u.name || 'Участник'}
                <small>{u.city || 'Город не указан'}</small>
              </span>
              <strong>{u.points ?? 0} ✳</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Рейтинг пока пуст">
          Баллы появятся после подтверждённых участий.
        </EmptyState>
      )}
    </section>
  )
}
