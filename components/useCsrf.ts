"use client";
import { useEffect, useState } from "react";

export function useCsrfToken() {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { 
        if (mounted) {
          setToken(d?.csrfToken || ""); 
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);
  
  return { token, loading };
}