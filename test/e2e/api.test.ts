import fetch from "node-fetch";

function client(path: string, options: any) {
  return fetch(`http://localhost:3000${path}`, options).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  });
}

test("POST /debug/seed-marketplaces should seed marketplaces", async () => {
  const { status, data } = await client("/debug/seed-marketplaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${globalThis.testToken}`,
      "Content-Type": "application/json"
    }
  });

  expect(status).toBe(200);
  expect(data.ok).toBe(true);
});
