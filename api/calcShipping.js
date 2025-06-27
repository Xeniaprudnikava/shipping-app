// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) Разрешаем CORS для всех исходников
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2) Preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, boxes, postcode, address } = req.body;

  // Валидация входных данных
  if (!region || !boxes || boxes < 1 || !postcode || !address) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // 3) Получаем токен OAuth (если используете клиент-секрет), 
  //    иначе проставьте здесь свой заранее сгенерированный токен
  const tokenRes = await fetch('https://api-shipx-eu.easypack24.net/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHIPX_CLIENT_ID,
      client_secret: process.env.SHIPX_CLIENT_SECRET
    })
  });
  const { access_token } = await tokenRes.json();

  // 4) Маппинг регионов
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
    return res.status(400).json({ error: 'Nieobsługiwany region' });
  }

  // 5) Формируем массив посылок
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code, postal_code: postcode, street: address } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 6) Запрашиваем расчёт
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

  // 7) Складываем стоимость
  const shippingCost = offers.reduce(
    (sum, o) => sum + parseFloat(o.calculated_charge_amount || 0),
    0
  );

  return res.status(200).json({ shippingCost });
}
