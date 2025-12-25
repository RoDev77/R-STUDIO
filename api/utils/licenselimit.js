export const LICENSE_LIMIT = {
  user: 2,
  vip: 5,
};

export function getMaxLicense(user) {
  if (!user) return 0;
  if (user.role === "vip") return 5;
  return 2;
}
