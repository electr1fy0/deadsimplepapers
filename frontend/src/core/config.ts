const isLocal: boolean =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE: string = isLocal
  ? "http://localhost:8080"
  : "https://deadsimplepapers-production.up.railway.app";
