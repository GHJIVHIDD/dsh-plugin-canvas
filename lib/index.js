/**
 * Host loader entry for the deployment-level Canvas plugin.
 *
 * Adds a "画布" (Canvas) tab to the DeepSeek Harness conversation view and a
 * canvas_preview model tool so agents can render HTML design prototypes, add
 * position annotations / notes, and clear the canvas.
 *
 * Privacy & security design:
 *  - Local file access is restricted to an allowlist (default: current working
 *    directory + ~/.dsh/canvas; extend with DSH_CANVAS_ALLOW_ROOTS).
 *  - Common secret-like values in HTML (tokens, passwords, API keys, private
 *    key blocks) are masked before being returned to the browser.
 *  - The client renders previews inside a sandboxed iframe (no same-origin).
 *  - Canvas content is kept in memory only; nothing is written to disk.
 *  - Full local paths are never sent to the client; only the basename is shown.
 */

import { readFile } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { basename, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_ANNOTATIONS = 200
const MAX_NOTES = 100
const FETCH_TIMEOUT_MS = 10000

// ---------------------------------------------------------------------------
// In-memory per-session canvas state
// ---------------------------------------------------------------------------
const canvases = new Map()

function emptyState(sessionId) {
  return {
    sessionId: sessionId || 'default',
    html: '',
    title: '',
    sourceKind: null,
    sourceLabel: '',
    annotations: [],
    notes: [],
    updatedAt: 0,
  }
}

function publicState(sessionId) {
  const s = canvases.get(sessionId || 'default') || emptyState(sessionId || 'default')
  return {
    ok: true,
    state: {
      sessionId: s.sessionId,
      html: s.html,
      title: s.title,
      sourceKind: s.sourceKind,
      sourceLabel: s.sourceLabel,
      annotations: (s.annotations || []).slice(0, MAX_ANNOTATIONS),
      notes: (s.notes || []).slice(0, MAX_NOTES),
      updatedAt: s.updatedAt,
    },
  }
}

// ---------------------------------------------------------------------------
// Privacy helpers
// ---------------------------------------------------------------------------
function maskSecrets(text) {
  let out = String(text || '')
  const replacements = [
    // key = value / key: value
    [/\b(api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|secret|password|passwd|pwd|client[_-]?secret)\b\s*[:=]\s*["']?[^\s"'&,;]{4,}/gi,
      (m) => m.replace(/[:=]\s*["']?[^\s"'&,;]{4,}$/i, ': "••••••••"')],
    // Authorization: Bearer xxx
    [/\b(authorization|proxy-authorization)\s*[:=]\s*["']?[A-Za-z0-9._~+/-]+=*/gi,
      (m) => m.replace(/[:=]\s*["']?[A-Za-z0-9._~+/-]+=*$/i, ': "••••••••"')],
    // Common token formats
    [/\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]+/g, '••••••••'],
    [/\b(xox[baprs]-[A-Za-z0-9-]+)/g, '••••••••'],
    [/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA••••••••••••••••'],
    [/\b(sk-[A-Za-z0-9_-]{8,})\b/g, 'sk-••••••••'],
    // Private key blocks
    [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g,
      '$1\n••••••••\n$2'],
  ]
  for (const [re, repl] of replacements) {
    out = out.replace(re, repl)
  }
  return out
}

function isSensitivePath(p) {
  const parts = String(p).split(sep)
  const sensitiveNames = [
    '.env', '.env.*', '.git', '.git-credentials', '.npmrc', '.pypirc',
    'credentials', 'credential', 'secret', 'secrets', 'token', 'tokens',
    'password', 'passwd', 'id_rsa', 'id_ed25519', 'id_dsa', 'id_ecdsa',
    '*.pem', '*.key', '*.p12', '*.pfx', '*.asc', '*.gpg',
  ]
  for (const part of parts) {
    const lower = part.toLowerCase()
    for (const name of sensitiveNames) {
      if (name.startsWith('*.')) {
        if (lower.endsWith(name.slice(1))) return true
      } else if (name.endsWith('.*')) {
        if (lower.startsWith(name.slice(0, -1))) return true
      } else if (lower === name) {
        return true
      }
    }
  }
  return false
}

function allowedRoots() {
  const roots = [process.cwd(), join(homedir(), '.dsh', 'canvas')]
  const extra = process.env.DSH_CANVAS_ALLOW_ROOTS
  if (extra) {
    for (const raw of String(extra).split(':')) {
      const p = raw.trim()
      if (p) roots.push(resolve(p))
    }
  }
  return roots
}

function isInside(root, target) {
  const rel = relative(normalize(root), normalize(target))
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
}

function resolveAllowedFile(filePath) {
  const raw = String(filePath || '').trim()
  if (!raw) throw new Error('缺少 file 路径')
  const abs = isAbsolute(raw) ? normalize(raw) : resolve(process.cwd(), raw)
  const roots = allowedRoots()
  if (!roots.some((root) => isInside(root, abs))) {
    throw new Error('文件不在允许访问范围内；可通过 DSH_CANVAS_ALLOW_ROOTS 添加允许目录')
  }
  if (isSensitivePath(abs)) {
    throw new Error('出于隐私保护，已拒绝读取该敏感文件')
  }
  let st
  try {
    st = statSync(abs)
  } catch (err) {
    throw new Error('文件不存在或无法访问: ' + basename(abs))
  }
  if (!st.isFile()) throw new Error('路径不是文件')
  if (st.size > MAX_HTML_BYTES) throw new Error('文件过大，超过 2MB 限制')
  return abs
}

async function readLocalFile(filePath) {
  const abs = resolveAllowedFile(filePath)
  const html = await readFile(abs, 'utf8')
  return {
    html: maskSecrets(html),
    title: basename(abs),
    sourceKind: 'file',
    sourceLabel: basename(abs),
  }
}

function sanitizeUrlForDisplay(url) {
  try {
    const u = new URL(String(url || ''))
    u.username = ''
    u.password = ''
    for (const key of Array.from(u.searchParams.keys())) {
      if (/token|key|secret|password|auth|signature/i.test(key)) {
        u.searchParams.set(key, '••••••••')
      }
    }
    return u.toString()
  } catch (err) {
    return String(url || '')
  }
}

async function fetchRemoteUrl(url) {
  let parsed
  try {
    parsed = new URL(String(url || '').trim())
  } catch (err) {
    throw new Error('URL 格式不正确')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https URL')
  }
  // Do not forward URL credentials to the remote server.
  if (parsed.username || parsed.password) {
    parsed.username = ''
    parsed.password = ''
  }
  const requestUrl = parsed.toString()
  const displayUrl = sanitizeUrlForDisplay(requestUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(requestUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'dsh-plugin-canvas/0.1.0' },
    })
    if (!res.ok) throw new Error('远程页面返回 HTTP ' + res.status)
    const text = await res.text()
    if (text.length > MAX_HTML_BYTES) throw new Error('远程页面过大，超过 2MB 限制')
    return {
      html: maskSecrets(text),
      title: displayUrl,
      sourceKind: 'url',
      sourceLabel: displayUrl,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Canvas operations
// ---------------------------------------------------------------------------
function normalizeAnnotations(annotations) {
  if (!Array.isArray(annotations)) return []
  return annotations
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      x: Math.max(0, Math.min(100, Number(a.x) || 0)),
      y: Math.max(0, Math.min(100, Number(a.y) || 0)),
      note: String(a.note || '').slice(0, 500),
    }))
    .filter((a) => a.note !== '')
    .slice(0, MAX_ANNOTATIONS)
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return []
  return notes.map((n) => String(n || '').slice(0, 1000)).filter((n) => n !== '').slice(0, MAX_NOTES)
}

async function renderCanvas(sessionId, args) {
  const key = sessionId || 'default'
  const current = canvases.get(key) || emptyState(key)
  const next = Object.assign({}, current)
  const hasContent = !!(args.html || args.file || args.url)

  if (hasContent) {
    if (args.html != null) {
      next.html = maskSecrets(String(args.html))
      next.title = args.title || 'Inline HTML'
      next.sourceKind = 'html'
      next.sourceLabel = 'Inline HTML'
    } else if (args.file) {
      const loaded = await readLocalFile(args.file)
      next.html = loaded.html
      next.title = loaded.title
      next.sourceKind = loaded.sourceKind
      next.sourceLabel = loaded.sourceLabel
    } else if (args.url) {
      const loaded = await fetchRemoteUrl(args.url)
      next.html = loaded.html
      next.title = loaded.title
      next.sourceKind = loaded.sourceKind
      next.sourceLabel = loaded.sourceLabel
    }
  } else if (!current.html) {
    throw new Error('请提供 html、file 或 url 之一')
  }

  if (Array.isArray(args.annotations)) {
    next.annotations = normalizeAnnotations(args.annotations)
  }
  if (Array.isArray(args.notes)) {
    next.notes = normalizeNotes(args.notes)
  }
  next.updatedAt = Date.now()
  canvases.set(key, next)
  return publicState(key)
}

function annotateCanvas(sessionId, args) {
  const key = sessionId || 'default'
  const current = canvases.get(key)
  if (!current || !current.html) {
    throw new Error('当前画布为空，请先 render 后再 annotate')
  }
  const next = Object.assign({}, current)
  next.annotations = (current.annotations || []).concat(normalizeAnnotations(args.annotations || []))
  next.notes = (current.notes || []).concat(normalizeNotes(args.notes || []))
  next.updatedAt = Date.now()
  canvases.set(key, next)
  return publicState(key)
}

function clearCanvas(sessionId) {
  const key = sessionId || 'default'
  const next = emptyState(key)
  next.updatedAt = Date.now()
  canvases.set(key, next)
  return publicState(key)
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function queryOf(req) {
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams
  } catch (err) {
    return new URLSearchParams()
  }
}

function sendJson(res, status, obj) {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.statusCode = status
    res.end(JSON.stringify(obj))
  } catch (err) { /* ignore */ }
}

const MAX_BODY = 4 * 1024 * 1024

function readBody(req) {
  return new Promise((resolvePromise) => {
    let body = ''
    let done = false
    req.on('data', (chunk) => {
      if (done) return
      body += String(chunk)
      if (body.length > MAX_BODY) {
        done = true
        req.destroy()
        resolvePromise({})
      }
    })
    req.on('end', () => {
      if (done) return
      done = true
      try {
        resolvePromise(body ? JSON.parse(body) : {})
      } catch (err) {
        resolvePromise({})
      }
    })
    req.on('error', () => {
      if (!done) {
        done = true
        resolvePromise({})
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Model tool
// ---------------------------------------------------------------------------
const render = (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const sessionIdOf = (exec) => (exec && exec.agent ? exec.agent.id : null)
const OUT = { schema: { type: 'object', additionalProperties: true }, render }

function apply(ctx) {
  const tools = ctx.get('tools')
  const webServer = ctx.get('webServer')
  try {
    console.log('[canvas] apply: webServer=' + (webServer ? 'yes' : 'NO') + ', tools=' + (tools ? 'yes' : 'NO'))
  } catch (err) { /* ignore */ }

  // Free per-session memory when a session is disposed.
  ctx.on('session/disposed', (session) => {
    const sid = session && session.id
    if (sid) canvases.delete(sid)
  })

  // ---------- HTTP routes ----------
  if (webServer) {
    const route = (path, handler) => {
      ctx.effect(() => {
        try {
          const disposer = webServer.register({ kind: 'exact', path, handler })
          try { console.log('[canvas] route registered: ' + path) } catch (err) { /* ignore */ }
          return disposer
        } catch (err) {
          try { console.error('[canvas] route FAILED: ' + path + ' -> ' + String((err && err.message) || err)) } catch (e) { /* ignore */ }
        }
      }, 'canvas: ' + path)
    }

    route('/canvas-api/state', async (req, res) => {
      try {
        sendJson(res, 200, publicState(queryOf(req).get('session') || 'default'))
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err).slice(0, 300) })
      }
    })

    route('/canvas-api/render', async (req, res) => {
      try {
        const body = await readBody(req)
        const sessionId = String(body.session || queryOf(req).get('session') || 'default')
        sendJson(res, 200, await renderCanvas(sessionId, body))
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err).slice(0, 300) })
      }
    })

    route('/canvas-api/annotate', async (req, res) => {
      try {
        const body = await readBody(req)
        const sessionId = String(body.session || queryOf(req).get('session') || 'default')
        sendJson(res, 200, annotateCanvas(sessionId, body))
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err).slice(0, 300) })
      }
    })

    route('/canvas-api/clear', async (req, res) => {
      try {
        const body = await readBody(req)
        const sessionId = String(body.session || queryOf(req).get('session') || 'default')
        sendJson(res, 200, clearCanvas(sessionId))
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err).slice(0, 300) })
      }
    })
  }

  // ---------- Model tools ----------
  if (tools) {
    const registerTool = (tool) => {
      ctx.effect(() => {
        try {
          const disposer = tools.register(tool)
          try { console.log('[canvas] tool registered: ' + tool.name) } catch (err) { /* ignore */ }
          return disposer
        } catch (err) {
          try { console.error('[canvas] tool FAILED: ' + tool.name + ' -> ' + String((err && err.message) || err)) } catch (e) { /* ignore */ }
        }
      }, 'canvas: tool ' + tool.name)
    }

    registerTool({
      name: 'canvas_preview',
      description: '把 HTML 设计稿原型渲染到会话顶部「画布」标签页，用于交互式预览设计稿（网页/卡片/模拟器/图表/表单/UI 界面），并在画布上标注需要调整的地方。mode=render：渲染或替换内容（html/file/url 三选一），同时可附带 annotations 与 notes（替换旧标注）；mode=annotate：在现有画布上追加位置标注与文字备注；mode=clear：清空画布。渲染完成后提醒用户点击顶部「画布」标签页查看。',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['render', 'annotate', 'clear'],
            description: '操作模式，默认 render。',
          },
          html: { type: 'string', description: '完整 HTML 文档字符串（建议包含 <!doctype html>），作为设计稿原型。' },
          file: { type: 'string', description: '本地 HTML 文件路径（需在允许目录内，默认当前工作目录或 ~/.dsh/canvas）。' },
          url: { type: 'string', description: '远程 HTML 页面 URL（http/https）。' },
          title: { type: 'string', description: '可选标题，用于画布页签展示。' },
          annotations: {
            type: 'array',
            description: '位置标注列表；render 模式替换，annotate 模式追加。',
            items: {
              type: 'object',
              properties: {
                x: { type: 'number', description: '标注点 X 坐标，画布宽度百分比 0-100。' },
                y: { type: 'number', description: '标注点 Y 坐标，画布高度百分比 0-100。' },
                note: { type: 'string', description: '调整意见，如“此处间距过大，建议改为 24px”。' },
              },
              required: ['x', 'y', 'note'],
            },
          },
          notes: {
            type: 'array',
            description: '自由文字备注（不定位）；render 模式替换，annotate 模式追加。',
            items: { type: 'string' },
          },
        },
        required: ['mode'],
      },
      output: OUT,
      async execute(args, exec) {
        const sessionId = sessionIdOf(exec) || 'default'
        const mode = args && args.mode ? String(args.mode) : 'render'
        let result
        if (mode === 'clear') {
          result = clearCanvas(sessionId)
        } else if (mode === 'annotate') {
          result = annotateCanvas(sessionId, args || {})
        } else {
          result = await renderCanvas(sessionId, args || {})
        }
        const s = result.state
        return {
          ok: true,
          mode,
          sessionId,
          title: s.title,
          source: s.sourceKind,
          sourceLabel: s.sourceLabel,
          annotationCount: s.annotations.length,
          noteCount: s.notes.length,
          updatedAt: s.updatedAt,
          hint: '已更新「画布」标签页，请提醒用户点击顶部画布标签查看。',
        }
      },
    })
  }
}

export { apply }
export const inject = ['webServer', 'tools']
