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
import { Alert, ErrorMessage, Loading, useData, useList, useMe } from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

export function OfferDetail() {
  const { id } = useParams()
  const { data: offer } = useList(`/offers/${id}`)
  const { data: me } = useMe()
  const [result, setResult] = useState<any>()
  const [error, setError] = useState<any>()
  const query = useQueryClient()
  async function redeem() {
    try {
      const key = crypto.randomUUID()
      const r = await api('/redemptions', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ offer_id: id }),
      })
      setResult(r)
      query.invalidateQueries({ queryKey: ['me'] })
    } catch (e) {
      setError(e)
    }
  }
  if (!offer) return <Loading />
  return (
    <section className="page-section narrow">
      <Link className="back" to="/offers">
        ← Награды
      </Link>
      <span className="eyebrow">
        {offer.is_demo ? 'УЧЕБНОЕ ПРЕДЛОЖЕНИЕ' : 'ПРЕДЛОЖЕНИЕ ПАРТНЁРА'}
      </span>
      <h1>{offer.title}</h1>
      <p className="lead">{offer.description}</p>
      <div className="panel">
        <h2>{offer.price} ЭкоБаллов</h2>
        <p>
          Осталось: {offer.stock}. Код действует до {formatDate(offer.expires_at)}.
        </p>
        <Alert error={error} />
        {result ? (
          <div className="success">
            Ваш одноразовый код: <b>{result.code}</b>
          </div>
        ) : me ? (
          <button className="button" onClick={redeem}>
            Обменять баллы ↗
          </button>
        ) : (
          <Link className="button" to="/login">
            Войти для обмена
          </Link>
        )}
      </div>
    </section>
  )
}
