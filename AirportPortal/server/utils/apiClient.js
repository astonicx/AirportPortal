"use strict";
const axios = require("axios");

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_BASE = "https://airports.api.hscc.bdpa.org/v2";
const BASE = process.env.BDPA_BASE_URL || DEFAULT_BASE;
const TOKEN = process.env.BEARER_TOKEN || "";
const DEV_LOG = process.env.NODE_ENV !== "production";

function safeUrl(url = "") {
  return String(url || "").replace(/\?.*$/, "");
}

function logRequest(config) {
  if (!DEV_LOG) return;
  const method = String(config?.method || "GET").toUpperCase();
  const url = safeUrl(config?.url || "");
  console.log(`[api] ${method} ${url}`);
}

function logResponse(config, status) {
  if (!DEV_LOG) return;
  const method = String(config?.method || "GET").toUpperCase();
  const url = safeUrl(config?.url || "");
  console.log(`[api] ${method} ${url} -> ${status}`);
}

const instance = axios.create({
  baseURL: String(BASE).replace(/\/+$/, ""),
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  timeout: 15000,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(config, attempt = 0) {
  try {
    logRequest(config);
    const res = await instance.request(config);
    logResponse(config, res.status);
    return res.data;
  } catch (err) {
    const status = err?.response?.status ?? 0;
    if (status === 555 && attempt < 3) {
      await sleep(200 * Math.pow(2, attempt));
      return request(config, attempt + 1);
    }
    const message =
      err?.response?.data?.error || err?.message || "Upstream failure";
    if (DEV_LOG) {
      logResponse(config, status || 502);
    }
    throw new ApiError(status || 502, "UPSTREAM_ERROR", message);
  }
}

module.exports = {
  ApiError,
  get: (url, config = {}) => request({ url, method: "GET", ...config }),
  post: (url, data, config = {}) => request({ url, method: "POST", data, ...config }),
  put: (url, data, config = {}) => request({ url, method: "PUT", data, ...config }),
  patch: (url, data, config = {}) => request({ url, method: "PATCH", data, ...config }),
  delete: (url, config = {}) => request({ url, method: "DELETE", ...config }),
};

