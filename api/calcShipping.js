// api/calcShipping.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) Разрешаем CORS (для вашего сайта или всех)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2) Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 3) Парсим тело запроса
  const { region, boxes } = req.body;
  if (!region || !Number.isInteger(boxes) || boxes < 1) {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  // 4) Маппинг регион → ISO
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB',
  };
  const country_code = countryCodes[region];
  if (!country_code) {
    return res.status(400).json({ error: 'Nieobsługiwany region' });
  }

  // 5) Ваш токен из ENV
  const TOKEN = process.env.SHIPX_API_TOKEN;
  const ORG_ID = process.env.SHIPX_ORGANIZATION_ID;
  if (!TOKEN || !ORG_ID) {
    return res
      .status(500)
      .json({ error: 'Missing SHIPX_API_TOKEN or SHIPX_ORGANIZATION_ID' });
  }

  // 6) Строим shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1',  unit: 'kg' },
    },
    service: 'inpost_locker_standard',
  }));

  // 7) Делаем запрос расчёта
  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${ORG_ID}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shipments }),
    }
  );
  if (!calcRes.ok) {
    console.error('Calculation error', await calcRes.text());
    return res.status(502).json({ error: 'Calculation failed' });
  }
  const offers = await calcRes.json();

  // 8) Суммируем цену
  const price = offers.reduce(
    (sum, o) => sum + parseFloat(o.calculated_charge_amount || 0),
    0
  );

  // 9) Возвращаем результат
  return res.status(200).json({ price });
}
