/** Единственный администратор FST (полный доступ в облачной версии). */
export const FST_ADMIN_EMAIL = 'nikegeorgian@gmail.com'

export function isFstAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === FST_ADMIN_EMAIL.toLowerCase()
}
