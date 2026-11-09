import { router } from 'expo-router';

/** Opens the record (or project) a template has just created. */
export function openCreated(created: { kind: string; id: string }): void {
  if (created.kind === 'project') router.push({ pathname: '/project/[id]', params: { id: created.id } });
  else router.push({ pathname: '/item/[id]', params: { id: created.id } });
}
