const STORAGE_KEY = 'fst-biometric-v1'

type StoredBiometric = {
  email: string
  credentialId: string
  passwordEnc: string
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes.buffer
}

async function deriveKey(email: string, credentialId: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${email}\0${credentialId}\0fst-bio-v1`)
  const hash = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptPassword(
  email: string,
  credentialId: string,
  password: string,
): Promise<string> {
  const key = await deriveKey(email, credentialId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(password)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
  const combined = new Uint8Array(iv.length + cipher.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(cipher), iv.length)
  return bufferToBase64url(combined.buffer)
}

async function decryptPassword(
  email: string,
  credentialId: string,
  passwordEnc: string,
): Promise<string> {
  const key = await deriveKey(email, credentialId)
  const combined = new Uint8Array(base64urlToBuffer(passwordEnc))
  const iv = combined.slice(0, 12)
  const cipher = combined.slice(12)
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(dec)
}

function readStored(): StoredBiometric | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredBiometric
    if (!parsed.email || !parsed.credentialId || !parsed.passwordEnc) return null
    return parsed
  } catch {
    return null
  }
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof PublicKeyCredential !== 'undefined'
  )
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function hasBiometricRegistration(): boolean {
  return readStored() !== null
}

export function clearBiometricRegistration(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** Face ID / Touch ID / Windows Hello — привязка к этому устройству. */
export async function registerBiometric(email: string, password: string): Promise<void> {
  if (!isBiometricSupported()) throw new Error('unsupported')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = new TextEncoder().encode(email.trim().toLowerCase())
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'FST', id: window.location.hostname },
      user: {
        id: userId,
        name: email.trim(),
        displayName: 'FST Admin',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('cancelled')

  const credentialId = bufferToBase64url(credential.rawId)
  const passwordEnc = await encryptPassword(email.trim().toLowerCase(), credentialId, password)
  const payload: StoredBiometric = {
    email: email.trim().toLowerCase(),
    credentialId,
    passwordEnc,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export async function loginWithBiometric(): Promise<{ email: string; password: string }> {
  const stored = readStored()
  if (!stored) throw new Error('not_registered')

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64urlToBuffer(stored.credentialId),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('cancelled')

  const password = await decryptPassword(stored.email, stored.credentialId, stored.passwordEnc)
  return { email: stored.email, password }
}

export function biometricErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'cancelled') return 'Отменено.'
    if (err.message === 'unsupported') return 'Биометрия не поддерживается в этом браузере.'
    if (err.message === 'not_registered') return 'Face ID не настроен на этом устройстве.'
  }
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
  if (name === 'NotAllowedError') return 'Доступ к Face ID / Touch ID не разрешён.'
  if (name === 'SecurityError') return 'Биометрия недоступна на этом адресе.'
  return 'Не удалось войти по Face ID / Touch ID.'
}
