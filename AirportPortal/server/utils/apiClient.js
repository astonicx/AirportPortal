"use strict";
const axios = require("axios");

/**
 * Server-side Axios helper — mirrors the client ApiClient shape.
 */
class ApiClient {
  constructor(baseURL = "") {
    this.instance = axios.create({
      baseURL,
      headers: { "Content-Type": "application/json" },
    });
  }

  setToken(token) {
    if (token) {
      this.instance.defaults.headers.common["Authorization"] = "Bearer " + token;
    } else {
      delete this.instance.defaults.headers.common["Authorization"];
    }
  }

  async request(config) {
    try {
      const res = await this.instance.request(config);
      return { success: true, data: res.data };
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || "Request failed";
      return { success: false, error: message };
    }
  }

  async getAll(url, config = {}) {
    return this.request({ url, method: "GET", ...config });
  }

  async getOne(url, config = {}) {
    return this.request({ url, method: "GET", ...config });
  }

  async create(url, data, config = {}) {
    return this.request({ url, method: "POST", data, ...config });
  }

  async update(url, data, config = {}) {
    return this.request({ url, method: "PUT", data, ...config });
  }

  async patch(url, data, config = {}) {
    return this.request({ url, method: "PATCH", data, ...config });
  }

  async delete(url, config = {}) {
    return this.request({ url, method: "DELETE", ...config });
  }
}

module.exports = { ApiClient };
