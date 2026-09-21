export type Role = 'ABOGADO' | 'ADMIN';

export function hasRole(userRole: Role, required: Role | Role[]) {
  if (Array.isArray(required)) return required.includes(userRole);
  return userRole === required;
}
