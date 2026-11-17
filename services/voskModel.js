/**
 * Helpers for self-hosting the Vosk speech model used by the "Say it"
 * activity on devices without built-in on-device recognition (e.g.
 * Chromebooks). The model is downloaded once at deploy time from the
 * official Vosk site and served from this server, so students' browsers
 * never contact a third party, and their audio never leaves the device.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import AdmZip from 'adm-zip'
import * as tar from 'tar'

export const MODEL_FILE = 'vosk-model-small-en-us.tar.gz'
export const DEFAULT_SOURCE_URL =
  'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'

export const modelsDir = (root = process.cwd()) => path.join(root, 'public', 'models')

// The small English model is ~40 MB zipped / ~70 MB unpacked
const MAX_UNPACKED_BYTES = 300 * 1024 * 1024

export const sha256 = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex')

/**
 * Converts the official .zip (one top-level folder) into the .tar.gz layout
 * vosk-browser expects: a single top-level folder named "model/".
 *
 * @param {Buffer} zipBuffer
 * @param {string} outFile  path of the .tar.gz to write
 */
export async function repackZipAsModelTarGz(zipBuffer, outFile) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vosk-'))
  try {
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries().filter((e) => !e.isDirectory)
    if (!entries.length) throw new Error('The model archive is empty')

    // Strip the single top-level folder, whatever it is called
    const tops = new Set(entries.map((e) => e.entryName.split('/')[0]))
    const strip = tops.size === 1 && entries.every((e) => e.entryName.includes('/'))

    const names = new Set()
    let total = 0
    for (const entry of entries) {
      if (names.has(entry.entryName)) throw new Error(`Duplicate entry: ${entry.entryName}`)
      names.add(entry.entryName)
      total += entry.header.size
      if (total > MAX_UNPACKED_BYTES) throw new Error('Model archive is unexpectedly large')
    }

    const modelDir = path.join(work, 'model')
    for (const entry of entries) {
      const relative = strip
        ? entry.entryName.split('/').slice(1).join('/')
        : entry.entryName
      const target = path.join(modelDir, relative)
      // Refuse path traversal ("zip slip")
      if (!target.startsWith(modelDir + path.sep)) {
        throw new Error(`Unsafe path in archive: ${entry.entryName}`)
      }
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, entry.getData())
    }

    if (!fs.existsSync(path.join(modelDir, 'am')) || !fs.existsSync(path.join(modelDir, 'conf'))) {
      throw new Error('This does not look like a Vosk model (missing am/ or conf/)')
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    await tar.create({ gzip: true, file: outFile, cwd: work, portable: true }, ['model'])
    return outFile
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
