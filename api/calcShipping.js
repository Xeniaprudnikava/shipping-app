// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, boxes } = req.body;
  // 1) Получаем OAuth2-токен
  const tokenRes = await fetch(
    'https://api-shipx-eu.easypack24.net/oauth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SHIPX_CLIENT_ID,
        client_secret: process.env.SHIPX_CLIENT_SECRET
      })
    }
  );
  const { access_token } = await tokenRes.json();

  // 2) Маппинг регионов на ISO-коды
  const countryCodes = {
    Polska: 'PL', Niemcy: 'DE', Litwa: 'LT',
    Holandia: 'NL', Włochy: 'IT', 'Wielka Brytania': 'GB'
  };
  const code = countryCodes[region];
  if (!code || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // 3) Формируем shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 4) Запрашиваем расчёт стоимости
  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${process.env.SHIPX_ORGANIZATION_ID}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shipments })
    }
  );
  const offers = await calcRes.json();

  // 5) Суммируем стоимость всех коробок
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  res.status(200).json({ shippingCost });
}
