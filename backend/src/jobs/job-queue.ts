export const JOB_QUEUE = Symbol('JOB_QUEUE');

export interface JobQueue {
  start(): Promise<unknown>;
  stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>;
  createQueue(name: string, options?: { policy?: string }): Promise<void>;
  getQueue(name: string): Promise<unknown>;
  send(
    name: string,
    data: object,
    options?: { singletonKey?: string },
  ): Promise<string | null>;
  work(
    name: string,
    handler: (jobs: ReadonlyArray<{ data: object }>) => Promise<void>,
  ): Promise<string>;
}
