// src/utils/authUtils.js
import Cookies from "js-cookie";
import { COOKIE_NAME, COOKIE_PATH } from "../constants";

export const isAuthenticated = () => {
  return Cookies.get(COOKIE_NAME) === "true";
};

export const setAuthCookie = () => {
  Cookies.set(COOKIE_NAME, "true", {
    expires: 30,
    path: COOKIE_PATH,
    secure: window.location.hostname !== "localhost",
    sameSite: "Strict",
  });
};

// 新增：清除所有认证相关 Cookie
export const clearAllAuthCookies = () => {
  // 1. 清除前端密码验证标记
  Cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
  // 2. 清除后端设置的 auth_user（路径必须匹配！）
  Cookies.remove("auth_user", { path: "/xbzchat" });
};

export const removeAuthCookie = () => {
  // 1. 清除前端密码验证标记
  Cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
  // 2. 清除后端设置的 auth_user（路径必须匹配！）
  Cookies.remove("auth_user", { path: "/xbzchat" });
};