import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

// Testes de ponta a ponta no site publicado, sempre no evento de TESTE (?e=teste).
const EV = 'teste'
const SHOTS = 'test-output/screens'
fs.mkdirSync(SHOTS, { recursive: true })
const fx = (f: string) => path.resolve('e2e', 'fixtures', f)
const url = (route: string, extra = '') => `./#${route}?e=${EV}${extra}`
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const stamp = Date.now().toString(36)

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function phone(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ ...MOBILE })
}

async function adminLogin(page: Page) {
  await page.goto('./#/admin')
  await page.getByLabel('E-mail').fill(process.env.ADMIN_EMAIL!)
  await page.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Ulisses Live · Administração')).toBeVisible()
  const opts = await page.getByLabel('Evento').locator('option').allTextContents()
  const label = opts.find((o) => o.includes('Modo de teste'))
  if (!label) throw new Error('Evento de teste não encontrado no painel')
  await page.getByLabel('Evento').selectOption({ label })
  await expect(page.getByLabel('Evento')).toHaveValue(/.+/)
}

async function counter(page: Page) {
  const txt = await page.locator('header .text-gold').first().textContent()
  return Number((txt || '0').replace(/\D/g, ''))
}

test.describe.serial('ULISSES LIVE', () => {
  let admin: BrowserContext
  let adminPage: Page

  test.beforeAll(async ({ browser }) => {
    admin = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    adminPage = await admin.newPage()
    await adminLogin(adminPage)
    // Começa do zero: limpa os registros do evento de teste.
    adminPage.on('dialog', (d) => void d.accept())
    await adminPage.getByRole('button', { name: 'Relatórios e testes' }).click()
    await adminPage.getByRole('button', { name: 'Apagar registros de teste' }).click()
    await expect(adminPage.getByText('Registros de teste apagados')).toBeVisible({ timeout: 60_000 })
  })

  test('1. presença em dois celulares, sem duplicar, com TV atualizando sozinha', async ({ browser }) => {
    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=contador'))
    await expect(tv.getByText('PARTICIPANTES!')).toBeVisible()
    const before = await counter(tv)

    const a = await (await phone(browser)).newPage()
    await a.goto(url('/participar'))
    await expect(a.getByText('Presença confirmada!')).toBeVisible()
    await shot(a, '01-participante-presenca')
    await a.reload()
    await expect(a.getByText('Sua presença já estava registrada neste aparelho.')).toBeVisible()

    const b = await (await phone(browser)).newPage()
    await b.goto(url('/participar'))
    await expect(b.getByText('Presença confirmada!')).toBeVisible()

    await expect.poll(() => counter(tv), { timeout: 30_000 }).toBe(before + 2)
    await tv.waitForTimeout(2500)
    await shot(tv, '02-tv-contador')
    await tvCtx.close()
  })

  test('2. mensagens: positiva vai ao telão, ofensiva e crítica ficam com a equipe', async ({ browser }) => {
    const p = await (await phone(browser)).newPage()
    await p.goto(url('/participar'))
    await expect(p.getByText('Presença confirmada!')).toBeVisible()

    await p.getByRole('button', { name: 'Enviar mensagem' }).click()
    await p.getByLabel('Seu primeiro nome ou apelido').fill('Maria')
    await p.getByLabel('Sua mensagem').fill(`Parabéns aos estudantes, trabalhos incríveis! ${stamp}`)
    await shot(p, '03-formulario-mensagem')
    await p.getByRole('button', { name: 'Enviar para o mural' }).click()
    await expect(p.getByText('já está no telão')).toBeVisible()

    await p.getByRole('button', { name: 'Enviar mensagem' }).click()
    await p.getByLabel('Sua mensagem').fill(`que porra é essa ${stamp}`)
    await p.getByRole('button', { name: 'Enviar para o mural' }).click()
    await expect(p.getByText('assim que a equipe revisar')).toBeVisible()

    await p.getByRole('button', { name: 'Enviar mensagem' }).click()
    await p.getByLabel('Sua mensagem').fill(`Faltou água nos corredores ${stamp}`)
    await p.getByRole('button', { name: 'Enviar para o mural' }).click()
    await expect(p.getByText('assim que a equipe revisar')).toBeVisible()

    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=mensagens'))
    await expect(tv.getByText(`Parabéns aos estudantes, trabalhos incríveis! ${stamp}`, { exact: false })).toBeVisible()
    await expect(tv.getByText(`porra é essa ${stamp}`)).toHaveCount(0)
    await tv.waitForTimeout(2000)
    await shot(tv, '04-tv-mensagens')

    await adminPage.getByRole('button', { name: 'Moderação' }).click()
    await expect(adminPage.getByText(`que porra é essa ${stamp}`)).toBeVisible()
    await expect(adminPage.getByText('⚠ palavrão').first()).toBeVisible()
    await expect(adminPage.getByText('⚠ possível crítica').first()).toBeVisible()
    await shot(adminPage, '05-admin-moderacao')
    const critica = adminPage.locator('article', { hasText: `Faltou água nos corredores ${stamp}` })
    await critica.getByRole('button', { name: 'Mover para sugestões' }).click()
    const ofensiva = adminPage.locator('article', { hasText: `que porra é essa ${stamp}` })
    await ofensiva.getByRole('button', { name: '✕ Rejeitar' }).click()
    await expect(ofensiva).toHaveCount(0)
    await tvCtx.close()
  })

  test('3. fotos: limite, revisão humana e exibição no telão', async ({ browser }) => {
    const p = await (await phone(browser)).newPage()
    await p.goto(url('/participar'))
    await expect(p.getByText('Presença confirmada!')).toBeVisible()
    await p.getByRole('button', { name: 'Enviar fotografia' }).click()
    await p.locator('input[type=file][multiple]').setInputFiles([fx('foto.jpg'), fx('foto.jpg')])
    await expect(p.getByAltText('Foto 2')).toBeVisible()
    await p.getByLabel('Seu primeiro nome ou apelido').fill('João')
    await p.getByLabel('Legenda (opcional)').fill(`Projeto de robótica ${stamp}`)
    await p.getByRole('button', { name: 'Enviar fotos' }).click()
    await expect(p.getByText('Marque a autorização de uso de imagem.')).toBeVisible()
    await p.getByText('Obrigatório:').click()
    await p.getByText('Opcional: autorizo também').click()
    await shot(p, '06-formulario-foto')
    await p.getByRole('button', { name: 'Enviar fotos' }).click()
    await expect(p.getByText('A equipe vai revisar')).toBeVisible({ timeout: 60_000 })

    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=fotos'))
    await tv.waitForTimeout(3000)
    await expect(tv.getByText(`Projeto de robótica ${stamp}`)).toHaveCount(0)

    await adminPage.getByRole('button', { name: 'Moderação' }).click()
    const card = adminPage.locator('article', { hasText: `Projeto de robótica ${stamp}` })
    await expect(card).toBeVisible()
    await expect(card.getByText('autoriza Instagram')).toBeVisible()
    await card.getByRole('button', { name: '✓ Aprovar' }).click()

    await expect(tv.getByText(`Projeto de robótica ${stamp}`).first()).toBeVisible({ timeout: 30_000 })
    await tv.waitForTimeout(2500)
    await shot(tv, '07-tv-fotos')
    await tvCtx.close()
  })

  test('4. vídeo: limite de 15 segundos, envio, aprovação e reprodução', async ({ browser }) => {
    const p = await (await phone(browser)).newPage()
    await p.goto(url('/participar'))
    await expect(p.getByText('Presença confirmada!')).toBeVisible()
    await p.getByRole('button', { name: 'Enviar vídeo' }).click()
    await p.locator('input[type=file]:not([capture])').setInputFiles(fx('longo.webm'))
    await expect(p.getByText('O limite é 15 segundos')).toBeVisible()
    await p.locator('input[type=file]:not([capture])').setInputFiles(fx('video.webm'))
    await expect(p.locator('form video')).toBeVisible()
    await p.getByLabel('Seu primeiro nome ou apelido').fill('Ana')
    await p.getByLabel('Legenda (opcional)').fill(`Experimento de química ${stamp}`)
    await p.getByText('Obrigatório:').click()
    await p.getByRole('button', { name: 'Enviar vídeo' }).click()
    await expect(p.getByText('A equipe vai revisar')).toBeVisible({ timeout: 60_000 })

    await adminPage.getByRole('button', { name: 'Moderação' }).click()
    const card = adminPage.locator('article', { hasText: `Experimento de química ${stamp}` })
    await card.getByRole('button', { name: '✓ Aprovar' }).click()

    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=videos'))
    await expect(tv.getByText(`Experimento de química ${stamp}`)).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => tv.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(0)
    await shot(tv, '08-tv-video')
    await tvCtx.close()
  })

  test('5. reações chegam ao telão', async ({ browser }) => {
    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=contador'))
    await expect(tv.getByText('PARTICIPANTES!')).toBeVisible()
    const p = await (await phone(browser)).newPage()
    await p.goto(url('/participar'))
    await p.getByRole('button', { name: 'Enviar reação' }).click()
    for (const e of ['🚀', '👏', '❤️']) await p.getByRole('button', { name: `Reagir com ${e}` }).click()
    await expect(p.getByText('3 reações enviadas')).toBeVisible()
    await expect(tv.getByText(/[1-9]\d* reações/)).toBeVisible({ timeout: 30_000 })
    await shot(tv, '09-tv-reacoes')
    await tvCtx.close()
  })

  test('6. segurança: visitante não lê pendentes, não grava em pasta alheia e não acessa o admin', async ({ browser }) => {
    const p = await (await phone(browser)).newPage()
    await p.goto(url('/participar'))
    await expect(p.getByText('Presença confirmada!')).toBeVisible()
    // Pelas APIs públicas: tabelas privadas devem recusar ou voltar vazias.
    const env = fs.readFileSync('.env.production', 'utf8')
    const SUPA = env.match(/VITE_SUPABASE_URL=(.*)/)![1].trim()
    const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)![1].trim()
    const h = { apikey: KEY, Authorization: `Bearer ${KEY}` }
    const r1 = await fetch(`${SUPA}/rest/v1/presences?select=*`, { headers: h })
    expect([401, 403]).toContain(r1.status)
    const r2 = await fetch(`${SUPA}/rest/v1/posts?select=status&status=neq.approved`, { headers: h })
    expect(r2.status).toBe(200)
    expect(await r2.json()).toEqual([])
    const r3 = await fetch(`${SUPA}/rest/v1/posts?id=not.is.null`, { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: '{"status":"approved"}' })
    expect([401, 403]).toContain(r3.status)
    const r4 = await fetch(`${SUPA}/storage/v1/object/uploads/00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111/x.jpg`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'image/jpeg' },
      body: new Uint8Array([255, 216, 255]),
    })
    expect(r4.status).toBeGreaterThanOrEqual(400)
    const r5 = await fetch(`${SUPA}/rest/v1/rpc/admin_purge_event`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: '{"p_event":"00000000-0000-0000-0000-000000000000"}' })
    expect(r5.status).toBeGreaterThanOrEqual(400)
  })

  test('7. emergência: o telão para na hora e volta', async ({ browser }) => {
    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tv = await tvCtx.newPage()
    await tv.goto(url('/tv', '&cena=mensagens'))
    await expect(tv.getByText('Mensagens da nossa comunidade')).toBeVisible()
    await adminPage.getByRole('button', { name: '⛔ Parar telão agora' }).click()
    await expect(tv.getByText('Mensagens da nossa comunidade')).toHaveCount(0, { timeout: 15_000 })
    await shot(tv, '10-tv-emergencia')
    await adminPage.getByRole('button', { name: '▶ Retomar telão' }).click()
    await expect(tv.getByText('Mensagens da nossa comunidade')).toBeVisible({ timeout: 15_000 })
    await tvCtx.close()
  })

  test('8. páginas públicas, QR Code e painel', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(url('/qr'))
    await expect(page.getByAltText('QR Code de presença')).toBeVisible()
    await shot(page, '11-qr-impressao')
    await page.goto(url('/galeria'))
    await expect(page.getByText('João').first()).toBeVisible()
    await shot(page, '12-galeria')
    await page.goto('./#/')
    await expect(page.getByText('Feira do Conhecimento 2026').first()).toBeVisible()
    await shot(page, '13-inicio')
    for (const cena of ['qr', 'instagram', 'convite']) {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(url('/tv', `&cena=${cena}`))
      await page.waitForTimeout(2500)
      await shot(page, `14-tv-${cena}`)
    }
    await adminPage.getByRole('button', { name: 'Painel' }).click()
    await expect(adminPage.getByText('Presenças registradas')).toBeVisible()
    await adminPage.waitForTimeout(2000)
    await shot(adminPage, '15-admin-painel')
    await adminPage.getByRole('button', { name: 'Central de publicações' }).click()
    await expect(adminPage.getByText('João').first()).toBeVisible()
    await shot(adminPage, '16-admin-publicacoes')
    await ctx.close()
  })

  test.afterAll(async () => {
    await admin?.close()
  })
})
