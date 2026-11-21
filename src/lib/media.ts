export async function compressImage(file: File): Promise<Blob> {
  const name = file.name.toLowerCase()
  const heic = file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')
  let bitmap: ImageBitmap
  try {
    // O Safari do iPhone abre HEIC normalmente; só recusa se este navegador não conseguir ler.
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(heic
      ? 'Este celular enviou a foto em HEIC e o navegador não conseguiu abrir. Tire a foto pelo botão da câmera desta página ou escolha uma imagem JPEG.'
      : 'Não foi possível abrir esta imagem. Escolha uma foto JPEG ou PNG.')
  }
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75))
  if (!blob) throw new Error('Não foi possível comprimir a imagem.')
  return blob
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler este vídeo. Use MP4 ou WEBM.'))
    }
    video.src = url
  })
}
