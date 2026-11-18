// Make a self-managed deployment config; never edit the Sites manifest for this.
import {readFileSync,writeFileSync} from 'node:fs';
const [name,id]=process.argv.slice(2);if(!name||!id)throw Error('Usage: node scripts/prepare-cloudflare.mjs spin-swing <D1_DATABASE_ID>');
const c=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));c.name=name;delete c.account_id;delete c.services;delete c.vars;delete c.r2_buckets;c.d1_databases=[{binding:'DB',database_name:name,database_id:id,migrations_dir:'../../drizzle'}];c.workers_dev=true;c.vars={AUTH_MODE:'standalone'};writeFileSync('dist/server/wrangler.standalone.json',JSON.stringify(c,null,2)+'\n');console.log('Wrote dist/server/wrangler.standalone.json. Owner setup is disabled; provision the host password using the CLI.');
