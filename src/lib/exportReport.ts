import { zipSync } from 'fflate'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { AdminOverview } from '../../shared/types.ts'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function stamp(slug: string): string {
  const day = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `ulisses-live-${slug}-${day}`
}

export function exportCsv(data: AdminOverview) {
  const lines = [
    ['tipo', 'autor', 'texto', 'emoji', 'situacao', 'audiencia', 'consentimento_imagem', 'consentimento_instagram', 'criado_em'],
    ...data.posts.map((post) => [
      post.type,
      post.authorName || '',
      (post.body || '').replaceAll('"', '""'),
      post.emoji || '',
      post.status,
      post.audience,
      post.imageConsent ? 'sim' : 'nao',
      post.instagramConsent ? 'sim' : 'nao',
      post.createdAt,
    ]),
  ]
  const csv = `\uFEFF${lines.map((line) => line.map((cell) => `"${cell}"`).join(';')).join('\n')}`
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${stamp(data.event.slug)}.csv`)
}

export function exportExcel(data: AdminOverview) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { indicador: 'Presenças por navegador', valor: data.stats.presences },
      { indicador: 'Mensagens', valor: data.stats.messages },
      { indicador: 'Mensagens aprovadas', valor: data.stats.messagesApproved },
      { indicador: 'Fotografias', valor: data.stats.photos },
      { indicador: 'Vídeos', valor: data.stats.videos },
      { indicador: 'Reações', valor: data.stats.reactions },
      { indicador: 'Pendentes', valor: data.stats.pending },
      { indicador: 'Rejeitados', valor: data.stats.rejected },
      { indicador: 'Engajamento (%)', valor: data.stats.engagementRate },
    ]),
    'Indicadores',
  )
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      data.posts.map((post) => ({
        tipo: post.type,
        autor: post.authorName,
        texto: post.body,
        emoji: post.emoji,
        situacao: post.status,
        audiencia: post.audience,
        ia: post.aiUsed ? 'sim' : 'nao',
        imagem: post.imageConsent ? 'sim' : 'nao',
        instagram: post.instagramConsent ? 'sim' : 'nao',
        categoria: post.category,
        formato: post.commsFormat,
        criado_em: post.createdAt,
      })),
    ),
    'Publicacoes',
  )
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(data.presences.map((item) => ({ dia: item.day, turno: item.shift, registrado_em: item.createdAt }))),
    'Presencas',
  )
  XLSX.writeFile(book, `${stamp(data.event.slug)}.xlsx`)
}

async function loadFont(doc: jsPDF, url: string, file: string, name: string, style: 'normal' | 'bold') {
  const buffer = await fetch(url).then((response) => response.arrayBuffer())
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  doc.addFileToVFS(file, btoa(binary))
  doc.addFont(file, name, style)
}

export async function exportPdf(data: AdminOverview) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  await loadFont(doc, '/fonts/DejaVuSans.ttf', 'DejaVuSans.ttf', 'DejaVu', 'normal')
  await loadFont(doc, '/fonts/DejaVuSans-Bold.ttf', 'DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
  doc.setFont('DejaVu', 'bold')
  doc.setFontSize(16)
  doc.text('ULISSES LIVE', 40, 48)
  doc.setFont('DejaVu', 'normal')
  doc.setFontSize(11)
  doc.text(data.event.name, 40, 68)
  doc.text(`${data.event.institution} — ${data.event.municipality}/${data.event.state}`, 40, 84)
  doc.text(`Presenças por navegador: ${data.stats.presences}`, 40, 112)
  doc.text(`Mensagens: ${data.stats.messages} (aprovadas: ${data.stats.messagesApproved})`, 40, 128)
  doc.text(`Fotos: ${data.stats.photos}   Vídeos: ${data.stats.videos}   Reações: ${data.stats.reactions}`, 40, 144)
  doc.text(`Pendentes: ${data.stats.pending}   Rejeitados: ${data.stats.rejected}   Engajamento: ${data.stats.engagementRate}%`, 40, 160)
  doc.setFontSize(9)
  doc.text('O número de presenças conta navegadores, não pessoas físicas nem a ocupação do momento.', 40, 180)
  autoTable(doc, {
    startY: 198,
    styles: { font: 'DejaVu', fontSize: 8, cellPadding: 4 },
    headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [7, 20, 51] },
    head: [['Quando', 'Tipo', 'Autor', 'Texto', 'Situação']],
    body: data.posts.slice(0, 80).map((post) => [
      new Date(post.createdAt).toLocaleString('pt-BR'),
      post.type,
      post.authorName || '—',
      (post.body || post.emoji || '').slice(0, 140),
      post.status,
    ]),
  })
  doc.save(`${stamp(data.event.slug)}.pdf`)
}

export async function downloadZip(files: { name: string; url: string }[]) {
  const packed: Record<string, Uint8Array> = {}
  for (const file of files) {
    const response = await fetch(file.url, { credentials: 'include' })
    if (!response.ok) continue
    packed[file.name] = new Uint8Array(await response.arrayBuffer())
  }
  if (!Object.keys(packed).length) throw new Error('Nenhum arquivo autorizado foi baixado.')
  const zipped = zipSync(packed)
  download(new Blob([new Uint8Array(zipped)]), `ulisses-midias-${Date.now()}.zip`)
}
