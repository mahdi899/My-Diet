import { Module } from '@nestjs/common';
import { ShoppingService } from './shopping.service.js';
import { ShoppingController } from './shopping.controller.js';
@Module({providers:[ShoppingService],controllers:[ShoppingController],exports:[ShoppingService]})
export class ShoppingModule {}
