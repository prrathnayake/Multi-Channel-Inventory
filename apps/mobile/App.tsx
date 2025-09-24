import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

type InventoryItem = {
  sku: string;
  available: number;
  onHand: number;
  locationId?: string;
};

type OrderLine = {
  sku: string;
  quantity: number;
};

const settings = Constants.expoConfig?.extra || {};

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(settings.apiBaseUrl || 'http://localhost:8080/v1');
  const [tenantId, setTenantId] = useState<string>(settings.tenantId || 'demo');
  const [location, setLocation] = useState<string>(settings.location || 'WH1');
  const [sku, setSku] = useState<string>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string>('');
  const [clientReference, setClientReference] = useState<string>('');
  const [lines, setLines] = useState<OrderLine[]>([{ sku: 'SKU-1', quantity: 1 }]);
  const [orderResponse, setOrderResponse] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const baseUrl = useMemo(() => `${apiBaseUrl.replace(/\/$/, '')}/tenants/${tenantId}`, [apiBaseUrl, tenantId]);

  const fetchInventory = async () => {
    setError('');
    try {
      const url = new URL(`${baseUrl}/stock`);
      if (sku) {
        url.searchParams.set('sku', sku);
      }
      if (location) {
        url.searchParams.set('location', location);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }
      const payload = await response.json();
      setInventory(payload.items || []);
    } catch (err: any) {
      setError(err.message || 'Request failed');
      setInventory([]);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const updateLine = (index: number, prop: keyof OrderLine, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[index], [prop]: prop === 'quantity' ? Number(value) : value } as OrderLine;
      next[index] = line;
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, { sku: '', quantity: 1 }]);

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const submitOrder = async () => {
    setSubmitting(true);
    setOrderResponse('');
    try {
      const payload = {
        clientReference: clientReference || undefined,
        lines: lines.filter((line) => line.sku && line.quantity > 0)
      };
      const response = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
      }
      const json = await response.json();
      setOrderResponse(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setOrderResponse(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>OmniStock Mobile Console</Text>
        <Text style={styles.subtitle}>Inspect stock and submit orders wherever you are.</Text>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Connection</Text>
          <TextInput style={styles.input} value={apiBaseUrl} onChangeText={setApiBaseUrl} placeholder="API base URL" autoCapitalize="none" />
          <TextInput style={styles.input} value={tenantId} onChangeText={setTenantId} placeholder="Tenant" autoCapitalize="none" />
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Location" autoCapitalize="none" />
          <TouchableOpacity style={styles.button} onPress={fetchInventory}>
            <Text style={styles.buttonLabel}>Refresh Inventory</Text>
          </TouchableOpacity>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Inventory</Text>
          <TextInput style={styles.input} value={sku} onChangeText={setSku} placeholder="Filter by SKU" autoCapitalize="characters" />
          {inventory.map((item) => (
            <View key={`${item.sku}-${item.locationId}`} style={styles.listRow}>
              <View>
                <Text style={styles.listSku}>{item.sku}</Text>
                <Text style={styles.listLocation}>{item.locationId || '—'}</Text>
              </View>
              <View>
                <Text style={styles.listQty}>{item.available} available</Text>
                <Text style={styles.listSubtle}>{item.onHand} on hand</Text>
              </View>
            </View>
          ))}
          {inventory.length === 0 && <Text style={styles.empty}>No inventory rows returned.</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Create Order</Text>
          <TextInput style={styles.input} value={clientReference} onChangeText={setClientReference} placeholder="Client reference" autoCapitalize="none" />
          {lines.map((line, idx) => (
            <View key={idx} style={styles.lineRow}>
              <TextInput
                style={[styles.input, styles.lineInput]}
                value={line.sku}
                placeholder="SKU"
                autoCapitalize="characters"
                onChangeText={(value) => updateLine(idx, 'sku', value)}
              />
              <TextInput
                style={[styles.input, styles.lineInput]}
                value={String(line.quantity)}
                placeholder="Qty"
                keyboardType="numeric"
                onChangeText={(value) => updateLine(idx, 'quantity', value)}
              />
              <TouchableOpacity style={[styles.button, styles.removeButton]} onPress={() => removeLine(idx)}>
                <Text style={styles.buttonLabel}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.secondaryButton} onPress={addLine}>
            <Text style={styles.buttonLabel}>Add Line</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={submitOrder} disabled={submitting}>
            <Text style={styles.buttonLabel}>{submitting ? 'Submitting…' : 'Submit Order'}</Text>
          </TouchableOpacity>
          {!!orderResponse && <Text style={styles.response}>{orderResponse}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8'
  },
  container: {
    padding: 16
  },
  heading: {
    fontSize: 24,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: '#555'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d4d9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  secondaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  removeButton: {
    backgroundColor: '#f87171',
    width: 44,
    justifyContent: 'center'
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600'
  },
  error: {
    color: '#b91c1c'
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db'
  },
  listSku: {
    fontWeight: '600',
    fontSize: 16
  },
  listLocation: {
    color: '#6b7280'
  },
  listQty: {
    fontWeight: '600'
  },
  listSubtle: {
    color: '#6b7280'
  },
  empty: {
    color: '#6b7280'
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  lineInput: {
    flex: 1,
    marginBottom: 0
  },
  response: {
    marginTop: 12,
    color: '#111827'
  }
});
