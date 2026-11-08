export class GenerationError extends Error {
  /** What the failed attempts already cost, so the day's spend stays honest. */
  usage?: { tokens: number; costMicros: number; model: string; provider?: string; attempts?: number };
  constructor(readonly code: string) { super(code); }
}

/** Retry only an explicit rate-limit rejection. Network uncertainty may have billed. */
export async function requestDraft(url: string, init: RequestInit, send: typeof fetch = fetch): Promise<string> {
  for (let attempt=0;attempt<2;attempt++) {
    let response: Response;
    try { response=await send(url,{...init,redirect:'error',signal:AbortSignal.timeout(60_000)}); }
    catch { throw new GenerationError('provider_outcome_unknown'); }
    if(response.status===429 && attempt===0) { await response.body?.cancel(); await new Promise(r=>setTimeout(r,250)); continue; }
    if(!response.ok) {
      await response.body?.cancel();
      throw new GenerationError(response.status===401 || response.status===403 ? 'provider_authentication_failed' :
        response.status===429 ? 'provider_rate_limited' : 'provider_rejected');
    }
    const reader=response.body?.getReader();
    if(!reader)throw new GenerationError('invalid_draft');
    const chunks:Uint8Array[]=[];let size=0;
    try {
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        if(size>1_000_000){await reader.cancel();throw new GenerationError('provider_response_too_large');}chunks.push(value);}
    }catch(error){if(error instanceof GenerationError)throw error;throw new GenerationError('provider_outcome_unknown');}
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new GenerationError('provider_rate_limited');
}
