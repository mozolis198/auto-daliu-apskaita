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

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
})

export const handler = async (event) => {
  const query = event.queryStringParameters?.q

  if (!query) {
    return jsonResponse(400, { error: 'Query parameter is required' })
  }

  const data = await readData()
  const q = query.toLowerCase()

  const matches = data.parts
    .filter((part) => part.name.toLowerCase().includes(q) || (part.oe_number || '').toLowerCase().includes(q))
    .slice(0, 5)

  const results = matches.map((part) => ({
    title: `📦 ${part.name}${part.oe_number ? ' (OE: ' + part.oe_number + ')' : ''}`,
    description: `Barkodas: ${part.barcode}${part.car_make ? ' | ' + part.car_make : ''}${part.price ? ' | ' + part.price + '€' : ''}`,
    url: '#local-result',
    isLocal: true
  }))

  return jsonResponse(200, results)
}
