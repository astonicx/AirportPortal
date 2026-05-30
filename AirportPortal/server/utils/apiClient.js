"use strict";
const axios = require("axios");

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE = process.env.BDPA_BASE_URL || "";
const TOKEN = process.env.BEARER_TOKEN || "";

const instance = axios.create({
  baseURL: BASE,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  timeout: 15000,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(config, attempt = 0) {
  try {
    const res = await instance.request(config);
    return res.data;
  } catch (err) {
    const status = err?.response?.status ?? 0;
    if (status === 555 && attempt < 3) {
      await sleep(200 * Math.pow(2, attempt));
      return request(config, attempt + 1);
    }
    const message =
      err?.response?.data?.error || err?.message || "Upstream failure";
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

