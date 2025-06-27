// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2) Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 3) Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, boxes } = req.body;

  // 4) OAuth2-токен
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
  if (!tokenRes.ok) {
    console.error('Token fetch failed', await tokenRes.text());
    return res.status(502).json({ error: 'Bad token response' });
  }
  const { access_token } = await tokenRes.json();

  // 5) Маппинг регионов
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

  // 6) Формируем shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 7) Запрашиваем расчёт
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
  if (!calcRes.ok) {
    console.error('Calc fetch failed', await calcRes.text());
    return res.status(502).json({ error: 'Bad calculate response' });
  }
  const offers = await calcRes.json();

  // 8) Суммируем
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  // 9) Отправляем ответ
  res.status(200).json({ shippingCost });
}
