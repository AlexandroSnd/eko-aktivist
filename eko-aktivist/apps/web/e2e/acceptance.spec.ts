import { expect, test, type Page } from '@playwright/test'

const demoPassword = 'DemoPassword123!'

async function login(page: Page, email: string, password = demoPassword) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: /Войти/ }).click()
  await expect(page).toHaveURL(/\/profile$/)
}

test('гость находит акцию, видит карточку и обрабатывает недоступность карты (FR-04, FR-05)', async ({
  page,
}) => {
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort())
  await page.goto('/events')
  await expect(page.getByRole('heading', { name: 'Экологические акции' })).toBeVisible()
  await expect(page.getByText('Найдено акций:')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Тип акции' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Скрыть карту' })).toBeVisible()
  const firstEvent = page.locator('.list-cards a.event-card').first()
  await expect(firstEvent).toBeVisible()
  const title = await firstEvent.locator('h3').innerText()
  await firstEvent.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Что взять с собой')).toBeVisible()
})

test('карта обновляет выдачу при перемещении, показывает маркеры и работает на мобильном экране', async ({
  page,
  context,
}) => {
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort())
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 56.912, longitude: 60.733 })
  const mapRequests: URL[] = []
  const listRequests: URL[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/events/map')) mapRequests.push(url)
    else if (url.pathname.endsWith('/events')) listRequests.push(url)
  })

  await page.goto('/events')
  const map = page.locator('.leaflet-container')
  await expect(map).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  await expect(
    page.getByText('Подложка карты недоступна. Список акций остаётся рабочим.'),
  ).toBeVisible()
  const latestMapBbox = () =>
    mapRequests
      .filter((url) => url.searchParams.has('bbox'))
      .at(-1)
      ?.searchParams.get('bbox')
  const initialBounds = latestMapBbox()
  expect(initialBounds).toBeTruthy()

  await map.scrollIntoViewIfNeeded()
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('Map has no visible bounds')
  await map.dragTo(map, {
    sourcePosition: { x: bounds.width * 0.8, y: bounds.height * 0.8 },
    targetPosition: { x: bounds.width * 0.55, y: bounds.height * 0.72 },
  })
  await expect.poll(latestMapBbox).not.toBe(initialBounds)
  const pannedBounds = latestMapBbox()
  await expect
    .poll(() => listRequests.some((url) => url.searchParams.get('bbox') === pannedBounds))
    .toBeTruthy()

  await page.getByLabel('Тип акции').selectOption('cleanup')
  await expect
    .poll(() =>
      mapRequests
        .filter((url) => url.searchParams.has('bbox'))
        .at(-1)
        ?.searchParams.get('type'),
    )
    .toBe('cleanup')
  await expect
    .poll(() =>
      listRequests
        .filter((url) => url.searchParams.has('bbox'))
        .at(-1)
        ?.searchParams.get('type'),
    )
    .toBe('cleanup')
  const filteredBounds = latestMapBbox()
  await page.getByRole('button', { name: 'Моё местоположение' }).click()
  await expect.poll(latestMapBbox).not.toBe(filteredBounds)
  await expect
    .poll(() =>
      mapRequests
        .filter((url) => url.searchParams.has('bbox'))
        .at(-1)
        ?.searchParams.get('type'),
    )
    .toBe('cleanup')

  await page.setViewportSize({ width: 375, height: 812 })
  const mobileBounds = await map.boundingBox()
  expect(mobileBounds?.width).toBeGreaterThan(300)
  expect(mobileBounds?.height).toBeGreaterThanOrEqual(350)
})

test('регистрация, профиль, история, рейтинг и уведомления участника (FR-01, FR-02, FR-10–12, FR-21)', async ({
  page,
}) => {
  const email = `pw-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByLabel('Ваше имя').fill('Playwright Участник')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('PlaywrightPass123!')
  await page.getByRole('button', { name: /Создать аккаунт/ }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: /Playwright Участник/ })).toBeVisible()
  await page.goto('/profile/edit')
  await page.getByLabel('Город').fill('Екатеринбург')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Профиль сохранён')).toBeVisible()
  await page.goto('/rating')
  await expect(page.getByRole('heading', { name: 'Рейтинг участников', exact: true })).toBeVisible()
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Уведомления' })).toBeVisible()
  await page.goto('/notifications/settings')
  await expect(page.getByRole('heading', { name: 'Новые акции' })).toBeVisible()
})

test('волонтёр записывается и отменяет участие; закрытые разделы требуют прав (FR-06, FR-07)', async ({
  page,
}) => {
  await login(page, 'volunteer3@example.com')
  await page.goto('/events')
  const card = page.locator('.list-cards a.event-card').first()
  await card.click()
  const join = page.getByRole('button', { name: /Записаться/ })
  if (await join.isVisible()) {
    await join.click()
    await expect(page.getByRole('heading', { name: 'Вы записаны' })).toBeVisible()
    await page.getByRole('button', { name: 'Отменить запись' }).click()
    await expect(page.getByRole('button', { name: /Записаться/ })).toBeVisible()
  }
  await page.goto('/admin')
  await expect(page.getByText('Недостаточно прав')).toBeVisible()
})

test('организатор открывает управление событиями, участниками и статистикой (FR-03, FR-08, FR-22–23)', async ({
  page,
}) => {
  await login(page, 'organizer@example.com')
  await page.goto('/organizer/events')
  await expect(page.getByRole('heading', { name: 'Ваши акции' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Новая акция' })).toBeVisible()
  const pastEvent = page.getByRole('link', { name: /Учебная акция для подтверждения/ })
  await expect(pastEvent).toBeVisible()
  await pastEvent.click()
  await expect(page.getByRole('heading', { name: /Участники/ })).toBeVisible()
  await expect(page.getByText('Записаны')).toBeVisible()
  await expect(page.getByText('Подтверждены')).toBeVisible()
  const participantRow = page.locator('.participant-form').filter({ hasText: 'Волонтёр 2' })
  await expect(participantRow).toBeVisible()
  if ((await participantRow.locator('select[name="status"]').inputValue()) !== 'attended') {
    await participantRow.locator('select[name="status"]').selectOption('attended')
    await participantRow.locator('input[name="hours"]').fill('2')
    await participantRow.getByRole('button', { name: 'Сохранить' }).click()
  }
  await expect(participantRow.locator('select[name="status"]')).toHaveValue('attended')
  await expect(page.locator('.dashboard-stats')).toContainText('1')
  await participantRow.locator('input[name="hours"]').fill('1.5')
  await participantRow.locator('input[name="reason"]').fill('Исправление тестового результата')
  const correction = page.waitForResponse(
    (response) => response.url().includes('/result') && response.request().method() === 'PUT',
  )
  await participantRow.getByRole('button', { name: 'Сохранить' }).click()
  expect((await correction).status()).toBe(200)
  const complete = page.waitForResponse(
    (response) => response.url().endsWith('/complete') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Завершить' }).click()
  expect((await complete).status()).toBe(200)
  await participantRow.locator('input[name="hours"]').fill('1')
  await participantRow.locator('input[name="reason"]').fill('Попытка изменения после закрытия')
  const rejectedCorrection = page.waitForResponse(
    (response) => response.url().includes('/result') && response.request().method() === 'PUT',
  )
  await participantRow.getByRole('button', { name: 'Сохранить' }).click()
  expect((await rejectedCorrection).status()).toBe(409)
})

test('администратор управляет пользователями, публикует статью и считает возвращаемость (FR-02, FR-19, FR-24)', async ({
  page,
}) => {
  await login(page, 'admin@example.com', 'EkoTestAdmin123!')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Администрирование' })).toBeVisible()
  await page.goto('/admin/articles')
  await expect(page.getByRole('heading', { name: 'Статьи' })).toBeVisible()
  await page.goto('/admin')
  const articleTitle = `Статья Playwright ${Date.now()}`
  const articleForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: /Статьи ·/ }) })
  await articleForm.getByLabel('Заголовок').fill(articleTitle)
  await articleForm.getByLabel('Категория').fill('Проверка')
  await articleForm
    .getByLabel('Текст')
    .fill(
      'Практические рекомендации для участников экологических акций и организаторов событий в Екатеринбурге.',
    )
  await articleForm.getByLabel('URL источника').fill('https://example.com/environment')
  await articleForm.getByRole('button', { name: 'Опубликовать статью' }).click()
  const publicPage = await page.context().newPage()
  await publicPage.goto('/knowledge')
  await expect(publicPage.getByText(articleTitle)).toBeVisible()
  await publicPage.close()
  await page.goto('/admin/tools')
  await expect(page.getByRole('heading', { name: 'Управление и аналитика' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Возвращаемость за 14 дней' })).toBeVisible()
  const retentionForm = page.locator('form').filter({ has: page.getByLabel('Начало когорты') })
  const dateField = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('Начало когорты').fill(dateField(60))
  await page.getByLabel('Конец когорты').fill(dateField(30))
  await retentionForm.getByRole('button', { name: 'Рассчитать' }).click()
  await expect(page.getByText(/Наблюдаемых:/)).toBeVisible()
})

test('каталоги знаний, эколидеров, команд и наград доступны гостю (FR-11, FR-13, FR-16, FR-19)', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/knowledge', 'База знаний'],
    ['/leaders', 'Эколидеры'],
    ['/teams', 'Команды'],
    ['/offers', 'Награды за действия'],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
})

test('участник создаёт команду, другой участник вступает и выходит (FR-13)', async ({
  page,
  browser,
}) => {
  const teamName = `Команда PW ${Date.now()}`
  await page.goto('/register')
  await page.getByLabel('Ваше имя').fill('Создатель команды PW')
  await page.getByLabel('Email').fill(`captain-${Date.now()}@example.com`)
  await page.getByLabel('Пароль').fill('PlaywrightPass123!')
  await page.getByRole('button', { name: /Создать аккаунт/ }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await page.goto('/teams')
  await page.getByLabel('Название').fill(teamName)
  await page.getByLabel('Описание').fill('Команда для проверки сценария участия Playwright')
  await page.getByRole('button', { name: 'Создать ↗' }).click()
  const teamLink = page.getByRole('link', { name: teamName })
  await expect(teamLink).toBeVisible()
  await teamLink.click()
  await expect(page.getByRole('heading', { name: teamName, exact: true })).toBeVisible()
  const memberPage = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await memberPage.goto('/register')
  await memberPage.getByLabel('Ваше имя').fill('Участник команды PW')
  await memberPage.getByLabel('Email').fill(`member-${Date.now()}@example.com`)
  await memberPage.getByLabel('Пароль').fill('PlaywrightPass123!')
  await memberPage.getByRole('button', { name: /Создать аккаунт/ }).click()
  await expect(memberPage).toHaveURL(/\/profile$/)
  await memberPage.goto(page.url())
  await memberPage.getByRole('button', { name: 'Вступить в команду' }).click()
  await expect(memberPage.getByText(/Участники · 2/)).toBeVisible()
  const eventsResponse = await memberPage.request.get('http://127.0.0.1:8080/api/v1/events?page=1')
  const events = await eventsResponse.json()
  const competitiveEvent = events.items.find((event: any) => event.competition_enabled)
  expect(competitiveEvent).toBeTruthy()
  await memberPage.goto(`/events/${competitiveEvent.id}`)
  const teamChoice = memberPage.getByRole('checkbox', {
    name: new RegExp(`Участвовать от команды «${teamName}»`),
  })
  await expect(teamChoice).toBeVisible()
  await teamChoice.check()
  await memberPage.getByRole('button', { name: /Записаться/ }).click()
  await expect(memberPage.getByRole('heading', { name: 'Вы записаны' })).toBeVisible()
  await memberPage.goto(page.url())
  await memberPage.getByRole('link', { name: /Моё членство/ }).click()
  await memberPage.getByRole('button', { name: 'Выйти из команды' }).click()
  await expect(memberPage.getByText('Вы вышли из команды')).toBeVisible()
  await memberPage.close()
})

test('обмен баллов, затем погашение кода партнёром (FR-09, FR-16–18)', async ({
  page,
  browser,
}) => {
  await login(page, 'volunteer1@example.com')
  await page.goto('/offers')
  const offer = page.locator('a.offer-card').filter({ hasText: 'Эко магазин' }).first()
  await expect(offer).toBeVisible()
  const offerName = await offer.locator('h2').innerText()
  await offer.click()
  await expect(page.getByRole('heading', { name: offerName })).toBeVisible()
  const exchange = page.getByRole('button', { name: /Обменять баллы/ })
  await expect(exchange).toBeVisible()
  await exchange.click()
  await expect(page.getByText('Ваш одноразовый код:')).toBeVisible()
  const code = await page.locator('.success b').innerText()

  const partnerEmail = `pw-partner-${Date.now()}@example.com`
  const partnerPage = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await partnerPage.goto('/register')
  await partnerPage.getByLabel('Ваше имя').fill('Партнёр Playwright')
  await partnerPage.getByLabel('Email').fill(partnerEmail)
  await partnerPage.getByLabel('Пароль').fill('PlaywrightPass123!')
  await partnerPage.getByRole('button', { name: /Создать аккаунт/ }).click()
  await expect(partnerPage).toHaveURL(/\/profile$/)
  await partnerPage.getByRole('button', { name: 'Выйти' }).click()
  await expect(partnerPage).toHaveURL('/')

  const adminPage = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await login(adminPage, 'admin@example.com', 'EkoTestAdmin123!')
  await adminPage.goto('/admin')
  const userRow = adminPage.locator('.row-item').filter({ hasText: partnerEmail })
  const roleUpdate = adminPage.waitForResponse(
    (response) =>
      response.url().includes('/permissions') && response.request().method() === 'PATCH',
  )
  await userRow.locator('select').selectOption('partner')
  expect((await roleUpdate).status()).toBe(200)
  await adminPage.goto('/admin/tools')
  await adminPage.reload()
  const partnersPanel = adminPage
    .locator('.panel')
    .filter({ has: adminPage.getByRole('heading', { name: 'Партнёры', exact: true }) })
  const partnerForm = partnersPanel.locator('form').first()
  const operator = partnerForm.locator('select[name="operator_user_id"]')
  await expect(operator.locator('option').filter({ hasText: partnerEmail })).toHaveCount(1)
  await operator.selectOption({ label: `Партнёр Playwright · ${partnerEmail}` })
  await partnerForm.getByRole('button', { name: 'Сохранить партнёра' }).click()
  await adminPage.close()

  await login(partnerPage, partnerEmail, 'PlaywrightPass123!')
  await partnerPage.goto('/partner')
  await partnerPage.getByLabel('Код награды').fill(code)
  await partnerPage.getByRole('button', { name: 'Погасить' }).click()
  await expect(partnerPage.getByText(/Код погашен/)).toBeVisible()
  await partnerPage.close()
})

test('вопрос получает ответ эксперта и уведомление читается; подписка сохраняется (FR-20, FR-21)', async ({
  page,
  browser,
}) => {
  await login(page, 'volunteer3@example.com')
  await page.goto('/questions')
  const question = `Как участвовать? ${Date.now()}`
  await page.getByLabel('Категория').fill('Участие')
  await page.getByLabel('Вопрос').fill(question)
  await page.getByRole('button', { name: /Отправить/ }).click()
  await expect(page.getByText(question)).toBeVisible()

  const adminPage = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await login(adminPage, 'admin@example.com', 'EkoTestAdmin123!')
  await adminPage.goto('/admin/tools')
  const permissions = adminPage
    .locator('.permission-row')
    .filter({ hasText: 'volunteer2@example.com' })
  await permissions.locator('input[name="expert_permission"]').check()
  await permissions.getByRole('button', { name: 'Сохранить' }).click()
  await adminPage.close()

  const expertPage = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await login(expertPage, 'volunteer2@example.com')
  await expertPage.goto('/expert')
  const answer = expertPage.locator('form').filter({ hasText: question })
  await answer
    .getByLabel('Ваш ответ')
    .fill('Выберите подходящую акцию и запишитесь через карточку события.')
  await answer.getByRole('button', { name: /Ответить/ }).click()
  await expect(answer).toHaveCount(0)
  await expertPage.close()

  await page.goto('/notifications')
  const answerNotification = page
    .locator('.row-item')
    .filter({ hasText: 'Эксперт ответил на ваш вопрос' })
  await expect(answerNotification).toBeVisible()
  await answerNotification.getByRole('button', { name: 'Прочитано' }).click()
  await expect(answerNotification).toContainText('Прочитано')
  await page.goto('/notifications/settings')
  await page.getByLabel('Город').fill('Екатеринбург')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Подписка сохранена')).toBeVisible()
})

test('подтверждённый участник публикует отзыв и фото (FR-10, FR-15)', async ({ page, browser }) => {
  const organizer = await browser.newPage({ baseURL: 'http://127.0.0.1:8080' })
  await login(organizer, 'organizer@example.com')
  await organizer.goto('/organizer/events')
  await organizer.getByRole('link', { name: /Учебная завершённая акция/ }).click()
  const eventId = organizer.url().split('/').pop()
  await organizer.close()

  await login(page, 'volunteer1@example.com')
  await page.goto(`/events/${eventId}/community`)
  await expect(page.getByRole('heading', { name: 'Результаты и отзывы' })).toBeVisible()
  await page.getByLabel('Ваш отзыв').fill('Проверочный отзыв об участии в экологической акции.')
  await page.getByRole('button', { name: 'Опубликовать отзыв' }).click()
  await expect(page.getByText('Спасибо за отзыв')).toBeVisible()
  await page.getByLabel(/До двух JPEG\/PNG/).setInputFiles({
    name: 'feedback.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9s8AAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.getByRole('button', { name: 'Загрузить фото' }).click()
  await expect(page.getByText('Фото добавлены')).toBeVisible()
})

test('организатор создаёт, редактирует, загружает фото и публикует акцию (FR-03, FR-05, FR-15)', async ({
  page,
}) => {
  await login(page, 'organizer@example.com')
  await page.goto('/organizer/events')
  const title = `Проверка Playwright ${Date.now()}`
  const localDateTime = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 16)
  }
  const start = new Date(Date.now() + 3 * 24 * 60 * 60_000)
  const end = new Date(start.getTime() + 3 * 60 * 60_000)
  await page.getByLabel('Название', { exact: true }).fill(title)
  await page
    .getByLabel('Описание', { exact: true })
    .fill('Подробное описание тестовой экологической акции Playwright.')
  await page.locator('form.stacked select[name="type"]').selectOption('cleanup')
  await page.getByLabel('Город', { exact: true }).fill('Екатеринбург')
  await page.getByLabel('Адрес', { exact: true }).fill('Улица тестовая, 1')
  await page.getByLabel('Начало').fill(localDateTime(start))
  await page.getByLabel('Конец').fill(localDateTime(end))
  await page.getByLabel('Контакт').fill('pw@example.com')
  await page.getByLabel('Инвентарь').fill('Перчатки')
  await page.getByRole('button', { name: 'Создать черновик' }).click()
  const eventLink = page.getByRole('link', { name: new RegExp(title) })
  await expect(eventLink).toBeVisible()
  await eventLink.click()
  await page.getByRole('link', { name: /Изменить карточку и фото/ }).click()
  await page.getByLabel('Файл JPEG или PNG до 5 МБ').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9s8AAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.getByRole('button', { name: 'Загрузить' }).click()
  await expect(page.getByText(/Фото загружено/)).toBeVisible()
  await page.getByRole('link', { name: /К событию/ }).click()
  await page.getByRole('button', { name: 'Опубликовать' }).click()
  await expect(page.getByText('PUBLISHED')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept('Отмена для проверки Playwright'))
  await page.getByRole('button', { name: 'Отменить событие' }).click()
  await expect(page.getByText('CANCELLED')).toBeVisible()
})
