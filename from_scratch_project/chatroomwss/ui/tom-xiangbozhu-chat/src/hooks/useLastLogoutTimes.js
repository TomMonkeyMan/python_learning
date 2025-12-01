// src/hooks/useLastLogoutTimes.js
import { useState, useEffect } from "react";

const fetchLastLogoutTimes = async () => {
  try {
    const res = await fetch("/xbzchat/v1/last_online_time");
    if (!res.ok) return {};
    const data = await res.json();
    const logoutMap = {};
    data.forEach((item) => {
      logoutMap[item.nick_name] = item.last_logout_time;
    });
    return logoutMap;
  } catch (err) {
    console.warn("Failed to fetch last logout times:", err);
    return {};
  }
};

export const useLastLogoutTimes = (enabled = true, intervalMs = 15000) => {
  const [lastLogoutTimes, setLastLogoutTimes] = useState({});

  useEffect(() => {
    if (!enabled) return;

    let firstLoad = true;

    const load = async () => {
      const data = await fetchLastLogoutTimes();
      setLastLogoutTimes(data);
    };

    load(); // 立即加载一次

    if (!firstLoad) return; // 防止重复设 interval
    firstLoad = false;

    const intervalId = setInterval(load, intervalMs);
    return () => clearInterval(intervalId);
  }, [enabled, intervalMs]);

  return lastLogoutTimes;
};