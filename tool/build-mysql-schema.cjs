const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'backend-laravel/contracts/postgres-schema.json'), 'utf8'));
const foundation = new Set(['users','specialist_profiles','admin_credentials','specialist_credentials','wallets','conversations','conversation_participants','otp_challenges','sessions','refresh_tokens','staff_totp','totp_challenges','user_personal_details']);
const q = text => '`' + text.replaceAll('`','``') + '`';
const short = name => name.length <= 64 ? name : name.slice(0,50)+'_'+crypto.createHash('sha256').update(name).digest('hex').slice(0,12);
function expression(sql, table) {
  if(sql==='CHECK (id)' && table.columns.find(c=>c.name==='id')?.type==='boolean') return 'CHECK (`id`=1)';
  sql=sql.replace(/::(?:text\[\]|text|numeric|integer|regconfig)/g,'');
  sql=sql.replace(/([a-z_]+) = ANY \(ARRAY\[([^\]]+)\]\)/g,'$1 IN ($2)');
  sql=sql.replace(/([a-z_]+) ~ ('[^']*')/g, "regexp_like($1,$2,'c')");
  sql=sql.replace(/\(([a-z_]+)\) ~ ('[^']*')/g, "regexp_like($1,$2,'c')");
  sql=sql.replace(/jsonb_typeof\(([^)]+)\)/g,'lower(json_type($1))');
  sql=sql.replace(/created_at \+ '30 days'::interval/g,'date_add(created_at, interval 30 day)');
  const names=new Set(table.columns.map(c=>c.name));
  return sql.split(/('(?:''|[^'])*')/).map((part,i)=>i%2?part:part.replace(/"([a-z_]+)"|\b([a-z_][a-z_0-9]*)\b/g,(m,a,b)=>names.has(a||b)?q(a||b):m)).join('');
}
const result={sourceTables:catalog.tables.length, tables:[],constraints:[],indexes:[],performanceIndexesPending:[],seeds:catalog.seeds};
for(const table of catalog.tables) {
  const indexed=new Set();
  for(const c of table.constraints.filter(c=>['p','u','f'].includes(c.type))) {
    const list=c.definition.match(/\(([^)]+)\)/)?.[1]||'';
    for(const name of list.split(',').map(c=>c.trim().replaceAll('"',''))) indexed.add(name);
  }
  for(const i of table.indexes) {
    if(i.definition.includes(' USING btree ')) for(const col of table.columns) if(new RegExp('\\b'+col.name+'\\b').test(i.definition.split(' USING btree ')[1])) indexed.add(col.name);
  }
  const types={};
  const fields=table.columns.map(col=>{
    let type=col.type;
    if(type==='uuid') type='char(36)';
    else if(type==='timestamp with time zone') type='datetime(6)';
    else if(type==='text') type=indexed.has(col.name)?'varchar(255)':'longtext';
    else if(type==='text[]'||type==='jsonb') type='json';
    else if(type==='boolean') type='tinyint';
    else if(type==='integer') type='int';
    else if(type==='bytea') type='longblob';
    else if(type==='numeric') type='decimal(65,20)';
    else type=type.replace('character varying','varchar').replace('numeric','decimal');
    types[col.name]=type;
    let line=q(col.name)+' '+type+(col.required?' not null':' null');
    if(col.identity) line+=' auto_increment';
    else if(col.default!==null) {
      let def=col.default.replace(/::(?:text\[\]|text|jsonb)/g,'').replace('now()','current_timestamp(6)').replace(/^true$/,'1').replace(/^false$/,'0');
      if(col.type==='text[]') def="'[]'";
      line+=' default '+(['json','longtext','longblob'].includes(type)?'('+def+')':def);
    }
    return line;
  });
  for(const c of table.constraints.filter(c=>c.type==='p')) fields.push(c.definition.replaceAll('"','`').replace(/\b[a-z_][a-z_0-9]*\b/g,m=>table.columns.some(c=>c.name===m)?q(m):m));
  for(const col of table.columns.filter(c=>c.identity)) fields.push('index '+q(short(table.name+'_'+col.name+'_identity'))+'('+q(col.name)+')');
  if(!foundation.has(table.name)) result.tables.push({name:table.name,sql:'create table '+q(table.name)+' (\n'+fields.join(',\n')+'\n) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_bin'});
  for(const c of table.constraints.filter(c=>['c','u','f'].includes(c.type))) {
    if(foundation.has(table.name) && !(table.name==='conversations'&&c.definition.includes('request_id'))) continue;
    let def=c.definition;
    if(c.type==='c') def=expression(def,table);
    else if(c.type==='f') def=def.replace(/\bREFERENCES ([a-z_]+)\(([^)]+)\)/,(m,t,cols)=>'REFERENCES '+q(t)+'('+cols.split(',').map(c=>q(c.trim())).join(',')+')').replace(/FOREIGN KEY \(([^)]+)\)/,(m,cols)=>'FOREIGN KEY ('+cols.split(',').map(c=>q(c.trim())).join(',')+')');
    else if(def.includes('NULLS NOT DISTINCT')) {
      const cols=def.match(/\(([^)]+)\)/)[1].split(',').map(c=>c.trim());
      const nullable=cols.filter(name=>!table.columns.find(c=>c.name===name).required);
      for(const name of nullable) fields.push(q('_nn_'+name)+' varchar(257) generated always as (if('+q(name)+" is null,'N',concat('V',"+q(name)+'))) stored');
      def='UNIQUE ('+cols.map(name=>q(nullable.includes(name)?'_nn_'+name:name)).join(',')+')';
    } else def=def.replace(/\(([^)]+)\)/,(m,cols)=>'('+cols.split(',').map(c=>q(c.trim().replaceAll('"',''))).join(',')+')');
    result.constraints.push({table:table.name,name:short(c.name),sql:'alter table '+q(table.name)+' add constraint '+q(short(c.name))+' '+def});
  }
  if(!foundation.has(table.name)) result.tables.find(t=>t.name===table.name).sql='create table '+q(table.name)+' (\n'+fields.join(',\n')+'\n) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_bin';
  for(const index of table.indexes) {
    if(foundation.has(table.name)||table.constraints.some(c=>c.name===index.name)) continue;
    if(index.definition.includes(' USING gin ')||index.definition.includes("current ->>")) {result.performanceIndexesPending.push(index);continue;}
    const [indexPart, predicate]=index.definition.split(' WHERE ');
    const match=indexPart.match(/USING btree \((.*)\)$/);
    if(match) match[2]=predicate;
    if(!match) throw new Error('Unsupported index '+index.definition);
    const unique=index.definition.startsWith('CREATE UNIQUE');
    if(unique&&match[2]) {
      const keys=match[1].split(/,\s*(?![^()]*\))/);
      const generated=keys.map((key,n)=>{
        const name='_ix_'+crypto.createHash('sha256').update(index.name+':'+n).digest('hex').slice(0,12);
        const raw=key.replaceAll('"','');
        const type=raw.startsWith('md5(')?'char(32)':types[raw];
        if(!type) throw new Error('Unknown partial index key '+raw);
        return {name,sql:q(name)+' '+type+' generated always as (case when '+expression(match[2],table)+' then '+expression(raw,table)+' else null end) stored'};
      });
      result.indexes.push({table:table.name,name:short(index.name),sql:'alter table '+q(table.name)+' '+generated.map(g=>'add column '+g.sql).join(',')+', add unique index '+q(short(index.name))+'('+generated.map(g=>q(g.name)).join(',')+')'});
    } else {
      const cols=match[1].split(',').map(col=>expression(col.trim(),table)).join(',');
      result.indexes.push({table:table.name,name:short(index.name),sql:'create '+(unique?'unique ':'')+'index '+q(short(index.name))+' on '+q(table.name)+'('+cols+')'});
    }
  }
}
fs.writeFileSync(path.join(root,'backend-laravel/contracts/mysql-schema.json'),JSON.stringify(result,null,2)+'\n');
console.log(`${result.tables.length} additional tables, ${result.constraints.length} constraints, ${result.indexes.length} indexes compiled; ${result.performanceIndexesPending.length} PostgreSQL performance indexes require MySQL-specific review.`);
