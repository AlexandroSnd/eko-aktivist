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

export function Leaders() {
  const query = useList('/leaders')
  const items = query.data?.items ?? []
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">ЛЮДИ ДЕЛА</span>
        <h1>Эколидеры</h1>
      </div>
      {query.isPending ? (
        <Loading variant="list" />
      ) : query.error ? (
        <QueryState isPending={false} error={query.error} retry={query.refetch} variant="list">
          {null}
        </QueryState>
      ) : items.length ? (
        <div className="panel">
          {items.map((u: any) => (
            <div className="row-item" key={u.id}>
              <b>{u.name || 'Имя не указано'}</b>
              <small>{u.city || 'Город не указан'}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Эколидеров пока нет">
          Здесь появятся организаторы экологических акций.
        </EmptyState>
      )}
    </section>
  )
}
