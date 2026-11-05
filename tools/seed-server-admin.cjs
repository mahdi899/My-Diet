const fs=require('node:fs');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
(async()=>{
  const config=JSON.parse(fs.readFileSync('/run/admin-seed.json','utf8'));
  const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
  try {
    await db.query('begin');
    const existing=await db.query('select user_id from admin_credentials where username=$1',[config.username]);
    if(!existing.rowCount){
      const user=await db.query("insert into users(id,phone_e164,role,display_name) values($1,'+989120000099','admin','مدیر رژیم من') returning id",[randomUUID()]);
      await db.query('insert into wallets(user_id) values($1)',[user.rows[0].id]);
      await db.query('insert into admin_credentials(user_id,username,password_hash) values($1,$2,$3)',[user.rows[0].id,config.username,config.hash]);
    }
    await db.query('commit');console.log('Staff admin account ready');
  }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
})();
