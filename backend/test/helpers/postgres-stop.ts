import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

/** embedded-postgres uses taskkill /f /t on Windows; fast shutdown avoids orphan recovery children. */
export function installGracefulStop(database:{stop():Promise<void>},directory:string):void {
 if(process.platform!=='win32')return;
 let stopping:Promise<void>|undefined;
 database.stop=()=>stopping??= (async()=>{
  if(!await access(join(directory,'postmaster.pid')).then(()=>true,()=>false))return;
  const {pg_ctl}=await import('@embedded-postgres/windows-x64');
  await promisify(execFile)(pg_ctl,['-D',directory,'-m','fast','-w','-t','15','stop'],{windowsHide:true});
 })();
}
