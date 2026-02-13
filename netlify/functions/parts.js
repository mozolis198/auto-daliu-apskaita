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

const notFound = () => jsonResponse(404, { error: 'Not found' })

export const handler = async (event) => {
  const { httpMethod, path: rawPath } = event
  const pathParts = rawPath.replace('/.netlify/functions/parts', '').split('/').filter(Boolean)

  if (httpMethod === 'GET' && pathParts.length === 0) {
    const data = await readData()
    const parts = data.parts.map((part) => ({
      ...part,
      category_name: data.categories.find((c) => c.id === part.category_id)?.name || null
    }))
    return jsonResponse(200, parts)
  }

  if (httpMethod === 'GET' && pathParts[0] === 'barcode' && pathParts[1]) {
    const data = await readData()
    const barcode = decodeURIComponent(pathParts[1])
    const part = data.parts.find((p) => p.barcode === barcode)
    if (!part) return jsonResponse(404, { message: 'Part not found' })
    return jsonResponse(200, {
      ...part,
      category_name: data.categories.find((c) => c.id === part.category_id)?.name || null
    })
  }

  if (httpMethod === 'GET' && pathParts[0] === 'oe' && pathParts[1]) {
    const data = await readData()
    const query = decodeURIComponent(pathParts[1]).toLowerCase()
    const matches = data.parts.filter((p) => (p.oe_number || '').toLowerCase().includes(query))
    if (matches.length === 0) return jsonResponse(404, { message: 'No parts found' })
    const parts = matches.map((part) => ({
      ...part,
      category_name: data.categories.find((c) => c.id === part.category_id)?.name || null
    }))
    return jsonResponse(200, parts.length === 1 ? parts[0] : parts)
  }

  if (httpMethod === 'GET' && pathParts[0] === 'name' && pathParts[1]) {
    const data = await readData()
    const query = decodeURIComponent(pathParts[1]).toLowerCase()
    const matches = data.parts.filter((p) => p.name.toLowerCase().includes(query))
    if (matches.length === 0) return jsonResponse(404, { message: 'No parts found' })
    const parts = matches.map((part) => ({
      ...part,
      category_name: data.categories.find((c) => c.id === part.category_id)?.name || null
    }))
    return jsonResponse(200, parts.length === 1 ? parts[0] : parts)
  }

  if (httpMethod === 'POST' && pathParts.length === 0) {
    const data = await readData()
    const payload = JSON.parse(event.body || '{}')

    if (!payload.barcode || !payload.name) {
      return jsonResponse(400, { error: 'Barcode and name are required' })
    }

    if (data.parts.some((p) => p.barcode === payload.barcode)) {
      return jsonResponse(409, { error: 'Part with this barcode already exists' })
    }

    const newPart = {
      id: data.parts.reduce((max, p) => Math.max(max, p.id), 0) + 1,
      barcode: payload.barcode,
      name: payload.name,
      category_id: payload.category_id || null,
      quantity: payload.quantity ?? 1,
      price: payload.price ?? 0,
      cost: payload.cost ?? 0,
      description: payload.description ?? '',
      car_make: payload.car_make ?? '',
      car_model: payload.car_model ?? '',
      car_year_from: payload.car_year_from ?? null,
      car_year_to: payload.car_year_to ?? null,
      oe_number: payload.oe_number ?? '',
      created_at: new Date().toISOString()
    }

    data.parts.push(newPart)
    await writeData(data)
    return jsonResponse(201, newPart)
  }

  if (httpMethod === 'PUT' && pathParts.length === 2 && pathParts[1] === 'quantity') {
    const data = await readData()
    const partId = Number(pathParts[0])
    const payload = JSON.parse(event.body || '{}')
    const part = data.parts.find((p) => p.id === partId)
    if (!part) return jsonResponse(404, { error: 'Part not found' })
    const newQuantity = payload.action === 'add'
      ? part.quantity + payload.quantity
      : payload.action === 'subtract'
        ? Math.max(0, part.quantity - payload.quantity)
        : payload.quantity

    part.quantity = newQuantity
    await writeData(data)
    return jsonResponse(200, { id: partId, quantity: newQuantity })
  }

  if (httpMethod === 'PUT' && pathParts.length === 1) {
    const data = await readData()
    const partId = Number(pathParts[0])
    const payload = JSON.parse(event.body || '{}')
    const part = data.parts.find((p) => p.id === partId)
    if (!part) return jsonResponse(404, { error: 'Part not found' })
    if (!payload.name) return jsonResponse(400, { error: 'Part name is required' })

    Object.assign(part, {
      name: payload.name,
      category_id: payload.category_id ?? null,
      price: payload.price ?? 0,
      cost: payload.cost ?? 0,
      description: payload.description ?? '',
      car_make: payload.car_make ?? '',
      car_model: payload.car_model ?? '',
      car_year_from: payload.car_year_from ?? null,
      car_year_to: payload.car_year_to ?? null,
      oe_number: payload.oe_number ?? ''
    })

    await writeData(data)
    return jsonResponse(200, { id: partId, message: 'Part updated successfully' })
  }

  return notFound()
}
