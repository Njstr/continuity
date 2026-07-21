// A random id generated once per browser install and reused forever. In
// local mode (no login) this is what the backend uses to keep one
// founder's data separate from another's.

export function getDeviceId() {
  let id = localStorage.getItem("fc:deviceId");
  if (!id) {
    id = "dev_" + crypto.randomUUID();
    localStorage.setItem("fc:deviceId", id);
  }
  return id;
}
