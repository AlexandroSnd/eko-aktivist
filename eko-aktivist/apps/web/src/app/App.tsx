import React from 'react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { post } from '../shared/api'
import { Guard, useMe } from '../shared/ui'
import { Home } from '../pages/home/ui'
import { Events } from '../pages/events/ui'
import { EventDetail } from '../pages/event-detail/ui'
import { Auth } from '../pages/auth/ui'
import { Profile } from '../pages/profile/ui'
import { Teams } from '../pages/teams/ui'
import { TeamDetail } from '../pages/team-detail/ui'
import { Rating } from '../pages/rating/ui'
import { Offers } from '../pages/offers/ui'
import { OfferDetail } from '../pages/offer-detail/ui'
import { Knowledge } from '../pages/knowledge/ui'
import { Leaders } from '../pages/leaders/ui'
import { Questions } from '../pages/questions/ui'
import { Notifications } from '../pages/notifications/ui'
import { Organizer } from '../pages/organizer/ui'
import { OrganizerDetail } from '../pages/organizer-detail/ui'
import { Admin } from '../pages/admin/ui'
import { Partner } from '../pages/partner/ui'
import { Expert } from '../pages/expert/ui'
import { EventEditor } from '../pages/event-editor/ui'
import { EventCommunity } from '../pages/event-community/ui'
import { AdminTools } from '../pages/admin-tools/ui'
import { PartnerOfferEditor } from '../pages/partner-offer-editor/ui'
import { ProfileSettings } from '../pages/profile-settings/ui'
import { NotificationSettings } from '../pages/notification-settings/ui'
import { ArticlesAdmin } from '../pages/articles-admin/ui'
import { TeamMembership } from '../pages/team-membership/ui'

export function AppLayout() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const query = useQueryClient()
  async function logout() {
    await post('/auth/logout')
    query.clear()
    navigate('/')
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-icon">✳</span>
          <span>
            Эко <b>Активист</b>
          </span>
        </Link>
        <nav aria-label="Основная навигация">
          <NavLink to="/events">Акции</NavLink>
          <NavLink to="/teams">Команды</NavLink>
          <NavLink to="/rating">Рейтинг</NavLink>
          <NavLink to="/offers">Награды</NavLink>
          <NavLink to="/knowledge">Знания</NavLink>
        </nav>
        <div className="header-actions">
          {me ? (
            <>
              <Link to="/profile" className="avatar" aria-label="Профиль">
                {me.name?.slice(0, 1)}
              </Link>
              <button className="text-button" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <Link className="button small" to="/login">
              Войти
            </Link>
          )}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route
            path="/profile"
            element={
              <Guard>
                <Profile />
              </Guard>
            }
          />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/rating" element={<Rating />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/offers/:id" element={<OfferDetail />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/leaders" element={<Leaders />} />
          <Route
            path="/questions"
            element={
              <Guard>
                <Questions />
              </Guard>
            }
          />
          <Route
            path="/notifications"
            element={
              <Guard>
                <Notifications />
              </Guard>
            }
          />
          <Route
            path="/organizer/events"
            element={
              <Guard roles={['organizer', 'admin']}>
                <Organizer />
              </Guard>
            }
          />
          <Route
            path="/organizer/events/:id"
            element={
              <Guard roles={['organizer', 'admin']}>
                <OrganizerDetail />
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard roles={['admin']}>
                <Admin />
              </Guard>
            }
          />
          <Route
            path="/partner"
            element={
              <Guard roles={['partner', 'admin']}>
                <Partner />
              </Guard>
            }
          />
          <Route
            path="/expert"
            element={
              <Guard>
                <Expert />
              </Guard>
            }
          />
          <Route path="/events/:id/community" element={<EventCommunity />} />
          <Route
            path="/organizer/events/:id/edit"
            element={
              <Guard roles={['organizer', 'admin']}>
                <EventEditor />
              </Guard>
            }
          />
          <Route
            path="/admin/tools"
            element={
              <Guard roles={['admin']}>
                <AdminTools />
              </Guard>
            }
          />
          <Route
            path="/partner/offers/:id"
            element={
              <Guard roles={['partner', 'admin']}>
                <PartnerOfferEditor />
              </Guard>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <Guard>
                <ProfileSettings />
              </Guard>
            }
          />
          <Route
            path="/notifications/settings"
            element={
              <Guard>
                <NotificationSettings />
              </Guard>
            }
          />
          <Route
            path="/admin/articles"
            element={
              <Guard roles={['admin']}>
                <ArticlesAdmin />
              </Guard>
            }
          />
          <Route
            path="/teams/:id/membership"
            element={
              <Guard>
                <TeamMembership />
              </Guard>
            }
          />
          <Route path="*" element={<div className="empty">Страница не найдена</div>} />
        </Routes>
      </main>
      <footer>
        <span>✳ Эко Активист · Екатеринбург</span>
        <span>Локальные действия с видимым результатом</span>
      </footer>
    </div>
  )
}
