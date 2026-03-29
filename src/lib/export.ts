import { toPng } from 'html-to-image'

function sanitizeFileStem(fileStem: string) {
  return fileStem
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-가-힣]/g, '')
    .toLowerCase()
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, content] = dataUrl.split(',')
  const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = window.atob(content)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

async function renderNode(node: HTMLElement) {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#fbf3e2',
  })

  return {
    dataUrl,
    blob: dataUrlToBlob(dataUrl),
  }
}

export async function downloadNodeImage(node: HTMLElement, fileStem: string) {
  const { dataUrl } = await renderNode(node)
  const anchor = document.createElement('a')

  anchor.href = dataUrl
  anchor.download = `${sanitizeFileStem(fileStem) || 'harunecut'}.png`
  anchor.click()
}

export async function shareNodeImage(
  node: HTMLElement,
  {
    title,
    text,
    fileStem,
  }: {
    title: string
    text: string
    fileStem: string
  },
) {
  const { dataUrl, blob } = await renderNode(node)
  const file = new File([blob], `${sanitizeFileStem(fileStem) || 'harunecut'}.png`, {
    type: 'image/png',
  })

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({
      files: [file],
    })
  ) {
    await navigator.share({
      title,
      text,
      files: [file],
    })

    return 'shared'
  }

  const anchor = document.createElement('a')

  anchor.href = dataUrl
  anchor.download = file.name
  anchor.click()

  return 'downloaded'
}
