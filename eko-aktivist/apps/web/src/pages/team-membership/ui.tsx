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

export function TeamMembership() {
  const { id } = useParams()
  const team = useData(`/teams/${id}`)
  const me = useData('/me')
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [message, setMessage] = useState('')
  async function leave() {
    try {
      await post(`/teams/${id}/leave`)
      query.invalidateQueries()
      setError(null)
      setMessage('Вы вышли из команды')
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  if (!team.data || !me.data) return <section className="page-section">Загружаем команду…</section>
  const isMember = team.data.members?.some((member: any) => member.id === me.data.id)
  return (
    <section className="page-section narrow">
      <Link className="back" to={`/teams/${id}`}>
        ← Команда
      </Link>
      <span className="eyebrow">ЧЛЕНСТВО</span>
      <h1>{team.data.name}</h1>
      <ErrorMessage error={error} />
      {message && <div className="success">{message}</div>}
      {isMember ? (
        <div className="panel">
          <p>Вы состоите в команде. Прошлые командные результаты сохранятся после выхода.</p>
          <button className="button ghost" onClick={leave}>
            Выйти из команды
          </button>
        </div>
      ) : (
        <p>Вы не состоите в этой команде.</p>
      )}
    </section>
  )
}
