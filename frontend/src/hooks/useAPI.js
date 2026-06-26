const BASE = import.meta.env.VITE_API_BASE || ""

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

function uploadDocumentBase(file, onProgress, path) {
  const form = new FormData()
  form.append("file", file)
  const xhr = new XMLHttpRequest()
  const promise = new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).detail)) }
        catch { reject(new Error("Upload failed")) }
      }
    })
    xhr.addEventListener("error", () => reject(new Error("Network error")))
    xhr.open("POST", `${BASE}${path}`)
    xhr.send(form)
  })
  return promise
}

export function uploadDocument(file, onProgress) {
  return uploadDocumentBase(file, onProgress, "/upload")
}

export function uploadDocumentDebug(file, onProgress) {
  return uploadDocumentBase(file, onProgress, "/upload/debug")
}

export function getDocumentText(docId) {
  return request(`/documents/${docId}/text`)
}

export function getDocuments() {
  return request("/documents")
}

export function deleteDocument(id) {
  return request(`/documents/${id}`, { method: "DELETE" })
}

export function askQuestion(query, k) {
  return request("/ask", {
    method: "POST",
    body: JSON.stringify({ query, k }),
  })
}

export function askDebug(query, k) {
  return request("/ask/debug", {
    method: "POST",
    body: JSON.stringify({ query, k }),
  })
}

export function searchQuery(q, k = 3) {
  return request(`/search?q=${encodeURIComponent(q)}&k=${k}`)
}

export function getHistory(limit = 20) {
  return request(`/history?limit=${limit}`)
}

export async function askStream(query, { onToken, onDone, onError, k } = {}) {
  try {
    const res = await fetch(`${BASE}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || "Request failed")
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") {
            onDone?.()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.token) onToken?.(parsed.token)
            if (parsed.error) onError?.(new Error(parsed.error))
            if (parsed.sources) onDone?.(parsed.sources)
          } catch {}
        }
      }
    }
    onDone?.()
  } catch (e) {
    onError?.(e)
  }
}

export function getSuggestions() {
  return request("/suggestions")
}

export function getConfig() {
  return request("/config")
}

export function updateConfig(data) {
  return request("/config", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}
