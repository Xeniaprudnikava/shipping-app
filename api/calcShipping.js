// api/calcShipping.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- Только POST ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- Парсим тело ---
  const { region, boxes } = req.body;

  // --- Читаем токен и ID из ENV ---
  const token = process.env.SHIPX_TOKEN;
  const orgId = process.env.SHIPX_ORG_ID;

  // --- Маппинг регионов ---
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB'
  };
  const code = countryCodes[region];
  if (!code || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // --- Формируем запрос расчёта ---
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i+1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // --- API InPost ShipX ---
  const resp = await fetch(
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
  if (!resp.ok) {
    const err = await resp.text();
    return res.status(500).json({ error: err });
  }
  const offers = await resp.json();

  // --- Суммируем стоимость ---
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  // --- Отдаём JSON с числом ---
  return res.status(200).json({ shippingCost });
}
