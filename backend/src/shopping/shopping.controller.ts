import { Body,Controller,Get,Param,Patch,Query,Req } from '@nestjs/common';
import { ApiOperation,ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { actor,Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { ShoppingService,shoppingScope } from './shopping.service.js';
const flagSchema=z.object({weekStart:z.iso.date(),days:z.array(z.iso.date()).min(1).max(7).optional(),expectedRevision:z.number().int().positive(),alreadyHave:z.boolean(),purchased:z.boolean()}).strict();
@ApiTags('shopping')
@Roles('user')
@Controller('v1/me/shopping-list')
export class ShoppingController {
 constructor(private readonly shopping:ShoppingService){}
 private scope(weekStart:unknown,days:unknown){
  if(typeof weekStart!=='string'||days!==undefined&&typeof days!=='string')throw new ApiError(400,'validation','محدوده لیست خرید معتبر نیست');
  return shoppingScope(weekStart,typeof days==='string'?days.split(','):undefined);
 }
 @Get()
 @ApiOperation({summary:'Generate a versioned shopping list from selected published options',description:'weekStart is a Saturday YYYY-MM-DD. Optional days is a comma-separated subset of dates in that week. Missing/ambiguous ingredients remain flagged.'})
 get(@Req() req:Request,@Query('weekStart') weekStart:unknown,@Query('days') days:unknown){return this.shopping.get(actor(req).id,this.scope(weekStart,days));}
 @Get('share')
 @ApiOperation({summary:'Get owner-authorized shareable text; no public access token or clinical identifiers'})
 share(@Req() req:Request,@Query('weekStart') weekStart:unknown,@Query('days') days:unknown){return this.shopping.share(actor(req).id,this.scope(weekStart,days));}
 @Patch('items/:key')
 @ApiOperation({summary:'Set already-have and purchased flags with optimistic revision checking'})
 flag(@Req() req:Request,@Param('key') key:string,@Body() body:unknown){
  const parsed=flagSchema.safeParse(body);
  if(!parsed.success||!/^[a-f0-9]{64}$/.test(key))throw new ApiError(400,'validation','تغییر لیست خرید معتبر نیست');
  const v=parsed.data;return this.shopping.flag(actor(req).id,shoppingScope(v.weekStart,v.days),key,v.expectedRevision,v.alreadyHave,v.purchased);
 }
}
