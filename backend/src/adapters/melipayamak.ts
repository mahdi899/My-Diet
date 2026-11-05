import type { Env } from '../config/env.js';
import type { SmsProvider } from './sms.js';

/** Credentials and OTPs are sent only in HTTPS request bodies, never logged. */
export class MelipayamakSmsProvider implements SmsProvider {
 readonly name='melipayamak';
 constructor(private readonly env:Env,private readonly request:typeof fetch=fetch){
  if(!env.MELIPAYAMAK_USERNAME||!env.MELIPAYAMAK_API_KEY||(!env.MELIPAYAMAK_FROM&&!env.MELIPAYAMAK_PATTERN_ID))throw new Error('Melipayamak credentials or sender are missing');
 }
 async sendOtp(phone:string,code:string):Promise<void>{
  if(!/^\d{6}$/.test(code))throw new Error('Invalid OTP format');
  const pattern=this.env.MELIPAYAMAK_PATTERN_ID;
  const body=new URLSearchParams({username:this.env.MELIPAYAMAK_USERNAME!,password:this.env.MELIPAYAMAK_API_KEY!,to:phone,...(pattern?{bodyId:pattern,text:code}:{from:this.env.MELIPAYAMAK_FROM!,text:`کد تأیید رژیم من: ${code}\nاعتبار: ۲ دقیقه`,isFlash:'false'})});
  try{
   const response=await this.request('https://rest.payamak-panel.com/api/SendSMS/'+(pattern?'BaseServiceNumber':'SendSMS'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok)throw new Error('Rejected');
   const result=await response.json() as {RetStatus?:number;Value?:string};
   if(Number(result.RetStatus)!==1||!/^\d{10,}$/.test(String(result.Value)))throw new Error('Rejected');
  }catch{throw new Error('SMS dispatch unavailable');}
 }
}
