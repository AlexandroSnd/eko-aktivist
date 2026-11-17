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

export function PartnerOfferEditor() {
  const { id } = useParams()
  const list = useData('/partner/offers')
  const offer = list.data?.items?.find((item: any) => item.id === id)
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [saved, setSaved] = useState(false)
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try {
      await patch(`/partner/offers/${id}`, {
        description: f.get('description'),
        stock: Number(f.get('stock')),
      })
      query.invalidateQueries()
      setError(null)
      setSaved(true)
    } catch (caught) {
      setError(caught)
      setSaved(false)
    }
  }
  if (!offer) return <section className="page-section">Загружаем предложение…</section>
  return (
    <section className="page-section narrow">
      <Link className="back" to="/partner">
        ← Мои предложения
      </Link>
      <span className="eyebrow">КАБИНЕТ ПАРТНЁРА</span>
      <h1>{offer.title}</h1>
      <p className="lead">
        Цена: {offer.price} баллов. Партнёр может менять только описание и остаток.
      </p>
      <form className="panel stacked" onSubmit={save}>
        <ErrorMessage error={error} />
        {saved && <div className="success">Сохранено</div>}
        <label>
          Описание
          <textarea name="description" defaultValue={offer.description} minLength={5} required />
        </label>
        <label>
          Остаток
          <input name="stock" type="number" min={0} defaultValue={offer.stock} required />
        </label>
        <button className="button">Сохранить</button>
      </form>
    </section>
  )
}
