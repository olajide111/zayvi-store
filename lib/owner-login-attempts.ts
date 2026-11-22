import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {OwnerLoginAttempt,OwnerLoginAttempts} from './owner-login';
import {OwnerLoginError} from './owner-login';
import type {StoreDatabaseClient} from './store-database';
const digest=/^[a-f0-9]{64}$/;
/** Only ciphertext and hashes cross the private persistence boundary. */
export interface EncryptedOwnerAttemptStore {
  create(stateHash:string,browserHash:string,payload:string,expiresAt:number):Promise<void>;
  consume(stateHash:string,browserHash:string):Promise<string|null>;
}
export function createPostgresEncryptedOwnerAttemptStore(client:Pick<StoreDatabaseClient,'query'>):EncryptedOwnerAttemptStore{
  return {
    async create(stateHash,browserHash,payload,expiresAt){
      await client.query('SELECT zayvi_owner_auth.create_attempt($1,$2,$3,to_timestamp($4::double precision))',
        [stateHash,browserHash,payload,expiresAt]);
    },
    async consume(stateHash,browserHash){
      const {rows}=await client.query('SELECT encrypted_payload FROM zayvi_owner_auth.consume_attempt($1,$2)',[stateHash,browserHash]);
      if(!rows.length)return null;
      if(rows.length!==1||typeof rows[0].encrypted_payload!=='string')throw new OwnerLoginError();
      return rows[0].encrypted_payload;
    },
  };
}
/** Trusted server key only: a dedicated 32-byte key, separate from admin cookies and provider secrets. */
export function createPostgresOwnerLoginAttempts(client:Pick<StoreDatabaseClient,'query'>,encryptionKey:Uint8Array):OwnerLoginAttempts{
  return createEncryptedOwnerLoginAttempts(createPostgresEncryptedOwnerAttemptStore(client),encryptionKey);
}
export function createEncryptedOwnerLoginAttempts(store:EncryptedOwnerAttemptStore,encryptionKey:Uint8Array):OwnerLoginAttempts{
  if(encryptionKey.byteLength!==32)throw new Error('A 32-byte login encryption key is required.');
  const key=Buffer.from(encryptionKey);
  const aad=(state:string,browser:string)=>Buffer.from(`zayvi-owner-login:v1:${state}:${browser}`);
  return {
    async create(attempt){
      try{
        if(!digest.test(attempt.stateHash)||!digest.test(attempt.browserHash))throw new OwnerLoginError();
        const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
        cipher.setAAD(aad(attempt.stateHash,attempt.browserHash));
        const encrypted=Buffer.concat([cipher.update(JSON.stringify(attempt),'utf8'),cipher.final()]);
        const payload=['1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
        await store.create(attempt.stateHash,attempt.browserHash,payload,attempt.expiresAt);
      }catch{throw new OwnerLoginError();}
    },
    async consume(stateHash,browserHash){
      try{
        if(!digest.test(stateHash)||!digest.test(browserHash))return null;
        // Database time and an atomic DELETE enforce expiry/one-use across app instances.
        const payload=await store.consume(stateHash,browserHash);
        if(payload===null)return null;
        const parts=payload.split('.');
        if(parts.length!==4||parts[0]!=='1'||!parts.slice(1).every(part=>/^[A-Za-z0-9_-]+$/.test(part)))throw new OwnerLoginError();
        const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url');
        if(iv.length!==12||tag.length!==16)throw new OwnerLoginError();
        const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad(stateHash,browserHash));decipher.setAuthTag(tag);
        const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8'));
        if(!value||value.stateHash!==stateHash||value.browserHash!==browserHash||
          typeof value.verifier!=='string'||typeof value.nonce!=='string'||typeof value.returnTo!=='string'||
          !Number.isInteger(value.createdAt)||!Number.isInteger(value.expiresAt))throw new OwnerLoginError();
        return value as OwnerLoginAttempt;
      }catch{throw new OwnerLoginError();}
    },
  };
}
