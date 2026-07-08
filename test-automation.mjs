// Test automation API
const BASE = 'http://localhost:4000/api';

async function test() {
  try {
    // Test GET /automation
    console.log('=== GET /automation ===');
    const getRes = await fetch(`${BASE}/automation`);
    const getData = await getRes.json();
    console.log('Status:', getRes.status);
    console.log('Items:', getData.items?.length || 0);
    console.log('Response:', JSON.stringify(getData, null, 2));

    // Test POST /automation
    console.log('\n=== POST /automation ===');
    const postRes = await fetch(`${BASE}/automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Günlük XML Senkronizasyonu',
        type: 'xml_sync',
        triggerType: 'schedule',
        actionType: 'sync_xml',
        schedule: '*/60 * * * *',
        active: true,
      }),
    });
    const postData = await postRes.json();
    console.log('Status:', postRes.status);
    console.log('Response:', JSON.stringify(postData, null, 2));

    if (postData.item?.id) {
      const ruleId = postData.item.id;

      // Test GET /automation again
      console.log('\n=== GET /automation (after create) ===');
      const getRes2 = await fetch(`${BASE}/automation`);
      const getData2 = await getRes2.json();
      console.log('Items:', getData2.items?.length || 0);

      // Test PUT /automation/:id
      console.log('\n=== PUT /automation/:id ===');
      const putRes = await fetch(`${BASE}/automation/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Güncellenmiş XML Senkronizasyonu' }),
      });
      const putData = await putRes.json();
      console.log('Status:', putRes.status);
      console.log('Response:', JSON.stringify(putData, null, 2));

      // Test POST /automation/:id/toggle
      console.log('\n=== POST /automation/:id/toggle ===');
      const toggleRes = await fetch(`${BASE}/automation/${ruleId}/toggle`, { method: 'POST' });
      const toggleData = await toggleRes.json();
      console.log('Status:', toggleRes.status);
      console.log('Active:', toggleData.item?.active);

      // Test POST /automation/:id/run
      console.log('\n=== POST /automation/:id/run ===');
      const runRes = await fetch(`${BASE}/automation/${ruleId}/run`, { method: 'POST' });
      const runData = await runRes.json();
      console.log('Status:', runRes.status);
      console.log('Response:', JSON.stringify(runData, null, 2));

      // Test GET /automation/logs
      console.log('\n=== GET /automation/logs ===');
      const logsRes = await fetch(`${BASE}/automation/logs`);
      const logsData = await logsRes.json();
      console.log('Status:', logsRes.status);
      console.log('Logs:', logsData.items?.length || 0);

      // Test DELETE /automation/:id
      console.log('\n=== DELETE /automation/:id ===');
      const delRes = await fetch(`${BASE}/automation/${ruleId}`, { method: 'DELETE' });
      const delData = await delRes.json();
      console.log('Status:', delRes.status);
      console.log('Response:', JSON.stringify(delData, null, 2));
    }

    console.log('\n✅ All tests completed!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

test();
