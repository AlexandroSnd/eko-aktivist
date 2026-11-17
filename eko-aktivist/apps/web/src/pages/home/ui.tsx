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

export function Home() {
  const query = useList('/events?page_size=3')
  const items = query.data?.items ?? []
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">ЕКАТЕРИНБУРГ · ЭКО ДВИЖЕНИЕ</span>
          <h1>
            Хорошие дела
            <br />
            <em>начинаются рядом.</em>
          </h1>
          <p>Находите экологические акции, участвуйте вместе и видите свой подтверждённый вклад.</p>
          <div className="hero-actions">
            <Link className="button" to="/events">
              Найти акцию <span>↗</span>
            </Link>
            <Link className="button ghost" to="/knowledge">
              Как это работает
            </Link>
          </div>
          <div className="hero-note">
            <span className="line" /> Реальные действия. Понятный результат.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="hill hill-one" />
          <div className="hill hill-two" />
          <div className="sprout">
            <span>✳</span>
          </div>
          <div className="art-label">
            Маленький шаг
            <br />
            для большого города
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">ПРИСОЕДИНЯЙТЕСЬ</span>
            <h2>Ближайшие акции</h2>
          </div>
          <Link className="arrow-link" to="/events">
            Все акции ↗
          </Link>
        </div>
        {query.isPending ? (
          <Loading variant="grid" count={3} />
        ) : query.error ? (
          <QueryState isPending={false} error={query.error} retry={query.refetch} variant="grid">
            {null}
          </QueryState>
        ) : items.length ? (
          <div className="card-grid">
            {items.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState title="Ближайших акций пока нет">
            Загляните позже или посмотрите полный список акций.
          </EmptyState>
        )}
      </section>
      <section className="steps">
        <span className="eyebrow">ПРОСТОЙ ПУТЬ</span>
        <h2>От желания помочь — к результату</h2>
        <div className="steps-grid">
          <div>
            <b>01</b>
            <h3>Выберите акцию</h3>
            <p>По дате, месту и виду деятельности.</p>
          </div>
          <div>
            <b>02</b>
            <h3>Присоединитесь</h3>
            <p>Запишитесь и получите нужную информацию.</p>
          </div>
          <div>
            <b>03</b>
            <h3>Увидьте вклад</h3>
            <p>Организатор подтвердит результат, а мы сохраним его в профиле.</p>
          </div>
        </div>
      </section>
    </>
  )
}
