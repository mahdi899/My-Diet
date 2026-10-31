import { z } from 'zod';

export const connectionSchema = z.object({
  name:z.string().trim().min(1).max(80), apiKey:z.string().min(8).max(4096).refine(v=>!/[\r\n]/.test(v)),
  baseUrl:z.string().url().max(500).refine(value=>{
    const url=new URL(value);
    return url.protocol==='https:' && !url.username && !url.password && !url.search && !url.hash &&
      !/^(localhost|.*\.localhost|.*\.local|[\d.]+|\[.*\])$/i.test(url.hostname);
  },'نشانی HTTPS عمومی سرویس را وارد کنید'),
  model:z.string().trim().min(1).max(120), costPer1kTokens:z.number().int().min(0).max(1000000000).default(0),
}).strict();
export const campaignSchema=z.object({title:z.string().trim().min(1).max(120),body:z.string().trim().min(1).max(1000),
 audience:z.enum(['all','device']),deviceId:z.string().uuid().optional(),scheduledAt:z.string().datetime({offset:true}).optional(),
}).strict().refine(v=>v.audience!=='device'||!!v.deviceId,'برای ارسال آزمایشی دستگاه را انتخاب کنید');
