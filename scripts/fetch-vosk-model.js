#!/usr/bin/env node
/**
 * Downloads the small English Vosk model (~40 MB) once and stores it as
 * public/models/vosk-model-small-en-us.tar.gz, which the server then
 * serves at /models/... for the "Say it" activity.
 *
 *   npm run fetch:vosk-model            # skip if already present
 *   npm run fetch:vosk-model -- --force # download again
 *
 * Optional environment variables:
 *   VOSK_MODEL_SOURCE_URL  where to download the .zip from (default: the
 *                          official Vosk site)
 *   VOSK_MODEL_SHA256      expected SHA-256 of the .zip. Recommended: run
 *                          once, copy the printed hash into your settings,
 *                          and later downloads are verified against it.
 *
 * Suggested deploy build command (Railway/Render):
 *   npm ci && npm run fetch:vosk-model
 */
import 'dotenv/config.js'
import fs from 'fs'
import path from 'path'
import {
  DEFAULT_SOURCE_URL,
  MODEL_FILE,
  modelsDir,
  repackZipAsModelTarGz,
  sha256
} from '../services/voskModel.js'

const force = process.argv.includes('--force')
const outFile = path.join(modelsDir(), MODEL_FILE)

async function main() {
  if (fs.existsSync(outFile) && !force) {
    console.log(`Model already present at ${outFile} (use --force to replace).`)
    return
  }

  const url = process.env.VOSK_MODEL_SOURCE_URL || DEFAULT_SOURCE_URL
  console.log(`Downloading ${url} …`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const zip = Buffer.from(await res.arrayBuffer())

  const hash = sha256(zip)
  const expected = process.env.VOSK_MODEL_SHA256
  if (expected && expected.toLowerCase() !== hash) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${hash}. Not installing.`)
  }
  console.log(`SHA-256 ${hash}${expected ? ' (verified)' : ' (set VOSK_MODEL_SHA256 to pin it)'}`)

  await repackZipAsModelTarGz(zip, outFile)
  const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1)
  console.log(`Saved ${outFile} (${mb} MB).`)
}

main().catch((err) => {
  // Never break a deploy over an optional feature: report and exit 0
  console.error(`Vosk model not installed: ${err.message}`)
  console.error('The app works without it; "Say it" just stays hidden on devices that need it.')
})
