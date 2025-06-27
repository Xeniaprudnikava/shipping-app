// file: api/calcShipping.js
// (на Vercel этот файл лежит в папке /api и автоматически превращается в endpoint
//   https://shipping-app-ecru.vercel.app/api/calcShipping)

export default async function handler(req, res) {
  // 1) CORS-заголовки — разрешаем запросы с любого источника (или укажите ваш домен вместо '*')
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 2) Опция preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, boxes } = req.body;
  if (!region || !boxes || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // 3) Ваш статический token из InPost → сохраните его в ENV переменной Vercel, 
  //    например SHIPX_TOKEN и ниже замените process.env.SHIPX_TOKEN
  const SHIPX_TOKEN = process.env.SHIPX_TOKEN || 'ВАШ_ТОКЕН_ИЗ_INPOST_ЗДЕСЬ';

  // 4) Маппинг регионов
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
    return res.status(400).json({ error: 'Bad region' });
  }

  // 5) Собираем shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i+1}`,
    receiver: { address: { country_code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1',  unit: 'kg' }
    },
    service: 'inpost_locker_standard'
  }));

  // 6) Запрашиваем расчёт
  let offers;
  try {
    const calcRes = await fetch(
      `https://api-shipx-eu.easypack24.net/v1/organizations/${process.env.SHIPX_ORGANIZATION_ID}/shipments/calculate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SHIPX_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipments })
      }
    );
    if (!calcRes.ok) throw new Error(`status ${calcRes.status}`);
    offers = await calcRes.json();
  } catch (e) {
    console.error('Error on ShipX calculate:', e);
    return res.status(500).json({ error: 'ShipX error' });
  }

  // 7) Суммируем
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  return res.status(200).json({ shippingCost });
}
