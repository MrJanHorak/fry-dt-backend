import { afterAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'
import * as tar from 'tar'
import request from 'supertest'
import { repackZipAsModelTarGz, MODEL_FILE } from '../services/voskModel.js'

process.env.SKIP_DB_CONNECTION = 'true'
process.env.SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vosk-test-'))
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

const fakeModelZip = (top = 'vosk-model-small-en-us-0.15') => {
  const zip = new AdmZip()
  zip.addFile(`${top}/am/final.mdl`, Buffer.from('acoustic'))
  zip.addFile(`${top}/conf/model.conf`, Buffer.from('--beam=10'))
  zip.addFile(`${top}/graph/words.txt`, Buffer.from('said 1'))
  return zip.toBuffer()
}

const listTar = async (file) => {
  const names = []
  await tar.list({ file, onReadEntry: (e) => names.push(e.path) })
  return names
}

describe('Vosk model repackaging', () => {
  it('renames the top folder to model/ as vosk-browser expects', async () => {
    const out = path.join(tmp, 'a', 'model.tar.gz')
    await repackZipAsModelTarGz(fakeModelZip(), out)
    const names = await listTar(out)
    expect(names).toEqual(
      expect.arrayContaining(['model/am/final.mdl', 'model/conf/model.conf', 'model/graph/words.txt'])
    )
    expect(names.some((n) => n.includes('vosk-model-small'))).toBe(false)
  })

  it('rejects archives that are not Vosk models', async () => {
    const zip = new AdmZip()
    zip.addFile('stuff/readme.txt', Buffer.from('hi'))
    await expect(
      repackZipAsModelTarGz(zip.toBuffer(), path.join(tmp, 'b.tar.gz'))
    ).rejects.toThrow(/Vosk model/)
  })

  it('refuses path traversal entries', async () => {
    const zip = new AdmZip(fakeModelZip())
    // Craft an entry that tries to escape the extraction folder
    zip.addFile('vosk-model-small-en-us-0.15/am/x', Buffer.from('x'))
    zip.getEntries().at(-1).entryName = 'vosk-model-small-en-us-0.15/../../evil.txt'
    await expect(
      repackZipAsModelTarGz(zip.toBuffer(), path.join(tmp, 'c.tar.gz'))
    ).rejects.toThrow(/Unsafe path/)
  })
})

describe('GET /models', () => {
  it('serves the model cross-origin with caching to allowed origins', async () => {
    const dir = path.join(process.cwd(), 'public', 'models')
    const file = path.join(dir, MODEL_FILE)
    const existed = fs.existsSync(file)
    if (!existed) {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, 'fake')
    }
    try {
      const { app } = await import('../server.js')
      const res = await request(app)
        .get(`/models/${MODEL_FILE}`)
        .set('Origin', 'http://localhost:3000')
      expect(res.status).toBe(200)
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin')
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(res.headers['cache-control']).toMatch(/max-age=604800/)

      const missing = await request(app).get('/models/nope.tar.gz')
      expect(missing.status).toBe(404)
    } finally {
      if (!existed) fs.rmSync(file)
    }
  })
})
