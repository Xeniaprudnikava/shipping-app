// api/calcShipping.js
// ——————————————————————————————————————————————————————————
// Обрабатываем CORS, чтобы запросы из fyk.bar не блокировались:
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Пришло тело вида { region: "Polska", boxes: 2 }
  const { region, boxes } = req.body
  if (!region || !boxes || boxes < 1) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  // Статический токен из InPost, сгенеренный в личном кабинете
  const TOKEN = process.env.SHIPX_TOKEN || 'YOUR_STATIC_TOKEN'

  // Маппинг регионов
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB'
  }
  const country_code = countryCodes[region]
  if (!country_code) {
    return res.status(400).json({ error: 'Unknown region' })
  }

  // Формируем запрос на расчёт
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i+1}`,
    receiver: { address: { country_code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }))

  // POST /v1/organizations/{ORG_ID}/shipments/calculate
  const ORG_ID = process.env.SHIPX_ORGANIZATION_ID
  const resp = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${ORG_ID}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shipments })
    }
  )

  if (!resp.ok) {
    const text = await resp.text()
    return res.status(500).json({ error: 'ShipX error', details: text })
  }

  const offers = await resp.json()
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount||0), 0)

  return res.status(200).json({ shippingCost })
}
