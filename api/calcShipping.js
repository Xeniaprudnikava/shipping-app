export default async function handler(req, res) {
  /* ----------- CORS ----------- */
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')     return res.status(405).json({ error:'Only POST allowed' });

  try {
    /* ----------- валидация входящих данных ----------- */
    const { boxes, postcode, address, city = '' } = req.body;     // добавили city
    if (!Number.isInteger(boxes) || boxes < 1 ||
        typeof postcode !== 'string' || typeof address !== 'string')
      return res.status(400).json({ error:'Invalid payload' });

    /* ----------- auth ----------- */
    const token = process.env.SHIPX_API_TOKEN;
    const orgId = process.env.SHIPX_ORGANIZATION_ID;
    if (!token || !orgId)
      throw new Error('Missing SHIPX_API_TOKEN or SHIPX_ORGANIZATION_ID');

    /* ----------- упаковываем коробки ----------- */
    const parcels = [{
      dimensions: { length: 39, width: 38, height: 64, unit: 'cm' },
      weight:     { amount: 1,  unit: 'kg' }
    }];

    const shipments = Array.from({ length: boxes }, (_, i) => ({
      id: `BOX${i + 1}`,
      receiver: {
        address: {
          country_code : 'PL',           // ISO-код
          post_code    : postcode,
          city,
          street       : address         // или разберите street / building_number
        }
      },
      parcels,
      service: 'inpost_locker_standard'
    }));

    /* ----------- запрос в ShipX ----------- */
    const shipx = await fetch(
      `https://api-shipx-it.easypack24.net/v1/organizations/${orgId}/shipments/calculate`,
      {
        method : 'POST',
        headers: {
          Authorization : `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipments })
      }
    );

    if (!shipx.ok) {
      const text = await shipx.text();
      console.error('ShipX response:', shipx.status, text);
      throw new Error(`ShipX API ${shipx.status}`);
    }

    const offers = await shipx.json();
    const shippingCost = offers.reduce(
      (sum, o) => sum + parseFloat(o.calculated_charge_amount || 0), 0
    );

    return res.status(200).json({ shippingCost });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
