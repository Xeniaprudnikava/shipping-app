// api/caltShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2) Preflight-запрос
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3) Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, boxes, postcode, address } = req.body;

  // 4) Простая валидация
  if (
    !region ||
    !Number.isInteger(boxes) ||
    boxes < 1 ||
    !postcode ||
    !address
  ) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // 5) Код страны по названию
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB'
  };
  const country_code = countryCodes[region];
  if (!country_code) {
    return res.status(400).json({ error: 'Nieobsługiwany region' });
  }

  // 6) Собираем shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i+1}`,
    receiver: {
      address: {
        country_code,
        postal_code: postcode,
        street: address
      }
    },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 7) Запрашиваем расчёт у ShipX, используя статический токен
  const token = process.env.SHIPX_TOKEN;
  const orgId = process.env.SHIPX_ORGANIZATION_ID;
  if (!token || !orgId) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${orgId}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shipments })
    }
  );
  const offers = await calcRes.json();

  // 8) Складываем стоимости
  const shippingCost = offers.reduce(
    (sum, o) => sum + parseFloat(o.calculated_charge_amount || 0),
    0
  );

  return res.status(200).json({ shippingCost });
}
