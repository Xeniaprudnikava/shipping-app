// api/calcShipping.js
// —————————————————————————————————
// Серверный lambda-хэндлер для расчёта доставки через ShipX/InPost.
// Добавлены CORS-заголовки и простой статический токен.

export default async function handler(req, res) {
  // 1) CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { region, boxes, postcode, address } = req.body;

    // Валидация входных данных
    if (
      typeof region !== 'string' ||
      !Number.isInteger(boxes) ||
      boxes < 1 ||
      typeof postcode !== 'string' ||
      typeof address !== 'string'
    ) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    // 2) Статический токен вместо OAuth
    const token = process.env.SHIPX_API_TOKEN;      // сгенерируй один раз на сайте InPost → API ShipX
    const orgId = process.env.SHIPX_ORGANIZATION_ID; // твоё Org ID
    if (!token || !orgId) {
      throw new Error('Missing SHIPX_API_TOKEN or SHIPX_ORGANIZATION_ID');
    }

    // 3) Формируем массив shipments
    const shipments = Array.from({ length: boxes }, (_, i) => ({
      id: `BOX${i + 1}`,
      receiver: { address: { country_code: region } },
      parcels: {
        dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
        weight:     { amount: '1', unit: 'kg' }
      },
      service: 'inpost_locker_standard'
    }));

    // 4) Запрашиваем стоимость
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
      throw new Error(`ShipX API error ${calcRes.status}: ${err}`);
    }

    const offers = await calcRes.json();
    const shippingCost = offers
      .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

    // 5) Ответ клиенту
    return res.status(200).json({ shippingCost });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
