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

export function Auth({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const query = useQueryClient()
  const [error, setError] = useState<any>()
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body: any = Object.fromEntries(form)
    setBusy(true)
    try {
      await initCsrf()
      await post(`/auth/${mode}`, body)
      await initCsrf()
      query.invalidateQueries({ queryKey: ['me'] })
      navigate('/profile')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="auth-page">
      <div className="auth-copy">
        <span className="eyebrow">ДЕЙСТВИЯ ОБЪЕДИНЯЮТ</span>
        <h1>{mode === 'login' ? 'С возвращением!' : 'Начните с малого. Измените многое.'}</h1>
        <p>Ваша история добрых дел и новые возможности рядом.</p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <Alert error={error} />
        {mode === 'register' && (
          <label>
            Ваше имя
            <input name="name" minLength={2} maxLength={80} required />
          </label>
        )}
        <label>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Пароль
          <input
            type="password"
            name="password"
            minLength={mode === 'register' ? 10 : undefined}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        <button className="button wide" disabled={busy}>
          {busy ? 'Подождите…' : mode === 'login' ? 'Войти ↗' : 'Создать аккаунт ↗'}
        </button>
        <p className="muted">
          {mode === 'login' ? (
            <>
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </>
          ) : (
            <>
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </>
          )}
        </p>
      </form>
    </section>
  )
}
