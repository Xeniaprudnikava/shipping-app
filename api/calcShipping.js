// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // === 1) CORS ===
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // отвечаем на preflight-запрос
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // обрабатываем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // === 2) читаем тело запроса ===
  const { region, boxes } = req.body;
  if (!region || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // === 3) статический токен ShipX ===
  // Сгенерируйте в личном кабинете InPost → API ShipX → "Показать токен"
  // Добавьте его в Settings → Environment Variables на Vercel:
  //   INPOST_TOKEN = eyJhbGciOiJ…<ваш токен>
  const token = process.env.INPOST_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing INPOST_TOKEN' });
  }

  // === 4) маппинг регионов на коды ===
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB'
  };
  const code = countryCodes[region];
  if (!code) {
    return res.status(400).json({ error: 'Nieznany region' });
  }

  // === 5) собираем shipments ===
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // === 6) запрос расчёта ===
  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${process.env.SHIPX_ORGANIZATION_ID}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shipments })
    }
  );
  if (!calcRes.ok) {
    const err = await calcRes.text();
    return res.status(502).json({ error: 'ShipX error', details: err });
  }
  const offers = await calcRes.json();

  // === 7) суммируем ===
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  // === 8) отдаем клиенту ===
  res.status(200).json({ shippingCost });
}
