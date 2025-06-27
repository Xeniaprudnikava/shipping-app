// api/calcShipping.js
export default async function handler(req, res) {
  // 1) CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    // для preflight-запросов
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const { region, boxes } = req.body;
  if (!region || typeof boxes !== 'number' || boxes < 1) {
    return res.status(400).json({ error: 'Неверные входные данные' });
  }

  // 2) Ваш static ShipX-token и ID организации
  const SHIPX_TOKEN = process.env.INPOST_SHIPX_TOKEN;      // скопируйте из InPost-менеджера
  const ORGANIZATION_ID = process.env.INPOST_ORG_ID;       // например "88982"

  // 3) Мэппинг регионов → ISO
  const countryCodes = {
    Polska: 'PL',
    Niemcy: 'DE',
    Litwa: 'LT',
    Holandia: 'NL',
    Włochy: 'IT',
    'Wielka Brytania': 'GB',
  };
  const code = countryCodes[region];
  if (!code) {
    return res.status(400).json({ error: 'Неизвестный регион' });
  }

  // 4) Формируем shipments
  const shipments = Array.from({ length: boxes }, (_, i) => ({
    id: `BOX${i + 1}`,
    receiver: { address: { country_code: code } },
    parcels: {
      dimensions: { length: '39', width: '38', height: '64', unit: 'cm' },
      weight:     { amount: '1', unit: 'kg' },
    },
    service: 'inpost_locker_standard',
  }));

  // 5) Запрашиваем цену
  const calcRes = await fetch(
    `https://api-shipx-eu.easypack24.net/v1/organizations/${ORGANIZATION_ID}/shipments/calculate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SHIPX_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shipments }),
    }
  );

  if (!calcRes.ok) {
    const text = await calcRes.text();
    return res.status(502).json({ error: 'Ошибка расчёта', detail: text });
  }

  const offers = await calcRes.json();
  const shippingCost = offers
    .reduce((sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0);

  return res.status(200).json({ shippingCost });
}
