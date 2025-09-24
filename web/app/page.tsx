'use client';
import { useState } from 'react';

export default function Home() {
  const [tenant, setTenant] = useState('demo');
  const [sku, setSku] = useState('ABC-123');
  const [loc, setLoc] = useState('WH1');
  const [orderQty, setOrderQty] = useState(1);
  const [orderKey, setOrderKey] = useState('');
  const [out, setOut] = useState<any>(null);

  async function getStock() {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/tenants/${tenant}/stock?sku=${sku}&location=${loc}`;
    const res = await fetch(url);
    setOut(await res.json());
  }

  async function adjust(delta: number) {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/tenants/${tenant}/movements/adjust`;
    const res = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tenant_id: tenant, sku, location: loc, qty: delta, reason: delta>0?'adjust+':'adjust-', idempotency_key: crypto.randomUUID() })
    });
    setOut(await res.json());
  }

  async function createOrder() {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/tenants/${tenant}/orders`;
    const qty = Math.max(1, Number(orderQty) || 0);
    const payload = {
      tenant_id: tenant,
      id: orderKey || undefined,
      lines: [{ sku, qty }]
    };
    const res = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    setOut(await res.json());
  }

  return (
    <main style={{maxWidth: 720, margin: '2rem auto', padding: 16}}>
      <h1>OmniStock (C++ backend)</h1>
      <div style={{display:'flex', gap:8, marginTop:12}}>
        <input value={tenant} onChange={e=>setTenant(e.target.value)} placeholder="tenant" />
        <input value={sku} onChange={e=>setSku(e.target.value)} placeholder="SKU" />
        <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Location" />
      </div>
      <div style={{display:'flex', gap:8, marginTop:12}}>
        <button onClick={getStock}>Get Stock</button>
        <button onClick={()=>adjust(1)}>+1</button>
        <button onClick={()=>adjust(-1)}>-1</button>
      </div>
      <div style={{marginTop:24}}>
        <h2>Create Order</h2>
        <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
          <input value={orderQty} onChange={e=>setOrderQty(Math.max(1, parseInt(e.target.value, 10) || 0))} type="number" min={1} style={{width:120}}
            placeholder="Qty" />
          <input value={orderKey} onChange={e=>setOrderKey(e.target.value)} placeholder="External ID (optional)" />
          <button onClick={createOrder}>Create</button>
        </div>
      </div>
      <pre style={{background:'#f5f5f5', padding:12, marginTop:12}}>{out? JSON.stringify(out, null, 2) : '...'}</pre>
    </main>
  );
}
