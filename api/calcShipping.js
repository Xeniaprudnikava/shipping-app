// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // 2) Только POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 3) Разрешаем запросы из любых доменов (или замените '*' на конкретный URL tilda)
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { region, boxes } = req.body;
  const orgId = process.env.SHIPX_ORGANIZATION_ID;
  const token = process.env.SHIPX_TOKEN;

  if (!orgId || !token) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }
  if (!region || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Invalid region or boxes' });
  }

  // 4) Маппинг региона в ISO-код
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
    return res.status(400).json({ error: 'Unknown region' });
  }

  // 5) Собираем массив отправлений
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 6) Запрос расчёта
  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${orgId}/shipments/calculate`,
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
    return res.status(calcRes.status).json({ error: err });
  }
  const offers = await calcRes.json();

  // 7) Суммируем стоимость
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  // 8) Отдаём ответ
  return res.status(200).json({ shippingCost });
}
