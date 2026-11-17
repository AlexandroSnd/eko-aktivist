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

export function Knowledge() {
  const query = useList('/articles')
  const items = query.data?.items ?? []
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">УЗНАВАЙТЕ БОЛЬШЕ</span>
        <h1>База знаний</h1>
        <p>Короткие материалы для тех, кто хочет действовать осознанно.</p>
      </div>
      {query.isPending ? (
        <Loading variant="grid" />
      ) : query.error ? (
        <QueryState isPending={false} error={query.error} retry={query.refetch} variant="grid">
          {null}
        </QueryState>
      ) : items.length ? (
        <div className="card-grid">
          {items.map((a: any) => (
            <article className="panel article" key={a.id}>
              <span className="eyebrow">{a.category || 'Материал'}</span>
              <h2>{a.title || 'Без названия'}</h2>
              <p>{a.text || 'Описание пока не добавлено.'}</p>
              {a.sources?.map((s: string) => (
                <a href={s} key={s} target="_blank" rel="noreferrer">
                  Источник ↗
                </a>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Материалов пока нет">Новые статьи появятся в базе знаний.</EmptyState>
      )}
      <div className="quick-links">
        <Link to="/leaders">Эколидеры ↗</Link>
        <Link to="/questions">Задать вопрос эксперту ↗</Link>
      </div>
    </section>
  )
}
