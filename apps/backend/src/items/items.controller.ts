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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ResponseMeta } from '../common/decorators/response-meta.decorator';

@ApiTags('items')
@ApiBearerAuth()
@Controller('reports/:reportId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Add an item to a DRAFT report' })
  create(
    @Param('reportId') reportId: string,
    @Req() req: Request,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(reportId, req.user!['id'], dto);
  }

  @Get()
  @ApiOperation({ summary: 'List items for a report' })
  findAll(@Param('reportId') reportId: string, @Req() req: Request) {
    return this.itemsService.findAll(reportId, req.user!['id']);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Update an item on a DRAFT report' })
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
  @ApiOperation({ summary: 'Delete an item from a DRAFT report' })
  remove(
    @Param('reportId') reportId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.itemsService.remove(itemId, reportId, req.user!['id']);
  }
}
