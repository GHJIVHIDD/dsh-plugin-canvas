export interface CanvasAnnotation {
  x: number
  y: number
  note: string
}

export interface CanvasState {
  sessionId: string
  html: string
  title: string
  sourceKind: 'html' | 'file' | 'url' | null
  sourceLabel: string
  annotations: CanvasAnnotation[]
  notes: string[]
  updatedAt: number
}

export interface CanvasPreviewArgs {
  mode?: 'render' | 'annotate' | 'clear'
  html?: string
  file?: string
  url?: string
  title?: string
  annotations?: CanvasAnnotation[]
  notes?: string[]
}

export interface CanvasPreviewResult {
  ok: boolean
  mode: string
  sessionId: string
  title: string
  source: string | null
  sourceLabel: string
  annotationCount: number
  noteCount: number
  updatedAt: number
  hint: string
}

export function apply(ctx: any): void
export const inject: string[]
