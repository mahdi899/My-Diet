import { Module } from '@nestjs/common';
import { MediaController, MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';

@Module({
  controllers: [MessagingController, MediaController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
