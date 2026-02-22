/**
 * AI Provider Factory + Adapter pattern
 *
 * To add a new provider:
 *   1. Implement AiProviderAdapter
 *   2. Add an instance to PROVIDERS
 *
 * Nothing in this file touches React or Next.js.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface AiModel {
  id: string
  label: string
}

export interface EnhanceOptions {
  imageBlob: Blob
  prompt: string
  apiKey: string
  model: string
}

export interface AiProviderAdapter {
  /** Unique key used in state / IndexedDB */
  id: string
  /** Human-readable name shown in the UI */
  label: string
  /** Placeholder text for the API key input */
  apiKeyPlaceholder: string
  /** Short hint shown below the API key field */
  apiKeyHint: string
  /**
   * Fetch available models for this provider.
   * Returns an empty array when the provider does not support model listing
   * (the UI will fall back to a manual text input).
   */
  fetchModels(apiKey: string): Promise<AiModel[]>
  /**
   * Send the image to the provider and return the enhanced image as a Blob.
   * Throws on error (message will be shown to the user).
   */
  enhance(opts: EnhanceOptions): Promise<Blob>
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

function extractImageDataUrl(text: string): string | null {
  const match = text.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  return match ? match[0] : null
}

// ---------------------------------------------------------------------------
// OpenRouter adapter
// ---------------------------------------------------------------------------

const openRouterAdapter: AiProviderAdapter = {
  id: 'openrouter',
  label: 'OpenRouter',
  apiKeyPlaceholder: 'sk-or-v1-…',
  apiKeyHint: 'Get your key at openrouter.ai/keys',

  async fetchModels(): Promise<AiModel[]> {
    // OpenRouter's model list is public — no auth required
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (!res.ok) throw new Error(`OpenRouter models: HTTP ${res.status}`)
    const json = await res.json()
    return (json.data as Array<{ id: string; name: string; architecture?: { modality?: string } }>)
      .filter((m) => m.architecture?.modality?.includes('image') || m.id.includes('vision') || m.id.includes('gemini'))
      .map((m) => ({ id: m.id, label: m.name ?? m.id }))
      .sort((a, b) => a.label.localeCompare(b.label))
  },

  async enhance({ imageBlob, prompt, apiKey, model }): Promise<Blob> {
    const b64 = await toBase64(imageBlob)
    const mimeType = imageBlob.type || 'image/png'

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an image enhancement assistant. Return only the enhanced image as a base64-encoded data URL with no explanation.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
              { type: 'text', text: prompt || 'Enhance this image: improve sharpness, contrast, and overall quality.' },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
    }

    const json = await res.json()
    const message = json.choices?.[0]?.message

    // Some models (e.g. google/gemini-3-pro-image-preview via OpenRouter) return
    // images in a top-level `images` array on the message object rather than
    // embedding them in `content`.
    const imageFromImages: string | undefined = message?.images?.find(
      (img: { type: string; image_url?: { url?: string } }) =>
        img.type === 'image_url' && img.image_url?.url?.startsWith('data:image/'),
    )?.image_url?.url

    const dataUrl = imageFromImages ?? extractImageDataUrl(message?.content ?? '')
    if (!dataUrl) throw new Error('The model did not return an image. Try a different prompt or model.')
    return dataUrlToBlob(dataUrl)
  },
}

// ---------------------------------------------------------------------------
// Google AI Studio adapter
// ---------------------------------------------------------------------------

const googleStudioAdapter: AiProviderAdapter = {
  id: 'google-studio',
  label: 'Google AI Studio',
  apiKeyPlaceholder: 'AIza…',
  apiKeyHint: 'Get your key at aistudio.google.com/apikey',

  async fetchModels(apiKey: string): Promise<AiModel[]> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    )
    if (!res.ok) throw new Error(`Google AI Studio models: HTTP ${res.status}`)
    const json = await res.json()
    return (json.models as Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }>)
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({
        id: m.name.replace('models/', ''),
        label: m.displayName ?? m.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  },

  async enhance({ imageBlob, prompt, apiKey, model }): Promise<Blob> {
    const b64 = await toBase64(imageBlob)
    const mimeType = imageBlob.type || 'image/png'

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: b64 } },
                { text: prompt || 'Enhance this image: improve sharpness, contrast, and overall quality. Return only the enhanced image as a base64 data URL.' },
              ],
            },
          ],
        }),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
    }

    const json = await res.json()
    const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const dataUrl = extractImageDataUrl(text)
    if (!dataUrl) throw new Error('The model did not return an image. Try a different prompt or model.')
    return dataUrlToBlob(dataUrl)
  },
}

// ---------------------------------------------------------------------------
// OpenAI adapter
// ---------------------------------------------------------------------------

const openAIAdapter: AiProviderAdapter = {
  id: 'openai',
  label: 'OpenAI',
  apiKeyPlaceholder: 'sk-…',
  apiKeyHint: 'Get your key at platform.openai.com/api-keys',

  async fetchModels(apiKey: string): Promise<AiModel[]> {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`OpenAI models: HTTP ${res.status}`)
    const json = await res.json()
    // Only vision-capable models are useful here
    const VISION_PREFIXES = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'o1']
    return (json.data as Array<{ id: string }>)
      .filter((m) => VISION_PREFIXES.some((p) => m.id.startsWith(p)))
      .map((m) => ({ id: m.id, label: m.id }))
      .sort((a, b) => a.label.localeCompare(b.label))
  },

  async enhance({ imageBlob, prompt, apiKey, model }): Promise<Blob> {
    const b64 = await toBase64(imageBlob)
    const mimeType = imageBlob.type || 'image/png'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an image enhancement assistant. Return only the enhanced image as a base64-encoded data URL with no explanation.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
              { type: 'text', text: prompt || 'Enhance this image: improve sharpness, contrast, and overall quality.' },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
    }

    const json = await res.json()
    const text: string = json.choices?.[0]?.message?.content ?? ''
    const dataUrl = extractImageDataUrl(text)
    if (!dataUrl) throw new Error('The model did not return an image. Try a different prompt or model.')
    return dataUrlToBlob(dataUrl)
  },
}

// ---------------------------------------------------------------------------
// Custom / unknown provider adapter
// ---------------------------------------------------------------------------

const customAdapter: AiProviderAdapter = {
  id: 'custom',
  label: 'Custom',
  apiKeyPlaceholder: 'Your API key',
  apiKeyHint: 'Enter the API key for your provider',

  // No model listing — UI will show a free text input
  async fetchModels(): Promise<AiModel[]> {
    return []
  },

  async enhance({ imageBlob, prompt, apiKey, model }): Promise<Blob> {
    // model field is expected to be a full OpenAI-compatible endpoint URL
    // e.g. "https://my-provider.com/v1/chat/completions::my-model-id"
    const [endpoint, modelId] = model.includes('::') ? model.split('::') : [model, model]

    const b64 = await toBase64(imageBlob)
    const mimeType = imageBlob.type || 'image/png'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: 'You are an image enhancement assistant. Return only the enhanced image as a base64-encoded data URL with no explanation.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
              { type: 'text', text: prompt || 'Enhance this image: improve sharpness, contrast, and overall quality.' },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
    }

    const json = await res.json()
    const text: string = json.choices?.[0]?.message?.content ?? ''
    const dataUrl = extractImageDataUrl(text)
    if (!dataUrl) throw new Error('The model did not return an image. Try a different prompt or model.')
    return dataUrlToBlob(dataUrl)
  },
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const PROVIDERS: Record<string, AiProviderAdapter> = {
  [openRouterAdapter.id]: openRouterAdapter,
  [googleStudioAdapter.id]: googleStudioAdapter,
  [openAIAdapter.id]: openAIAdapter,
  [customAdapter.id]: customAdapter,
}

export const PROVIDER_LIST: AiProviderAdapter[] = Object.values(PROVIDERS)

/** Returns the adapter for a given provider id, falling back to the custom adapter. */
export function getProvider(id: string): AiProviderAdapter {
  return PROVIDERS[id] ?? customAdapter
}
