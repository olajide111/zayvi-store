import type {OwnerLoginContext} from './owner-login-context';
/** Hammy pilot navigation only. This is not a provisioned tenant, store or owner binding. */
export const HAMMY_OWNER_LOGIN_CONTEXT:OwnerLoginContext=Object.freeze({
  key:'hammy-preview',defaultPath:'/admin/pilots/hammy',
  allowedPaths:Object.freeze(['/admin/pilots/hammy','/admin/pilots/hammy/integrations']),
});
