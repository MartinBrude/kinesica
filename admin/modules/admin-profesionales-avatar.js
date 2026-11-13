export function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(username, name) {
  const map = {
    norberto: "linear-gradient(135deg, #0b2545, #1d4ed8)",
    maria: "linear-gradient(135deg, #047857, #10b981)",
    martin: "linear-gradient(135deg, #4338ca, #6366f1)",
    facundo: "linear-gradient(135deg, #b45309, #f59e0b)",
  };
  const u = String(username || "").toLowerCase();
  if (map[u]) return map[u];
  const list = [
    "linear-gradient(135deg, #0b2545, #1d4ed8)",
    "linear-gradient(135deg, #047857, #10b981)",
    "linear-gradient(135deg, #4338ca, #6366f1)",
    "linear-gradient(135deg, #b45309, #f59e0b)",
    "linear-gradient(135deg, #be185d, #ec4899)",
    "linear-gradient(135deg, #0e7490, #06b6d4)",
  ];
  let h = 0;
  const s = (username || name || "u").toLowerCase();
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return list[Math.abs(h) % list.length];
}
