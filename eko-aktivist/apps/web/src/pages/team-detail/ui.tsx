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

export function TeamDetail() {
  const { id } = useParams()
  const { data, isLoading } = useList(`/teams/${id}`)
  const { data: me } = useMe()
  const [error, setError] = useState<any>()
  const query = useQueryClient()
  async function join() {
    try {
      await post(`/teams/${id}/join`)
      query.invalidateQueries({ queryKey: [`/teams/${id}`] })
    } catch (e) {
      setError(e)
    }
  }
  if (isLoading) return <Loading />
  if (!data) return <div className="empty">Команда не найдена</div>
  return (
    <section className="page-section narrow">
      <Link className="back" to="/teams">
        ← Команды
      </Link>
      <span className="eyebrow">КОМАНДА</span>
      <h1>{data.name}</h1>
      <p className="lead">{data.description}</p>
      {me && (
        <Link className="button ghost" to={'/teams/' + id + '/membership'}>
          Моё членство ↗
        </Link>
      )}
      <Alert error={error} />
      <div className="panel">
        <h2>Участники · {data.members?.length}</h2>
        {data.members?.map((m: any) => (
          <div className="row-item" key={m.id}>
            <span>
              {m.name} {m.id === data.captain_id ? '· капитан' : ''}
            </span>
            <small>{m.city}</small>
          </div>
        ))}
      </div>
      {me && (
        <button className="button" onClick={join}>
          Вступить в команду
        </button>
      )}
    </section>
  )
}
