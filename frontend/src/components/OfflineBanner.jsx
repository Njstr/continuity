import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { styles } from "../styles/styles";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div style={styles.offlineBanner}>
      <WifiOff size={13} />
      <span>Offline — your data is safe, but the mentor needs a connection.</span>
    </div>
  );
}
