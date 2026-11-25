import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrationFiles} from '@/lib/database/migrations';
import {rewardsFile,rewardsChecksum} from '@/lib/database/rewards-activation';
it('pins the exact additive rewards SQL and excludes it from generic customer migration activation',async()=>{
 expect(await migrationFiles('rewards')).toEqual([rewardsFile]);
 expect(await migrationFiles('customer')).not.toContain(rewardsFile);
 const sql=readFileSync('supabase/migrations/'+rewardsFile,'utf8');
 expect(createHash('sha256').update(sql).digest('hex')).toBe(rewardsChecksum);
 expect(sql).not.toMatch(/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+(?:TABLE|SCHEMA))\b/i);
});
