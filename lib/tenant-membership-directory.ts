import type {TenantMembershipCandidate,TenantMembershipDirectory,TenantRequestContext,VerifiedIdentity} from './tenant-access';
import {isTenantRole} from './tenant-permissions';
import type {StoreDatabaseClient} from './store-database';
type QueryClient = Pick<StoreDatabaseClient,'query'>;
type Dependencies = {
  /** API-only connection. Must have EXECUTE on the reviewed discovery function, not directory-table access. */
  discovery: QueryClient;
  withTenantClient<T>(tenantId: string, work: (client: QueryClient)=>Promise<T>): Promise<T>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validIdentity(identity: Pick<VerifiedIdentity,'issuer'|'subject'>) {
  return typeof identity.issuer==='string'&&identity.issuer.trim().length>0&&identity.issuer.length<=2048&&
    typeof identity.subject==='string'&&identity.subject.trim().length>0&&identity.subject.length<=256;
}
/** Caller must enter via withAuthorisedTenant/Store so issuer and subject are cryptographically verified. */
export function createTenantMembershipDirectory(dependencies: Dependencies): TenantMembershipDirectory {
  return {
    async findMemberships(identity) {
      if (!validIdentity(identity)) throw new Error('Verified identity is incomplete.');
      const {rows}=await dependencies.discovery.query('SELECT * FROM zayvi_identity.resolve_memberships($1, $2)',[identity.issuer,identity.subject]);
      const seen=new Set<string>();
      return rows.map(row=>{
        if (typeof row.tenant_id!=='string'||!uuid.test(row.tenant_id)||typeof row.membership_id!=='string'||!uuid.test(row.membership_id)||
            typeof row.tenant_name!=='string'||!row.tenant_name.trim()||typeof row.role!=='string'||!isTenantRole(row.role)||
            !['active','suspended','closed','pending'].includes(String(row.tenant_status))||
            !['active','invited','suspended','removed'].includes(String(row.membership_status))||seen.has(row.tenant_id)) {
          throw new Error('Membership directory returned an invalid result.');
        }
        seen.add(row.tenant_id);
        return {tenantId:row.tenant_id,tenantName:row.tenant_name,tenantStatus:row.tenant_status,
          membershipId:row.membership_id,membershipStatus:row.membership_status,role:row.role} as TenantMembershipCandidate;
      });
    },
    async isMembershipActive(context: TenantRequestContext) {
      if (!validIdentity(context.identity)||!uuid.test(context.tenantId)||!uuid.test(context.membershipId)||!isTenantRole(context.role))return false;
      return dependencies.withTenantClient(context.tenantId,async client=>{
        const {rows}=await client.query('SELECT zayvi_identity.membership_is_active($1, $2, $3::uuid, $4::uuid, $5, $6::boolean) AS active',
          [context.identity.issuer,context.identity.subject,context.tenantId,context.membershipId,context.role,context.identity.mfaVerified===true]);
        return rows.length===1&&rows[0].active===true;
      });
    },
  };
}
