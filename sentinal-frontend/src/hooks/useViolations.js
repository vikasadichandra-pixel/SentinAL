import { useEffect, useState } from "react";
import { fetchViolations } from "../services/api";

export default function useViolations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        // Only fetch from the real Django backend
        const data = await fetchViolations();

        if (isMounted) {
          setViolations((prev) => {
            if (prev && data && prev.length === data.length) {
              const unchanged = prev.every((item, idx) => {
                const d = data[idx];
                return d && item.id === d.id && item.status === d.status;
              });
              if (unchanged) return prev;
            }
            return data;
          });
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          // If the server is offline, just show a real error, no fake data
          setLoading(false);
          setError("Connection to SentinAL backend lost.");
        }
      }
    }

    load();
    // Poll the Django server every 2 seconds for new breaches
    const interval = setInterval(load, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { violations, loading, error };
}