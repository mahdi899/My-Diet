import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { requiredUuid } from '../common/parse.js';
import { ApiError } from '../common/errors.js';
import { IntegrationsService } from './integrations.service.js';

@Controller('v1/admin')
@Roles('admin')
export class IntegrationsController{
 constructor(private readonly service:IntegrationsService){}
 @Get('ai-connections') list(){return this.service.connections();}
 @Post('ai-connections') add(@Req() req:Request,@Body() body:unknown){return this.service.addConnection(actor(req).id,body);}
 @Put('ai-connections/:id/active') activate(@Req() req:Request,@Param('id') id:string,@Body() body:unknown){const v=body as {active?:unknown};if(typeof v?.active!=='boolean')throw new ApiError(400,'validation','وضعیت معتبر نیست');return this.service.activate(actor(req).id,requiredUuid(id),v.active);}
 @Delete('ai-connections/:id') remove(@Req() req:Request,@Param('id') id:string){return this.service.removeConnection(actor(req).id,requiredUuid(id));}
 @Get('push/status') status(){return this.service.pushStatus();}
 @Put('push/firebase') firebase(@Req() req:Request,@Body() body:unknown){return this.service.configureFirebase(actor(req).id,body);}
 @Get('push/devices') devices(){return this.service.devices();}
 @Get('push/campaigns') campaigns(){return this.service.campaigns();}
 @Post('push/campaigns') create(@Req() req:Request,@Body() body:unknown){return this.service.createCampaign(actor(req).id,body);}
 @Post('push/campaigns/:id/send') send(@Req() req:Request,@Param('id') id:string){return this.service.sendCampaign(actor(req).id,requiredUuid(id));}
 @Delete('push/campaigns/:id') delete(@Req() req:Request,@Param('id') id:string){return this.service.deleteCampaign(actor(req).id,requiredUuid(id));}
}
