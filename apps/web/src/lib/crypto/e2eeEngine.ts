// Client-Side WebCrypto E2EE (End-to-End Encryption) Engine
// Uses Web Cryptography API:
// 1. ECDH (P-256) Key Pair generation and persistent storage in IndexedDB
// 2. ECDH Shared Secret derivation between sender and recipient
// 3. AES-GCM (256-bit) authenticated encryption and decryption for messages & audio payloads

const DB_NAME = 'PV_E2EE_KEYSTORE'
const STORE_NAME = 'keypairs'
const KEY_PAIR_ID = 'user_identity_keypair'

// ── 1. IndexedDB Persistent Key Storage ──
function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB not supported in SSR'))
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveKeyPairToStorage(keyPair: CryptoKeyPair): Promise<void> {
  const db = await openKeyDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ id: KEY_PAIR_ID, keyPair })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getKeyPairFromStorage(): Promise<CryptoKeyPair | null> {
  try {
    const db = await openKeyDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(KEY_PAIR_ID)
      req.onsuccess = () => resolve(req.result ? req.result.keyPair : null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

// ── 2. Key Pair Generation & Export ──
export async function getOrCreateUserIdentityKeyPair(): Promise<CryptoKeyPair> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Cryptography API is unavailable')
  }

  const existing = await getKeyPairFromStorage()
  if (existing) {
    return existing
  }

  // Generate ECDH P-256 keypair
  const newKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // Private key is non-extractable from memory
    ['deriveKey', 'deriveBits']
  )

  await saveKeyPairToStorage(newKeyPair)
  return newKeyPair
}

export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey)
  return bufferToBase64(new Uint8Array(exported))
}

export async function importPublicKeySpki(spkiBase64: string): Promise<CryptoKey> {
  const binary = base64ToBuffer(spkiBase64)
  const arrayBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  ) as ArrayBuffer

  return await window.crypto.subtle.importKey(
    'spki',
    arrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

// ── 3. Shared Key Derivation (ECDH -> AES-GCM 256) ──
export async function deriveSharedAesGcmKey(
  privateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: remotePublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── 4. Encryption & Decryption (AES-GCM 256 with 96-bit IV) ──
export interface EncryptedMessagePayload {
  ciphertext: string // Base64
  iv: string         // Base64
  senderEphemeralPublicKey?: string // Base64
}

export async function encryptTextMessage(
  plaintext: string,
  recipientPublicKeySpki: string
): Promise<EncryptedMessagePayload> {
  const recipientPublicKey = await importPublicKeySpki(recipientPublicKeySpki)

  // Generate a one-time ephemeral keypair for forward secrecy
  const ephemeralKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  )

  const sharedAesKey = await deriveSharedAesGcmKey(ephemeralKeyPair.privateKey, recipientPublicKey)
  const iv = window.crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV
  const encodedText = new TextEncoder().encode(plaintext)

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedAesKey,
    encodedText
  )

  const ephemeralSpki = await exportPublicKeySpki(ephemeralKeyPair.publicKey)

  return {
    ciphertext: bufferToBase64(new Uint8Array(encryptedBuffer)),
    iv: bufferToBase64(iv),
    senderEphemeralPublicKey: ephemeralSpki,
  }
}

export async function decryptTextMessage(
  encrypted: EncryptedMessagePayload,
  userPrivateKey: CryptoKey
): Promise<string> {
  if (!encrypted.senderEphemeralPublicKey) {
    throw new Error('Sender ephemeral key missing for decryption')
  }

  const ephemeralPublicKey = await importPublicKeySpki(encrypted.senderEphemeralPublicKey)
  const sharedAesKey = await deriveSharedAesGcmKey(userPrivateKey, ephemeralPublicKey)

  const iv = base64ToBuffer(encrypted.iv)
  const ciphertext = base64ToBuffer(encrypted.ciphertext)

  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer
  const ciphertextBuffer = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    sharedAesKey,
    ciphertextBuffer
  )

  return new TextDecoder().decode(decryptedBuffer)
}

// ── 5. Base64 Helpers ──
function bufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  const len = buffer.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}
