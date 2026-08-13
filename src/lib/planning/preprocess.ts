// Prétraitement de l'image avant OCR : améliore nettement la précision de Tesseract
// sur les photos de téléphone (gris, contraste, résolution, redressement).

// Tableau dense à 7 colonnes : une résolution suffisante est déterminante pour
// que Tesseract sépare les petits caractères (n° de bus, téléphones). On vise le
// côté long à ~2200 px, en agrandissant les petites photos et en bornant les grandes.
const TARGET_LONG_SIDE = 2200
const MAX_LONG_SIDE = 2600
const MIN_LONG_SIDE = 1400
// Pente de la courbe douce de seuillage autour du seuil d'Otsu (contraste local
// sans « brûler » les zones d'ombre comme le ferait une binarisation stricte).
const SIGMOID_K = 0.045

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
  })
}

// Seuil d'Otsu : sépare automatiquement l'encre du papier à partir de l'histogramme.
function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * histogram[t]
  let sumB = 0
  let wB = 0
  let maxVar = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

export async function prepareImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const longSide = Math.max(bitmap.width, bitmap.height)
  const target = Math.min(MAX_LONG_SIDE, Math.max(MIN_LONG_SIDE, TARGET_LONG_SIDE))
  const scale = target / longSide
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data

  // 1) niveaux de gris + histogramme (pour Otsu)
  const gray = new Uint8ClampedArray(d.length / 4)
  const histogram = new Array(256).fill(0)
  for (let i = 0, g = 0; i < d.length; i += 4, g++) {
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    gray[g] = v
    histogram[v]++
  }

  // 2) seuil d'Otsu puis courbe douce (sigmoïde) : renforce le contraste
  //    texte/fond sans binariser brutalement (robuste aux ombres du téléphone).
  const threshold = otsuThreshold(histogram, gray.length)
  for (let i = 0, g = 0; i < d.length; i += 4, g++) {
    const v = 255 / (1 + Math.exp(-SIGMOID_K * (gray[g] - threshold)))
    const c = v < 0 ? 0 : v > 255 ? 255 : v
    d[i] = c
    d[i + 1] = c
    d[i + 2] = c
  }
  ctx.putImageData(imageData, 0, 0)

  return canvasToBlob(canvas)
}

// Préparation d'une image pour l'IA vision : redimensionne (pour borner le
// nombre de tokens donc le coût) et renvoie une data URL base64 JPEG.
export async function prepareImageDataUrl(
  file: File | Blob,
  opts?: { maxDim?: number; quality?: number }
): Promise<string> {
  const maxDim = opts?.maxDim ?? 1600
  const quality = opts?.quality ?? 0.8
  const bitmap = await createImageBitmap(file)
  const longSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, maxDim / longSide)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
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
