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

export const clearAuthCookie = () => {
  Cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
};

export const removeAuthCookie = () => {
  Cookies.remove(COOKIE_NAME, { path: COOKIE_PATH });
};
