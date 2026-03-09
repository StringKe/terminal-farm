import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let memory: WebAssembly.Memory | null = null
let encryptRaw: ((ptr: number, len: number) => void) | null = null
let decryptRaw: ((ptr: number, len: number) => void) | null = null
let createBufRaw: ((len: number) => number) | null = null
let destroyBufRaw: ((ptr: number) => void) | null = null

let initPromise: Promise<void> | null = null

function initWasm(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve, reject) => {
    try {
      const wasmPath = join(__dirname, 'tsdk.wasm')
      const wasmBuffer = readFileSync(wasmPath)
      const importObject = {
        a: {
          a: () => {},
          b: () => {},
          c: () => {},
          d: () => {},
          e: () => {},
          f: () => {},
          g: () => {},
          h: () => {},
          i: () => {},
          j: () => {},
          k: () => {},
          l: () => {},
          m: () => {},
          n: () => {},
          o: () => {},
          p: () => {},
          q: () => {},
          r: () => {},
          s: () => {},
          t: () => {},
          u: () => {},
        },
      }

      WebAssembly.instantiate(wasmBuffer, importObject).then(({ instance }) => {
        const exports = instance.exports as any
        try {
          exports.E()
        } catch {}
        memory = exports.v as WebAssembly.Memory
        encryptRaw = exports.J
        decryptRaw = exports.K
        createBufRaw = exports.z
        destroyBufRaw = exports.A
        resolve()
      }).catch(reject)
    } catch (e) {
      reject(e)
    }
  })
  return initPromise
}

export async function encryptBuffer(buffer: Uint8Array): Promise<Buffer> {
  if (!memory) await initWasm()

  const ptr = createBufRaw!(buffer.length)
  const memView = new Uint8Array(memory!.buffer)
  memView.set(buffer, ptr)

  encryptRaw!(ptr, buffer.length)

  const output = Buffer.from(memory!.buffer, ptr, buffer.length)
  const result = Buffer.from(output)
  destroyBufRaw!(ptr)
  return result
}

export async function decryptBuffer(buffer: Uint8Array): Promise<Buffer> {
  if (!memory) await initWasm()

  const ptr = createBufRaw!(buffer.length)
  const memView = new Uint8Array(memory!.buffer)
  memView.set(buffer, ptr)

  decryptRaw!(ptr, buffer.length)

  const output = Buffer.from(memory!.buffer, ptr, buffer.length)
  const result = Buffer.from(output)
  destroyBufRaw!(ptr)
  return result
}

export { initWasm }
