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

export function EventCommunity() {
  const { id } = useParams()
  const competition = useData(`/events/${id}/competition`)
  const feedback = useData(`/events/${id}/feedback`)
  const photos = useData(`/events/${id}/photos`)
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [message, setMessage] = useState('')
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const text = String(new FormData(form).get('text'))
    try {
      await post(`/events/${id}/feedback`, { text })
      query.invalidateQueries({ queryKey: [`/events/${id}/feedback`] })
      setError(null)
      setMessage('Спасибо за отзыв')
      form.reset()
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  async function uploadFeedbackPhotos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    try {
      await api(`/events/${id}/feedback/photos`, { method: 'POST', body: new FormData(form) })
      query.invalidateQueries({ queryKey: [`/events/${id}/feedback`] })
      setError(null)
      setMessage('Фото добавлены')
      form.reset()
    } catch (caught) {
      setError(caught)
      setMessage('')
    }
  }
  return (
    <section className="page-section narrow">
      <Link className="back" to={`/events/${id}`}>
        ← К событию
      </Link>
      <span className="eyebrow">ПОСЛЕ АКЦИИ</span>
      <h1>Результаты и отзывы</h1>
      <div className="panel">
        <h2>Командное соревнование</h2>
        {competition.data?.items?.length ? (
          competition.data.items.map((item: any) => (
            <div className="row-item" key={item.team_id}>
              <b>
                #{item.rank} · {item.team_name}
              </b>
              <span>{item.base_score} баллов</span>
            </div>
          ))
        ) : (
          <p>Командных результатов пока нет.</p>
        )}
      </div>
      <div className="panel">
        <h2>Фото акции</h2>
        {photos.data?.items?.map((item: any) => (
          <figure className="event-photo" key={item.id}>
            <img
              src={`/uploads/${item.path}`}
              alt={item.kind === 'before' ? 'До акции' : 'После акции'}
            />
            <figcaption>{item.kind === 'before' ? 'До' : 'После'}</figcaption>
          </figure>
        ))}
      </div>
      <div className="panel">
        <h2>Отзывы участников</h2>
        {feedback.data?.items?.map((item: any) => (
          <article className="question" key={item.id}>
            <b>{item.name}</b>
            <p>{item.text}</p>
            {item.photo_paths?.map((path: string) => (
              <img
                className="feedback-photo"
                src={`/uploads/${path}`}
                alt="Фото участника"
                key={path}
              />
            ))}
          </article>
        ))}
      </div>
      <form className="panel stacked" onSubmit={submit}>
        <h2>Оставить отзыв</h2>
        <p>Доступно после подтверждённого участия в завершённой акции.</p>
        <ErrorMessage error={error} />
        {message && <div className="success">{message}</div>}
        <label>
          Ваш отзыв
          <textarea name="text" minLength={1} maxLength={1000} required />
        </label>
        <button className="button">Опубликовать отзыв</button>
      </form>
      <form className="panel stacked" onSubmit={uploadFeedbackPhotos}>
        <h2>Добавить фото к своему отзыву</h2>
        <label>
          До двух JPEG/PNG по 5 МБ
          <input name="files" type="file" accept="image/jpeg,image/png" multiple required />
        </label>
        <button className="button ghost">Загрузить фото</button>
      </form>
    </section>
  )
}
