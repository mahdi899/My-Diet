import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdaptersModule } from '../adapters/adapters.module.js';
import { RolesGuard, SessionGuard } from '../common/auth.js';
import { IdentityController, MeProfileController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [AdaptersModule],
  controllers: [IdentityController, MeProfileController],
  providers: [
    IdentityService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
