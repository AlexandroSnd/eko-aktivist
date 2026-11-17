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

export function Partner() {
  const list = useList('/partner/offers')
  const { data } = list
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any>()
  const [error, setError] = useState<any>()
  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    try {
      setResult(await post('/partner/redemptions/redeem', { code }))
      setError(null)
    } catch (e) {
      setError(e)
    }
  }
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">КАБИНЕТ ПАРТНЁРА</span>
        <h1>Предложения и коды</h1>
      </div>
      <form className="panel stacked" onSubmit={redeem}>
        <h2>Погасить код</h2>
        <Alert error={error} />
        <label>
          Код награды
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button className="button">Погасить</button>
        {result && <p className="success">Код погашен · {result.id}</p>}
      </form>
      <div className="panel">
        <h2>Мои предложения</h2>
        {list.isPending ? (
          <Loading variant="list" />
        ) : list.error ? (
          <QueryState isPending={false} error={list.error} retry={list.refetch}>
            {null}
          </QueryState>
        ) : data?.items?.length ? (
          data.items.map((o: any) => (
            <div className="row-item" key={o.id}>
              <Link to={`/partner/offers/${o.id}`}>
                <b>{o.title || 'Предложение без названия'}</b>
              </Link>
              <small>Остаток: {o.stock ?? '—'}</small>
            </div>
          ))
        ) : (
          <EmptyState title="Предложений пока нет">
            Добавленные партнёром предложения появятся здесь.
          </EmptyState>
        )}
      </div>
    </section>
  )
}
