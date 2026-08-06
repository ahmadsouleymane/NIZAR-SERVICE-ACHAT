// Prétraitement de l'image avant OCR : améliore nettement la précision de Tesseract
// sur les photos de téléphone (gris, contraste, résolution, redressement).

const MAX_DIM = 1600 // taille raisonnable pour une photo de téléphone (fiable et rapide)
const CONTRAST = 1.35

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
  })
}

export async function prepareImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, width, height)

  // niveaux de gris + renforcement du contraste
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const c = 128 + (gray - 128) * CONTRAST
    const v = c < 0 ? 0 : c > 255 ? 255 : c
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
  }
  ctx.putImageData(imageData, 0, 0)

  return canvasToBlob(canvas)
}

// Redresse une photo tournée (multiples de 90°), angle fourni par l'OSD de Tesseract
export async function rotateImage(blob: Blob, degrees: number): Promise<Blob> {
  const angle = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360
  if (angle === 0) return blob

  const bitmap = await createImageBitmap(blob)
  const radians = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const w = Math.ceil(bitmap.width * cos + bitmap.height * sin)
  const h = Math.ceil(bitmap.width * sin + bitmap.height * cos)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate(radians)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)

  return canvasToBlob(canvas)
}
