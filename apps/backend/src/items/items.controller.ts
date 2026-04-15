import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ResponseMeta } from '../common/decorators/response-meta.decorator';

@Controller('reports/:reportId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(
    @Param('reportId') reportId: string,
    @Req() req: Request,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(reportId, req.user!['id'], dto);
  }

  @Get()
  findAll(@Param('reportId') reportId: string, @Req() req: Request) {
    return this.itemsService.findAll(reportId, req.user!['id']);
  }

  @Patch(':itemId')
  update(
    @Param('reportId') reportId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(itemId, reportId, req.user!['id'], dto);
  }

  @Delete(':itemId')
  @ResponseMeta('Delete successfully', '004')
  remove(
    @Param('reportId') reportId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.itemsService.remove(itemId, reportId, req.user!['id']);
  }
}
