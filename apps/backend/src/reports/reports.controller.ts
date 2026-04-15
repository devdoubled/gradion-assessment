import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user!['id'], dto);
  }

  @Get()
  findAll(@Req() req: Request, @Query('status') status?: string) {
    return this.reportsService.findAll(req.user!['id'], status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.findOneOwned(id, req.user!['id']);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.update(id, req.user!['id'], dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.remove(id, req.user!['id']);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.submit(id, req.user!['id']);
  }
}
