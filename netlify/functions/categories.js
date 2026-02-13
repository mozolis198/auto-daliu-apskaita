import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataPath = path.resolve(__dirname, '../data/parts.json')

const readData = async () => {
  const raw = await fs.readFile(dataPath, 'utf-8')
  return JSON.parse(raw)
}

const writeData = async (data) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
})

export const handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const data = await readData()
    return jsonResponse(200, data.categories)
  }

  if (event.httpMethod === 'POST') {
    const data = await readData()
    const payload = JSON.parse(event.body || '{}')

    if (!payload.name) {
      return jsonResponse(400, { error: 'Category name is required' })
    }

    if (data.categories.some((c) => c.name.toLowerCase() === payload.name.toLowerCase())) {
      return jsonResponse(409, { error: 'Category already exists' })
    }

    const newCategory = {
      id: data.categories.reduce((max, c) => Math.max(max, c.id), 0) + 1,
      name: payload.name
    }

    data.categories.push(newCategory)
    await writeData(data)

    return jsonResponse(201, newCategory)
  }

  return jsonResponse(405, { error: 'Method not allowed' })
}
