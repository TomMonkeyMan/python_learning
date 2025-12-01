// src/utils/timeUtils.js

// 解析后端 EST 时间字符串为标准 Date（UTC 内部表示）
export const parseBackendTimestamp = (timestampStr) => {
  //if (!timestampStr || typeof timestampStr !== 'string') {
  //  console.error("Invalid timestampStr:", timestampStr, "typeof:", typeof timestampStr);
  //  debugger; // 或保留
  //return new Date(0);
  //}
  const clean = timestampStr.replace(/\.\d{3}$/, "");
  const iso = clean.replace(" ", "T") + "-05:00"; // EST = UTC-5
  return new Date(iso);
};

// 获取用户本地“今天”的日期字符串（YYYY-MM-DD）
export const getLocalToday = () => {
  return new Date().toLocaleDateString("sv-SE");
};

export const getLocalYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
};

// 格式化显示时间（按用户本地时区）
export const formatDisplayTime = (timestamp) => {
  const msgDate = parseBackendTimestamp(timestamp);
  const dateStr = msgDate.toLocaleDateString("sv-SE");

  const today = getLocalToday();
  const yesterday = getLocalYesterday();

  const timePart = msgDate.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dateStr === today) {
    return timePart;
  } else if (dateStr === yesterday) {
    return `昨天 ${timePart}`;
  } else {
    const datePart =
      msgDate
        .toLocaleDateString("zh-CN", {
          month: "numeric",
          day: "numeric",
        })
        .replace("/", "月") + "日";
    return `${datePart} ${timePart}`;
  }
};

// 判断是否需要日期横幅（按用户本地日期）
export const shouldShowDateHeader = (currentMsg, prevMsg) => {
  if (!prevMsg) return true;
  const curr = parseBackendTimestamp(currentMsg.timestamp).toLocaleDateString(
    "sv-SE",
  );
  const prev = parseBackendTimestamp(prevMsg.timestamp).toLocaleDateString(
    "sv-SE",
  );
  return curr !== prev;
};

// 用于 date-header 的完整本地日期
export const formatFullLocalDate = (timestamp) => {
  const d = parseBackendTimestamp(timestamp);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
