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

export function Offers() {
  const query = useList('/offers')
  const items = query.data?.items ?? []
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">ПРИЯТНОЕ ПРОДОЛЖЕНИЕ</span>
        <h1>Награды за действия</h1>
        <p>
          Обменивайте подтверждённые баллы на предложения партнёров. Учебные предложения помечены.
        </p>
      </div>
      {query.isPending ? (
        <Loading variant="grid" />
      ) : query.error ? (
        <QueryState isPending={false} error={query.error} retry={query.refetch} variant="grid">
          {null}
        </QueryState>
      ) : items.length ? (
        <div className="card-grid">
          {items.map((o: any) => (
            <Link key={o.id} className="offer-card" to={`/offers/${o.id}`}>
              <span className="offer-icon">✳</span>
              {o.is_demo && <span className="tag">Учебное предложение</span>}
              <h2>{o.title || 'Предложение партнёра'}</h2>
              <p>{o.partner_name || 'Партнёр не указан'}</p>
              <div className="card-bottom">
                <strong>{o.price ?? '—'} баллов</strong>
                <span className="circle-arrow">↗</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Пока нет доступных наград">
          Новые предложения партнёров появятся здесь.
        </EmptyState>
      )}
    </section>
  )
}
