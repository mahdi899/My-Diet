import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { Role } from '../common/roles.js';
import { ApiError } from '../common/errors.js';
import { ApplicationError } from '../common/application-error.js';
import { PlanUseCases } from './application/plan-use-cases.js';
import { PostgresPlanRepository } from './infrastructure/postgres-plan-repository.js';

/** Nest adapter; business decisions live in the framework-independent use cases. */
@Injectable()
export class PlanDraftService {
  constructor(
    @Inject(PlanUseCases) private readonly useCases: PlanUseCases,
    @Inject(PostgresPlanRepository) private readonly repository: PostgresPlanRepository,
  ) {}
  generate(...args: Parameters<PlanUseCases['generate']>): ReturnType<PlanUseCases['generate']> {
    return this.call(() => this.useCases.generate(...args));
  }

  queue(...args: Parameters<PlanUseCases['queue']>): ReturnType<PlanUseCases['queue']> {
    return this.call(() => this.useCases.queue(...args));
  }

  userRequest(...args: Parameters<PlanUseCases['userRequest']>): ReturnType<PlanUseCases['userRequest']> {
    return this.call(() => this.useCases.userRequest(...args));
  }

  staffRequest(...args: Parameters<PlanUseCases['staffRequest']>): ReturnType<PlanUseCases['staffRequest']> {
    return this.call(() => this.useCases.staffRequest(...args));
  }

  replaceDraft(...args: Parameters<PlanUseCases['replaceDraft']>): ReturnType<PlanUseCases['replaceDraft']> {
    return this.call(() => this.useCases.replaceDraft(...args));
  }

  regenerate(...args: Parameters<PlanUseCases['regenerate']>): ReturnType<PlanUseCases['regenerate']> {
    return this.call(() => this.useCases.regenerate(...args));
  }

  ask(...args: Parameters<PlanUseCases['ask']>): ReturnType<PlanUseCases['ask']> {
    return this.call(() => this.useCases.ask(...args));
  }

  answer(...args: Parameters<PlanUseCases['answer']>): ReturnType<PlanUseCases['answer']> {
    return this.call(() => this.useCases.answer(...args));
  }

  acknowledge(...args: Parameters<PlanUseCases['acknowledge']>): ReturnType<PlanUseCases['acknowledge']> {
    return this.call(() => this.useCases.acknowledge(...args));
  }

  questionsForUser(...args: Parameters<PlanUseCases['questionsForUser']>): ReturnType<PlanUseCases['questionsForUser']> {
    return this.call(() => this.useCases.questionsForUser(...args));
  }

  withdraw(...args: Parameters<PlanUseCases['withdraw']>): ReturnType<PlanUseCases['withdraw']> {
    return this.call(() => this.useCases.withdraw(...args));
  }

  publishedPlan(...args: Parameters<PlanUseCases['publishedPlan']>): ReturnType<PlanUseCases['publishedPlan']> {
    return this.call(() => this.useCases.publishedPlan(...args));
  }

  planWeek(...args: Parameters<PlanUseCases['planWeek']>): ReturnType<PlanUseCases['planWeek']> {
    return this.call(() => this.useCases.planWeek(...args));
  }

  planDay(...args: Parameters<PlanUseCases['planDay']>): ReturnType<PlanUseCases['planDay']> {
    return this.call(() => this.useCases.planDay(...args));
  }

  listRequests(...args: Parameters<PlanUseCases['listRequests']>): ReturnType<PlanUseCases['listRequests']> {
    return this.call(() => this.useCases.listRequests(...args));
  }

  requestTimeline(...args: Parameters<PlanUseCases['requestTimeline']>): ReturnType<PlanUseCases['requestTimeline']> {
    return this.call(() => this.useCases.requestTimeline(...args));
  }

  correct(...args: Parameters<PlanUseCases['correct']>): ReturnType<PlanUseCases['correct']> {
    return this.call(() => this.useCases.correct(...args));
  }

  patientPlanVersions(...args: Parameters<PlanUseCases['patientPlanVersions']>): ReturnType<PlanUseCases['patientPlanVersions']> {
    return this.call(() => this.useCases.patientPlanVersions(...args));
  }

  adminPlanVersion(...args: Parameters<PlanUseCases['adminPlanVersion']>): ReturnType<PlanUseCases['adminPlanVersion']> {
    return this.call(() => this.useCases.adminPlanVersion(...args));
  }
  copyPublishedDraft(client: PoolClient, parentRequestId: string, requestId: string): Promise<void> {
    return this.call(() => this.useCases.copyPublishedDraft(this.repository.using(client), parentRequestId, requestId));
  }
  publish(actorId: string, role: Role, requestId: string, lock: number, existing?: PoolClient) {
    return this.call(() => this.useCases.publish(actorId, role, requestId, lock, existing ? this.repository.using(existing) : undefined));
  }
  private async call<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); }
    catch (error) {
      if (error instanceof ApplicationError) throw new ApiError(error.status, error.code, error.messageFa);
      throw error;
    }
  }
}
